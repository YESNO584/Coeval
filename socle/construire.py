#!/usr/bin/env python3
"""Fabrique le socle de Coeval : interroge Wikidata et écrit les fichiers
que la page lira.

Le motif central, mesuré trois fois sur trois attributs différents : une
requête large pour les identifiants, des requêtes bornées pour tout le
reste. Demander la notoriété dans la requête principale coûte 66 s contre
0,76 s à part ; le pays, 13,2 s contre 1,1 s.

Usage :
  ./construire.py                 fabrique complète, écrit dans public/
  ./construire.py --siecles 1700 1800   se limite à ces siècles (essais)
  ./construire.py --quota 5       plafond par case (essais)
"""
import argparse
import datetime
import json
import math
import pathlib
import sys
import time

import modele
import requetes
import wikidata

ICI = pathlib.Path(__file__).resolve().parent
SORTIE = ICI / "public" / "data"
CACHE = ICI / "cache"


def charger(nom):
    return json.loads((ICI / nom).read_text(encoding="utf-8"))


def fonctions_actives(perimetre):
    return [f["id"] for g in perimetre["groupes"] if g["actif"] for f in g["fonctions"]]


def siecles(config):
    return list(range(config["siecle_min"], config["siecle_max"], 100))


def recuperer_noms(lignes, champs, config):
    """Demande les libellés des identifiants rencontrés, à part.

    Les garder dans la requête principale la faisait échouer sur les
    catégories à gros effectifs. Quatrième application du même motif : une
    requête large pour les identifiants, des requêtes bornées pour les
    attributs.
    """
    identifiants = set()
    for ligne in lignes:
        for champ in champs:
            url = modele.valeur(ligne, champ)
            if url is not None:
                identifiants.add(modele.identifiant(url))
    if not identifiants:
        return {}
    reponses = wikidata.par_lots(
        requetes.libelles, sorted(identifiants), config["lot_attributs"])
    noms = {}
    for reponse in reponses:
        url = modele.valeur(reponse, "sujet")
        nom = modele.valeur(reponse, "sujetLabel")
        if url is not None and nom is not None:
            noms[modele.identifiant(url)] = nom
    return noms


def recuperer_case(cle, categorie, debut, fin, config, fonctions):
    """Une case = une catégorie sur un siècle. Renvoie les entrées et ce qui
    a été écarté, en coupant la fenêtre en deux tant que le service refuse."""
    limite = config["limite_par_requete"]
    source = categorie["source"]

    if source == "metier":
        # Tous les métiers de la catégorie en une seule requête. Un métier
        # seul coûte plus cher que plusieurs ensemble : mesuré le
        # 2026-09-19, le peintre seul met 65 s et échoue (504, deux fois de
        # suite), les cinq métiers d'« artistes » réunis répondent en 20 s
        # et rendent 202 personnes. Un VALUES à plusieurs entrées laisse le
        # planificateur passer par les dates ; avec une seule valeur il
        # parcourt tous les peintres.
        #
        # Et pas de découpage à l'impatience : rétrécir la fenêtre ralentit
        # ces requêtes — cinq ans dépassent 90 s quand un siècle en met 20.
        # On laisse le service aller au bout de son temps ; il reste le
        # découpage sur refus et sur réponse pleine.
        lignes = wikidata.par_tranches(
            lambda a, b: requetes.personnes_vivantes(
                categorie["metiers"], a, b, limite),
            debut, fin, saturation=limite,
            delai_decoupe=wikidata.DELAI_MAX_S)
        noms = recuperer_noms(lignes, ("p",), config)
        return modele.convertir_personnes(lignes, cle, noms)
    if source == "fonction":
        lignes = wikidata.par_tranches(
            lambda a, b: requetes.souverains_regnants(fonctions, a, b, limite),
            debut, fin, saturation=limite)
        noms = recuperer_noms(lignes, ("p", "fonction"), config)
        return modele.convertir_souverains(lignes, noms)
    lignes = wikidata.par_tranches(
        lambda a, b: requetes.evenements(categorie["classes"], a, b, limite),
        debut, fin, saturation=limite)
    noms = recuperer_noms(lignes, ("e", "classe"), config)
    return modele.convertir_evenements(lignes, noms)


def classer(entrees, quota):
    """Garde les plus notoires. Le quota est un plafond : une case pauvre
    reste pauvre, et son compte réel sera publié."""
    ordonnees = sorted(entrees, key=lambda e: -(e["notoriete"] or 0))
    return ordonnees[:quota], max(len(ordonnees) - quota, 0)


def attacher_pays(entrees, config):
    lot = config["lot_attributs"]
    plans = [
        ("personne", "idSujet", requetes.pays_de_personnes),
        ("souverain", "idFonction", requetes.pays_de_fonctions),
        ("evenement", "idSujet", requetes.pays_d_evenements),
    ]
    for type_entree, cle, fabriquer in plans:
        concernees = [e for e in entrees if e["type"] == type_entree]
        if not concernees:
            continue
        identifiants = sorted({e[cle] for e in concernees})
        lignes = wikidata.par_lots(fabriquer, identifiants, lot)
        modele.attacher(concernees, lignes, cle, "paysLabel", "pays")


