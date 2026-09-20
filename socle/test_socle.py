#!/usr/bin/env python3
"""Tests de la fabrique. Aucun ne touche au réseau.

C'est délibéré : le service limite le débit, et des tests qui l'interrogent
échoueraient pour une raison étrangère à ce qu'ils vérifient. Ce qui dépend
vraiment de Wikidata se mesure à la main et se note dans le plan.
"""
import json
import pathlib
import re
import sys

import construire
import modele
import requetes
import wikidata

ICI = pathlib.Path(__file__).resolve().parent
RACINE = ICI.parent
echecs = []


def verifier(condition, message):
    if condition:
        return
    echecs.append(message)


def test_categories_identiques_a_la_page():
    """Les clés de catégories doivent être les mêmes des deux côtés.

    Une divergence ferait lire à la page un socle dont les catégories ne
    correspondent pas aux siennes : elle n'afficherait rien, sans erreur.
    """
    config = json.loads((ICI / "config.json").read_text(encoding="utf-8"))
    js = (RACINE / "js" / "config.js").read_text(encoding="utf-8")
    bloc = js.split("export const CATEGORIES = {", 1)[1].split("\n};", 1)[0]
    cotes_page = set(re.findall(r"^\s{2}(\w+):", bloc, re.MULTILINE))
    cotes_socle = set(config["categories"])
    verifier(cotes_page == cotes_socle,
             f"catégories divergentes — page {sorted(cotes_page)}, "
             f"socle {sorted(cotes_socle)}")


def test_perimetre_bien_forme():
    perimetre = json.loads((ICI / "perimetre.json").read_text(encoding="utf-8"))
    vus = set()
    actives = 0
    for groupe in perimetre["groupes"]:
        verifier(groupe["fonctions"], f"groupe vide : {groupe['nom']}")
        for fonction in groupe["fonctions"]:
            verifier(re.match(r"^Q\d+$", fonction["id"]),
                     f"identifiant mal formé : {fonction['id']}")
            verifier(fonction["id"] not in vus,
                     f"identifiant en double : {fonction['id']}")
            vus.add(fonction["id"])
            if groupe["actif"]:
                actives += 1
    verifier(actives >= 40, f"périmètre trop maigre : {actives} fonctions actives")


def test_dates():
    verifier(modele.date("1769-08-15T00:00:00Z", "11")["annee"] == 1769, "date au jour")
    verifier(modele.date("-0044-03-15T00:00:00Z", "11")["annee"] == -44, "date av. J.-C.")
    verifier(modele.date("1746-01-01T00:00:00Z", "9")["approximative"] is True,
             "une date à l'année doit être marquée approximative")
    verifier(modele.date("1740-01-01T00:00:00Z", "8") is None,
             "une décennie n'est pas plaçable et doit être écartée")
    verifier(modele.date(None, "11") is None, "date absente")
    verifier(modele.date("1769-08-15T00:00:00Z", None) is None, "précision absente")


def test_arbitrage_des_dates_concurrentes():
    au_jour = modele.date("1746-06-29T00:00:00Z", "11")
    a_l_annee = modele.date("1746-01-01T00:00:00Z", "9")
    verifier(modele.meilleure(a_l_annee, au_jour) is au_jour,
             "la date la plus précise doit gagner")
    verifier(modele.meilleure(au_jour, a_l_annee) is au_jour,
             "l'ordre d'arrivée ne doit rien changer")
    tot = modele.date("1827-03-04T00:00:00Z", "11")
    tard = modele.date("1827-03-05T00:00:00Z", "11")
    verifier(modele.meilleure(tard, tot) is tot,
             "à précision égale, la plus ancienne, pour que deux exécutions "
             "donnent le même socle")


def _ligne(qid, nom, naissance, pn, mort, pm):
    return {
        "p": {"value": f"http://www.wikidata.org/entity/{qid}"},
        "pLabel": {"value": nom},
        "naissance": {"value": naissance}, "precNaissance": {"value": pn},
        "mort": {"value": mort}, "precMort": {"value": pm},
    }


