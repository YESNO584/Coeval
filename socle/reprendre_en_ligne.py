#!/usr/bin/env python3
"""Récupère le socle déjà publié, pour le republier tel quel.

Pourquoi ce fichier existe. Le site et le socle sont publiés ensemble, en un
seul bloc : chaque publication remplace tout. Une correction de style
déclenche donc une publication, et cette publication emporte les données avec
elle si l'atelier n'a pas de socle sous la main à ce moment-là. C'est arrivé
le 2026-09-20 — 1 155 entrées effacées par un commit qui ne touchait qu'à des
commentaires.

Avec ce script, l'atelier qui n'a rien fabriqué va chercher le socle en ligne
et le remet. Le code et les données évoluent alors chacun de leur côté :
publier la page ne touche plus aux données, fabriquer les données ne touche
plus à la page.

Usage :
  ./reprendre_en_ligne.py <adresse du site> <dossier de destination>
"""
import json
import pathlib
import sys
import urllib.error
import urllib.request

DELAI_S = 30


def telecharger(adresse):
    with urllib.request.urlopen(adresse, timeout=DELAI_S) as reponse:
        return reponse.read()


def reprendre(site, destination, minimum):
    """Rend le nombre d'entrées reprises, ou lève une exception."""
    racine = site.rstrip("/") + "/data"
    index = json.loads(telecharger(f"{racine}/index.json"))
    total = index.get("total", 0)
    if total < minimum:
        raise ValueError(
            f"le socle en ligne ne contient que {total} entrées "
            f"(minimum {minimum}) : il n'y a rien à reprendre")

    destination.mkdir(parents=True, exist_ok=True)
    (destination / "index.json").write_bytes(
        json.dumps(index, ensure_ascii=False, indent=1).encode("utf-8"))
    for siecle in index.get("siecles", []):
        nom = siecle["fichier"]
        # Un nom de fichier vient d'une source distante : on refuse tout ce
        # qui n'est pas un nom simple, plutôt que de le concaténer à un
        # chemin les yeux fermés.
        if "/" in nom or "\\" in nom or nom.startswith("."):
            raise ValueError(f"nom de fichier refusé : {nom!r}")
        (destination / nom).write_bytes(telecharger(f"{racine}/{nom}"))
    return total, len(index.get("siecles", []))


def main():
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    site, destination = sys.argv[1], pathlib.Path(sys.argv[2])
    ici = pathlib.Path(__file__).resolve().parent
    config = json.loads((ici / "config.json").read_text(encoding="utf-8"))
    try:
        total, siecles = reprendre(site, destination, config["minimum_publiable"])
    except (urllib.error.URLError, ValueError, json.JSONDecodeError, KeyError) as souci:
        print(f"socle en ligne non repris : {souci}", file=sys.stderr)
        return 1
    print(f"socle repris en ligne : {total} entrées, {siecles} siècles",
          file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