def cumuler(total, ajout):
    for cle, valeur in ajout.items():
        total[cle] = total.get(cle, 0) + valeur
    return total


def chemin_cache(siecle, cle):
    return CACHE / f"{siecle}_{cle}.json"


def fabriquer_case(cle, categorie, siecle, config, fonctions, quota):
    """Récupère une case et la range dans le cache. Le cache est la mémoire
    d'une nuit à l'autre : sans lui, une fabrique interrompue repartirait de
    zéro, et le service nous limiterait avant la fin."""
    entrees, rejets = recuperer_case(
        cle, categorie, siecle, siecle + 100, config, fonctions)
    if entrees:
        sujets = sorted({e["idSujet"] for e in entrees})
        lignes = wikidata.par_lots(requetes.notoriete, sujets, config["lot_attributs"])
        notoriete = {modele.identifiant(modele.valeur(l, "sujet")):
                     int(modele.valeur(l, "liens")) for l in lignes
                     if modele.valeur(l, "sujet")}
        for entree in entrees:
            entree["notoriete"] = notoriete.get(entree["idSujet"], 0)
    gardees, hors_quota = classer(entrees, quota)
    if gardees:
        attacher_pays(gardees, config)
    return {
        "faitLe": datetime.date.today().isoformat(),
        "quota": quota,
        "disponibles": len(entrees),
        "horsQuota": hors_quota,
        "ecartees": rejets,
        "entrees": gardees,
    }


def fabriquer(config, perimetre, siecles_voulus, quota, budget_s, refaire,
              hors_ligne, budget_case_s, reprendre_les_echecs):
    """Complète le cache dans la limite du temps imparti, puis assemble.

    Le budget n'est pas un confort : le service limite le débit d'un client
    qui interroge sans répit (429 constaté le 2026-09-19). Une fabrique qui
    s'arrête proprement et reprend la nuit suivante finit ; une fabrique qui
    insiste se fait couper.
    """
    CACHE.mkdir(parents=True, exist_ok=True)
    fonctions = fonctions_actives(perimetre)
    depart = time.monotonic()
    arrete = False

    for siecle in siecles_voulus:
        for cle, categorie in config["categories"].items():
            fichier = chemin_cache(siecle, cle)
            if fichier.exists() and not refaire:
                if not reprendre_les_echecs:
                    continue
                connue = json.loads(fichier.read_text(encoding="utf-8"))
                if connue.get("echec") is None:
                    continue
            if hors_ligne or arrete or (budget_s and time.monotonic() - depart > budget_s):
                arrete = True
                continue
            try:
                wikidata.accorder(budget_case_s)
                case = fabriquer_case(cle, categorie, siecle, config, fonctions, quota)
            except wikidata.TempsEcoule:
                # On note l'échec. Sans cette mémoire, chaque nuit rebrûlait
                # son budget sur les mêmes cases trop lentes : mesuré le
                # 2026-09-19, une quarantaine de tentatives dont trois quarts
                # d'échecs, pour dix cases gagnées en deux heures.
                fichier.write_text(json.dumps({
                    "faitLe": datetime.date.today().isoformat(),
                    "echec": "trop lente", "quota": quota, "disponibles": 0,
                    "horsQuota": 0, "ecartees": {}, "entrees": [],
                }, ensure_ascii=False), encoding="utf-8")
                print(f"  ~ {siecle} {cle} : trop lente, notée et laissée de côté",
                      file=sys.stderr)
                continue
            except wikidata.DebitLimite as souci:
                print(f"  ! débit limité ({souci}) : on s'arrête là, "
                      "la suite se fera à la prochaine exécution", file=sys.stderr)
                arrete = True
                continue
            except wikidata.ServiceIndisponible as souci:
                print(f"  ! {siecle} {cle} : {souci}", file=sys.stderr)
                continue
            wikidata.accorder(None)
            fichier.write_text(json.dumps(case, ensure_ascii=False), encoding="utf-8")
            print(f"  {siecle:>6} {cle:<14} {len(case['entrees']):>4} retenues "
                  f"sur {case['disponibles']:>5} disponibles", file=sys.stderr)

    toutes, ecartees, densite = [], {}, {}
    manquantes = 0
    for siecle in siecles_voulus:
        densite[siecle] = {}
        for cle in config["categories"]:
            fichier = chemin_cache(siecle, cle)
            if not fichier.exists():
                densite[siecle][cle] = {"retenues": 0, "aFaire": True}
                manquantes += 1
                continue
            case = json.loads(fichier.read_text(encoding="utf-8"))
            if case.get("echec") is not None:
                densite[siecle][cle] = {"retenues": 0, "aFaire": True,
                                        "echec": case["echec"]}
                manquantes += 1
                continue
            toutes.extend(case["entrees"])
            cumuler(ecartees, case["ecartees"])
            densite[siecle][cle] = {
                "retenues": len(case["entrees"]),
                "disponibles": case["disponibles"],
                "horsQuota": case["horsQuota"],
                "faitLe": case["faitLe"],
            }
    return toutes, ecartees, densite, manquantes