def test_conversion_des_personnes():
    lignes = [
        _ligne("Q1", "Descartes", "1596-03-31T00:00:00Z", "11",
               "1650-02-11T00:00:00Z", "11"),
        # La même personne, avec une naissance moins précise : un doublon.
        _ligne("Q1", "Descartes", "1596-01-01T00:00:00Z", "9",
               "1650-02-11T00:00:00Z", "11"),
        # Sans libellé : Wikidata renvoie l'identifiant, l'entrée est écartée.
        _ligne("Q2", "Q2", "1600-01-01T00:00:00Z", "11", "1660-01-01T00:00:00Z", "11"),
        # Date à la décennie : pas plaçable.
        _ligne("Q3", "Inconnu", "1600-01-01T00:00:00Z", "8", "1660-01-01T00:00:00Z", "11"),
    ]
    entrees, rejets = modele.convertir_personnes(lignes, "philosophes")
    verifier(len(entrees) == 1, f"une seule personne attendue, {len(entrees)} obtenue(s)")
    verifier(rejets["doublons"] == 1, "le doublon doit être compté")
    verifier(rejets["sansNom"] == 1, "l'entrée sans nom doit être comptée")
    verifier(rejets["sansDate"] == 1, "l'entrée sans date précise doit être comptée")
    verifier(entrees[0]["debut"]["code"] == 11,
             "l'arbitrage doit garder la naissance au jour près")
    verifier(entrees[0]["categories"] == ["philosophes"], "catégorie posée")


def test_formes_obligatoires_des_requetes():
    """Trois pièges mesurés, qu'aucune requête ne doit reprendre."""
    toutes = {
        "personnes": requetes.personnes_vivantes(["Q4964182"], 1700, 1800, 400),
        "souverains": requetes.souverains_regnants(["Q18384454"], 1700, 1800, 400),
        "evenements": requetes.evenements(["Q198"], 1700, 1800, 400),
    }
    for nom, requete in toutes.items():
        verifier("YEAR(" not in requete,
                 f"{nom} : YEAR() empêche l'usage de l'index — 58 s au lieu de 5,7 s")
        verifier("hint:rangeSafe" in requete,
                 f"{nom} : l'indice rangeSafe manque")
    for nom in ("souverains", "evenements"):
        verifier("COALESCE(?fin, ?debut)" in toutes[nom],
                 f"{nom} : sans COALESCE, une fin inconnue laisse tout passer")
        verifier("!BOUND(?fin)" not in toutes[nom],
                 f"{nom} : !BOUND laissait entrer un règne de 2599 av. J.-C.")


def test_annees_negatives_dans_les_requetes():
    requete = requetes.personnes_vivantes(["Q4964182"], -500, -400, 10)
    verifier('"-0500-01-01T00:00:00Z"' in requete,
             "une année avant J.-C. doit s'écrire avec quatre chiffres et un signe")


def test_temps_accorde_a_une_case():
    """Une case qui s'acharne prend la place de dix autres.

    Le contrôle doit se faire AVANT l'appel réseau, sinon la limite ne
    limite rien : elle attendrait la fin de la requête pour constater que le
    temps est écoulé. Ce test ne touche donc à aucun réseau, par
    construction — s'il en touchait un, c'est qu'il serait faux.
    """
    wikidata.accorder(-1)
    try:
        wikidata.interroger("SELECT ?x WHERE { ?x ?y ?z } LIMIT 1")
        verifier(False, "le temps écoulé doit interrompre avant d'appeler le service")
    except wikidata.TempsEcoule:
        pass
    except Exception as souci:
        verifier(False, f"mauvaise erreur : {type(souci).__name__} — {souci}")
    finally:
        wikidata.accorder(None)


