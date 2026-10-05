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
  ./reprendre_en_ligne.py <adresse du site> <dossier>
  ./reprendre_en_ligne.py <adresse du site> <dossier> --seulement-si-plus-grand
"""
import json
import pathlib
import shutil
import sys
import urllib.error
import urllib.request

DELAI_S = 30


def telecharger(adresse):
    with urllib.request.urlopen(adresse, timeout=DELAI_S) as reponse:
        return reponse.read()


def lire_le_total(dossier):
    """Combien d'entrées contient un socle déjà sur le disque. 0 s'il n'y en
    a pas."""
    index = pathlib.Path(dossier) / "index.json"
    if not index.is_file():
        return 0
    try:
        return int(json.loads(index.read_text(encoding="utf-8")).get("total", 0))
    except (json.JSONDecodeError, OSError, TypeError, ValueError):
        return 0


def reprendre(site, destination, minimum, seulement_si_plus_grand=False):
    """Rend (entrées, siècles) repris, ou lève une exception.

    Le téléchargement se fait dans un dossier provisoire, mis en place d'un
    seul coup à la fin. Écrire directement dans la destination publierait un
    socle mutilé si le réseau coupait en cours de route : l'index
    annoncerait douze siècles et trois fichiers seulement seraient là.
    """
    racine = site.rstrip("/") + "/data"
    index = json.loads(telecharger(f"{racine}/index.json"))
    total = index.get("total", 0)
    if total < minimum:
        raise ValueError(
            f"le socle en ligne ne contient que {total} entrées "
            f"(minimum {minimum}) : il n'y a rien à reprendre")

    if seulement_si_plus_grand:
        # La fabrique repart de zéro quand ses règles changent. Sans cette
        # comparaison, la première nuit après un correctif remplacerait un
        # socle de 5 626 entrées par les 1 500 qu'elle a eu le temps de
        # refaire, et le site perdrait des semaines de fabrique pour une
        # correction de libellé.
        dejaLa = lire_le_total(destination)
        if dejaLa >= total:
            return (dejaLa, None)

    provisoire = pathlib.Path(str(destination) + ".en-cours")
    if provisoire.is_dir():
        shutil.rmtree(provisoire)
    provisoire.mkdir(parents=True)
    (provisoire / "index.json").write_bytes(
        json.dumps(index, ensure_ascii=False, indent=1).encode("utf-8"))
    for siecle in index.get("siecles", []):
        nom = siecle["fichier"]
        # Un nom de fichier vient d'une source distante : on refuse tout ce
        # qui n'est pas un nom simple, plutôt que de le concaténer à un
        # chemin les yeux fermés.
        if "/" in nom or "\\" in nom or nom.startswith("."):
            raise ValueError(f"nom de fichier refusé : {nom!r}")
        (provisoire / nom).write_bytes(telecharger(f"{racine}/{nom}"))

    destination = pathlib.Path(destination)
    if destination.is_dir():
        shutil.rmtree(destination)
    provisoire.rename(destination)
    return (total, len(index.get("siecles", [])))


def main():
    arguments = [a for a in sys.argv[1:] if not a.startswith("--")]
    options = {a for a in sys.argv[1:] if a.startswith("--")}
    if len(arguments) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    site, destination = arguments[0], pathlib.Path(arguments[1])
    ici = pathlib.Path(__file__).resolve().parent
    config = json.loads((ici / "config.json").read_text(encoding="utf-8"))
    try:
        total, siecles = reprendre(site, destination, config["minimum_publiable"],
                                   "--seulement-si-plus-grand" in options)
    except (urllib.error.URLError, ValueError, json.JSONDecodeError, KeyError,
            OSError) as souci:
        print(f"socle en ligne non repris : {souci}", file=sys.stderr)
        return 1
    if siecles is None:
        print(f"socle fabriqué gardé : {total} entrées, au moins autant "
              "que celui en ligne", file=sys.stderr)
        return 0
    print(f"socle repris en ligne : {total} entrées, {siecles} siècles",
          file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