def ecrire(toutes, ecartees, densite, config, quota, manquantes):
    SORTIE.mkdir(parents=True, exist_ok=True)
    for ancien in SORTIE.glob("*.json"):
        ancien.unlink()

    # Une entrée est écrite dans chaque siècle qu'elle traverse, pas
    # seulement dans celui de sa naissance. Sans cela, une page qui n'ouvre
    # que le XVIIIe siècle perdrait tous ceux nés en 1690 et morts en 1750 —
    # alors qu'ils ont bel et bien vécu dans la fenêtre demandée.
    par_siecle = {}
    for entree in toutes:
        premier = math.floor(entree["debut"]["annee"] / 100) * 100
        dernier = math.floor(entree["fin"]["annee"] / 100) * 100
        for siecle in range(premier, dernier + 100, 100):
            par_siecle.setdefault(siecle, []).append(entree)

    for siecle, entrees in sorted(par_siecle.items()):
        (SORTIE / f"{siecle}.json").write_text(
            json.dumps(entrees, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8")

    index = {
        "fabriqueLe": datetime.date.today().isoformat(),
        "source": "Wikidata (CC0), interrogé par socle/construire.py",
        "quotaParCase": quota,
        "total": len(toutes),
        "casesAFaire": manquantes,
        "ecartees": ecartees,
        "siecles": [
            {
                "debut": siecle,
                "entrees": len(par_siecle[siecle]),
                "fichier": f"{siecle}.json",
            }
            for siecle in sorted(par_siecle)
        ],
        "densite": {str(s): d for s, d in sorted(densite.items())},
        "categories": {c: v["nom"] for c, v in config["categories"].items()},
    }
    (SORTIE / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    return index


def main():
    analyse = argparse.ArgumentParser(description="Fabrique le socle de Coeval.")
    analyse.add_argument("--siecles", nargs="+", type=int,
                         help="se limiter à ces débuts de siècle")
    analyse.add_argument("--quota", type=int, help="plafond par case")
    analyse.add_argument("--budget-minutes", type=int, default=0,
                         help="arrêter d'interroger après ce temps (0 = pas de limite)")
    analyse.add_argument("--budget-case-minutes", type=float, default=5,
                         help="temps accordé à une case avant de l'abandonner")
    analyse.add_argument("--refaire", action="store_true",
                         help="ignorer le cache et tout reprendre")
    analyse.add_argument("--reprendre-les-echecs", action="store_true",
                         help="retenter les cases notées trop lentes")
    analyse.add_argument("--sans-reseau", action="store_true",
                         help="n'assembler que ce qui est déjà dans le cache")
    options = analyse.parse_args()

    config = charger("config.json")
    perimetre = charger("perimetre.json")
    voulus = options.siecles if options.siecles else siecles(config)
    cases = max(len(voulus) * len(config["categories"]), 1)
    quota = options.quota or max(1, config["total_cible"] // cases)

    print(f"{len(voulus)} siècles × {len(config['categories'])} catégories "
          f"= {cases} cases, plafond {quota} par case "
          f"(cible {config['total_cible']})", file=sys.stderr)

    toutes, ecartees, densite, manquantes = fabriquer(
        config, perimetre, voulus, quota, options.budget_minutes * 60,
        options.refaire, options.sans_reseau,
        options.budget_case_minutes * 60, options.reprendre_les_echecs)
    # Le contrôle vient AVANT l'écriture, et c'est là tout ce qui compte :
    # « ecrire » commence par effacer le socle précédent. Placé après, comme
    # il l'était jusqu'au 2026-09-20, il refusait de publier un socle vide
    # après avoir effacé celui qui marchait. L'atelier ignore ce code de
    # retour — volontairement, pour qu'une nuit ratée n'empêche pas de
    # publier une correction de style — et publiait donc le vide. Le site a
    # perdu ses 1 155 entrées sur un commit qui ne touchait qu'à des
    # commentaires.
    minimum = config["minimum_publiable"]
    if not options.siecles and len(toutes) < minimum:
        print(f"ERREUR : {len(toutes)} entrées seulement, minimum {minimum}. "
              "Rien n'est écrit ; le socle précédent reste intact.",
              file=sys.stderr)
        return 1

    index = ecrire(toutes, ecartees, densite, config, quota, manquantes)

    print(f"\n{index['total']} entrées, {len(index['siecles'])} siècles, "
          f"{manquantes} cases encore à faire, écartées : {ecartees}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
