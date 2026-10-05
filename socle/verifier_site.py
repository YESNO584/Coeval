#!/usr/bin/env python3
"""Refuse un site prêt à publier s'il lui manque son code ou ses données.

Un site publié sans son code, ou sans son socle, s'affiche vide sans rien
dire de son échec — et il remplace la version précédente, qui elle
fonctionnait. Mieux vaut ne pas publier : GitHub Pages garde alors la
dernière publication réussie, et l'échec se voit dans le journal de
l'atelier.

Usage :
  ./verifier_site.py <dossier du site>
"""
import json
import pathlib
import sys

INDISPENSABLES = ("index.html", "css/base.css", "js/app.js")


def verifier(site, minimum):
    """Rend la liste des raisons de refuser. Vide = le site est publiable."""
    raisons = []
    for chemin in INDISPENSABLES:
        fichier = site / chemin
        if not fichier.is_file() or fichier.stat().st_size == 0:
            raisons.append(f"{chemin} manque ou est vide")

    index = site / "data" / "index.json"
    if not index.is_file():
        raisons.append("aucun socle : ni fabriqué, ni repris en ligne")
        return raisons
    try:
        total = json.loads(index.read_text(encoding="utf-8")).get("total", 0)
    except (json.JSONDecodeError, OSError) as souci:
        raisons.append(f"socle illisible : {souci}")
        return raisons
    if total < minimum:
        raisons.append(f"socle de {total} entrées, minimum {minimum}")

    # L'index annonce ses siècles ; chacun doit avoir son fichier. Vérifier ce
    # qu'un index déclare sans vérifier ce qui est là laisserait publier un
    # socle mutilé par un téléchargement coupé en route — la page échouerait
    # à ouvrir les siècles manquants, sans rien dire.
    try:
        annonces = json.loads(index.read_text(encoding="utf-8")).get("siecles", [])
    except (json.JSONDecodeError, OSError):
        return raisons
    manquants = [s["fichier"] for s in annonces
                 if not (site / "data" / s["fichier"]).is_file()]
    if manquants:
        raisons.append(f"{len(manquants)} siècle(s) annoncé(s) sans fichier : "
                       + ", ".join(manquants[:5]))
    return raisons


def main():
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    site = pathlib.Path(sys.argv[1])
    ici = pathlib.Path(__file__).resolve().parent
    config = json.loads((ici / "config.json").read_text(encoding="utf-8"))
    raisons = verifier(site, config["minimum_publiable"])
    if raisons:
        for raison in raisons:
            print(f"::error::{raison} — on ne publie pas.")
        return 1
    total = json.loads((site / "data" / "index.json").read_text(encoding="utf-8"))["total"]
    print(f"site complet : {total} entrées dans le socle.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