def test_tranches_ne_decoupent_pas_une_limite_de_debit():
    """Découper ne sert à rien quand c'est le client qui est limité."""
    appels = []

    def fabriquer(debut, fin):
        appels.append((debut, fin))
        raise wikidata.DebitLimite("30")

    original = wikidata.interroger
    wikidata.interroger = lambda requete, *reste: fabriquer(0, 0)
    try:
        wikidata.par_tranches(lambda a, b: "", 1700, 1800)
        verifier(False, "une limitation de débit doit remonter, pas être découpée")
    except wikidata.DebitLimite:
        verifier(len(appels) == 1,
                 f"une seule tentative attendue, {len(appels)} faites")
    finally:
        wikidata.interroger = original


def test_une_reponse_pleine_est_decoupee():
    """Une réponse qui atteint le plafond a perdu des lignes en silence.

    Mesuré le 2026-09-19 : les artistes de 1500 à 1600 rendent exactement
    400 lignes, le plafond de la requête. Sans ce découpage, la fabrique
    publiait cette case comme complète.
    """
    appels = []

    def repondre(requete, *reste):
        debut, fin = requete
        appels.append((debut, fin))
        # Pleine tant que la fenêtre dépasse 25 ans.
        return ["x"] * (4 if fin - debut > 25 else 1)

    original = wikidata.interroger
    wikidata.interroger = repondre
    try:
        lignes = wikidata.par_tranches(lambda a, b: (a, b), 1500, 1600,
                                       saturation=4)
    finally:
        wikidata.interroger = original
    verifier(len(appels) > 1, "une réponse pleine doit être découpée")
    feuilles = sorted(f for f in appels if f[1] - f[0] <= 25)
    verifier(feuilles == [(1500, 1525), (1525, 1550), (1550, 1575), (1575, 1600)],
             f"les tranches doivent couvrir toute la fenêtre : {feuilles}")
    verifier(len(lignes) == 4,
             f"les quatre tranches doivent être réunies, {len(lignes)} obtenues")


def test_une_reponse_non_pleine_n_est_pas_decoupee():
    appels = []

    def repondre(requete, *reste):
        appels.append(requete)
        return ["x"] * 3

    original = wikidata.interroger
    wikidata.interroger = repondre
    try:
        lignes = wikidata.par_tranches(lambda a, b: (a, b), 1500, 1600,
                                       saturation=4)
    finally:
        wikidata.interroger = original
    verifier(len(appels) == 1,
             f"une seule requête attendue, {len(appels)} faites")
    verifier(len(lignes) == 3, "les lignes doivent être rendues telles quelles")


def test_les_metiers_sont_demandes_ensemble():
    """Un métier seul coûte plus cher que plusieurs ensemble : 65 s et un
    504 pour le peintre, 20 s et 202 personnes pour les cinq métiers
    réunis. Mesuré le 2026-09-19."""
    config = json.loads((RACINE / "socle" / "config.json").read_text("utf-8"))
    for cle, categorie in config["categories"].items():
        if categorie["source"] != "metier":
            continue
        demandes = []
        original = wikidata.par_tranches
        wikidata.par_tranches = lambda fabriquer, a, b, **reste: (
            demandes.append(fabriquer(a, b)) or [])
        try:
            construire.recuperer_case(cle, categorie, 1500, 1600, config, [])
        finally:
            wikidata.par_tranches = original
        verifier(len(demandes) == 1,
                 f"{cle} : une seule requête attendue, {len(demandes)} faites")
        manquants = [m for m in categorie["metiers"] if m not in demandes[0]]
        verifier(not manquants,
                 f"{cle} : métiers absents de la requête : {manquants}")


def main():
    for nom, fonction in sorted(globals().items()):
        if nom.startswith("test_") and callable(fonction):
            fonction()
    if echecs:
        print(f"{len(echecs)} échec(s) :", file=sys.stderr)
        for echec in echecs:
            print(f"  - {echec}", file=sys.stderr)
        return 1
    print("tous les tests passent")
    return 0


if __name__ == "__main__":
    sys.exit(main())
