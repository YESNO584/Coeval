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


def recuperer_case(cle, categorie, debut, fin, config, fonctions):
    """Une case = une catégorie sur un siècle. Renvoie les entrées et ce qui
    a été écarté, en coupant la fenêtre en deux tant que le service refuse."""
    limite = config["limite_par_requete"]
    source = categorie["source"]

    if source == "metier":
        # Un métier à la fois. Groupés, les cinq métiers de « artistes »
        # dépassent le budget du service même découpés en tranches de dix
        # ans : « écrivain » à lui seul compte des centaines de milliers de
        # personnes. Constaté le 2026-09-19, sur une erreur 504 que le
        # découpage temporel ne résolvait pas.
        lignes = []
        for metier in categorie["metiers"]:
            lignes.extend(wikidata.par_tranches(
                lambda a, b, m=metier: requetes.personnes_vivantes([m], a, b, limite),
                debut, fin))
        return modele.convertir_personnes(lignes, cle)
    if source == "fonction":
        lignes = wikidata.par_tranches(
            lambda a, b: requetes.souverains_regnants(fonctions, a, b, limite),
            debut, fin)
        return modele.convertir_souverains(lignes)
    lignes = wikidata.par_tranches(
        lambda a, b: requetes.evenements(categorie["classes"], a, b, limite),
        debut, fin)
    return modele.convertir_evenements(lignes)


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


def fabriquer(config, perimetre, siecles_voulus, quota, budget_s, refaire, hors_ligne):
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
                continue
            if hors_ligne or arrete or (budget_s and time.monotonic() - depart > budget_s):
                arrete = True
                continue
            try:
                case = fabriquer_case(cle, categorie, siecle, config, fonctions, quota)
            except wikidata.DebitLimite as souci:
                print(f"  ! débit limité ({souci}) : on s'arrête là, "
                      "la suite se fera à la prochaine exécution", file=sys.stderr)
                arrete = True
                continue
            except wikidata.ServiceIndisponible as souci:
                print(f"  ! {siecle} {cle} : {souci}", file=sys.stderr)
                continue
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
    analyse.add_argument("--refaire", action="store_true",
                         help="ignorer le cache et tout reprendre")
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
        options.refaire, options.sans_reseau)
    index = ecrire(toutes, ecartees, densite, config, quota, manquantes)

    print(f"\n{index['total']} entrées, {len(index['siecles'])} siècles, "
          f"{manquantes} cases encore à faire, écartées : {ecartees}", file=sys.stderr)

    # Une panne de la source ne doit pas remplacer un site correct par un
    # site vide : mieux vaut refuser de publier et le dire.
    minimum = config["minimum_publiable"]
    if not options.siecles and index["total"] < minimum:
        print(f"ERREUR : {index['total']} entrées seulement, minimum {minimum}. "
              "On ne publie pas.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
