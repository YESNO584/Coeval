#!/usr/bin/env python3
"""Lit un fichier de contributions et dit ce qu'il accepterait.

**Il ne modifie rien tout seul.** Il produit un rapport — accepté, refusé,
conflit — que l'on lit avant de décider. La décision reste humaine, et c'est
volontaire : le fichier vient de l'extérieur, et le socle alimente un site
public.

Le format est décrit dans socle/contributions.md, qui fait foi.

Usage :
  ./fusionner.py contributions.json                     rapport seul
  ./fusionner.py *.json --socle public/data             plusieurs fichiers
  ./fusionner.py contributions.json --ecrire corrections.json
"""
import argparse
import json
import pathlib
import re
import sys

ICI = pathlib.Path(__file__).resolve().parent
VERSION_MAX = 2
FORME_CIBLE = re.compile(r"^(Q\d+|tmp-\d+)$")
FORME_ANNEE = re.compile(r"^-?\d{1,6}$")
ANNEE_MIN, ANNEE_MAX = -300000, 3000
LONGUEUR_MAX = 2000
CHAMPS_CONNUS = {"nom", "debut", "fin", "detail", "pays", "description"}
OPERATIONS = {"ajout", "modification", "suppression"}


class Refus(ValueError):
    """Une opération que le script n'accepte pas, avec sa raison."""


def charger_socle(dossier):
    """Indexe le socle par identifiant, pour retrouver la valeur actuelle."""
    par_identifiant = {}
    chemin = pathlib.Path(dossier)
    if not chemin.is_dir():
        return par_identifiant
    for fichier in sorted(chemin.glob("*.json")):
        if fichier.name == "index.json":
            continue
        for entree in json.loads(fichier.read_text(encoding="utf-8")):
            par_identifiant.setdefault(entree["id"], entree)
    return par_identifiant


def valeur_actuelle(entree, champ):
    if champ in ("debut", "fin"):
        return str(entree[champ]["annee"])
    if champ == "pays":
        return ", ".join(entree.get("pays", []))
    return str(entree.get(champ, ""))


def verifier_texte(valeur, quoi):
    if not isinstance(valeur, str):
        raise Refus(f"{quoi} : attendu du texte, reçu {type(valeur).__name__}")
    if len(valeur) > LONGUEUR_MAX:
        raise Refus(f"{quoi} : {len(valeur)} caractères, maximum {LONGUEUR_MAX}")
    if "<" in valeur or ">" in valeur:
        # Le socle alimente une page publique. Un chevron n'a rien à faire
        # dans un nom de personne, et tout à faire dans une injection.
        raise Refus(f"{quoi} : les chevrons ne sont pas acceptés")


def verifier_annee(valeur, quoi):
    if not FORME_ANNEE.match(str(valeur).strip()):
        raise Refus(f"{quoi} : « {valeur} » n'est pas une année")
    nombre = int(str(valeur).strip())
    if not ANNEE_MIN <= nombre <= ANNEE_MAX:
        raise Refus(f"{quoi} : {nombre} hors des bornes {ANNEE_MIN}…{ANNEE_MAX}")


def champs_de(operation):
    """Les champs touchés, quelle que soit la version du fichier.

    La version 1 écrivait une opération par champ — « champ », « avant » et
    « apres » à la racine. La version 2 groupe les champs d'une même entité
    sous « champs ». Les deux se lisent : un fichier enregistré avant le
    changement porte du travail que personne ne refera.
    """
    champs = operation.get("champs")
    if isinstance(champs, dict):
        return champs
    champ = operation.get("champ")
    if champ is None:
        return {}
    return {champ: {"avant": operation.get("avant"),
                    "apres": operation.get("apres")}}


def verifier_operation(operation, socle):
    """Lève Refus si l'opération n'est pas recevable.

    Renvoie le dictionnaire des champs en conflit — vide s'il n'y en a pas.
    **Le verdict est par champ, pas par opération** : grouper les champs
    d'une entité dans une seule ligne ne doit pas faire rejeter trois
    corrections justes parce que la quatrième s'appuie sur une valeur que la
    fabrique a changée depuis.
    """
    quoi = operation.get("operation")
    if quoi not in OPERATIONS:
        raise Refus(f"opération inconnue : « {quoi} »")

    cible = operation.get("cible") or {}
    identifiant = cible.get("id", "")
    if not FORME_CIBLE.match(str(identifiant)):
        raise Refus(f"identifiant mal formé : « {identifiant} »")

    provisoire = str(identifiant).startswith("tmp-")
    if not provisoire and identifiant not in socle:
        raise Refus(f"{identifiant} est absent du socle")
    if provisoire and quoi != "ajout":
        raise Refus(f"{identifiant} est provisoire : seul un ajout est possible")

    if quoi == "suppression":
        return {}

    champs = champs_de(operation)
    if not champs:
        raise Refus(f"{identifiant} : aucune valeur, cette opération ne dit rien")

    conflits = {}
    for champ, valeurs in champs.items():
        if champ not in CHAMPS_CONNUS:
            raise Refus(f"champ inconnu ou non modifiable : « {champ} »")
        if not isinstance(valeurs, dict):
            raise Refus(f"{identifiant}.{champ} : attendu « avant » et « apres »")

        apres = valeurs.get("apres")
        if champ in ("debut", "fin"):
            verifier_annee(apres, f"{identifiant}.{champ}")
        else:
            verifier_texte("" if apres is None else apres, f"{identifiant}.{champ}")

        if quoi != "modification":
            continue
        if valeurs.get("avant") is None:
            raise Refus(f"{identifiant}.{champ} : « avant » manque, "
                        "on ne peut pas vérifier que la valeur est à jour")
        actuelle = valeur_actuelle(socle[identifiant], champ)
        if str(valeurs["avant"]) != actuelle:
            conflits[champ] = (f"le socle dit « {actuelle} », la contribution "
                               f"a vu « {valeurs['avant']} »")
    return conflits


def lire_fichier(chemin):
    contenu = json.loads(pathlib.Path(chemin).read_text(encoding="utf-8"))
    if contenu.get("format") != "coeval-contributions":
        raise Refus(f"{chemin} : ce n'est pas un fichier de contributions")
    version = contenu.get("version")
    if not isinstance(version, int) or version > VERSION_MAX:
        raise Refus(f"{chemin} : version {version}, ce script en connaît "
                    f"jusqu'à {VERSION_MAX}")
    return contenu


def examiner(chemins, socle):
    acceptees, refusees, conflits = [], [], []
    for chemin in chemins:
        try:
            contenu = lire_fichier(chemin)
        except (Refus, ValueError) as souci:
            refusees.append((chemin, None, str(souci)))
            continue
        for operation in contenu.get("operations", []):
            numero = operation.get("numero", "?")
            try:
                enConflit = verifier_operation(operation, socle)
            except Refus as souci:
                refusees.append((chemin, numero, str(souci)))
                continue
            for champ, raison in enConflit.items():
                conflits.append((chemin, numero, operation, champ, raison))
            # Les champs à jour de la même opération restent acceptables.
            champs = champs_de(operation)
            retenus = {c: v for c, v in champs.items() if c not in enConflit}
            if champs and not retenus:
                continue
            acceptees.append((chemin, numero, sans_les_conflits(operation, retenus)))
    return acceptees, refusees, conflits


def sans_les_conflits(operation, retenus):
    """L'opération réduite à ses champs acceptables."""
    if not retenus and "champs" not in operation and "champ" not in operation:
        return operation
    reduite = {c: v for c, v in operation.items()
               if c not in ("champs", "champ", "avant", "apres")}
    if retenus:
        reduite["champs"] = retenus
    return reduite


def rapporter(acceptees, refusees, conflits):
    print(f"\n{len(acceptees)} acceptée(s), {len(conflits)} conflit(s), "
          f"{len(refusees)} refusée(s)\n")
    for chemin, numero, operation in acceptees:
        cible = operation["cible"]["id"]
        champs = champs_de(operation)
        if not champs:
            print(f"  ✓ {chemin}#{numero} {cible} : {operation['operation']}")
            continue
        for champ, valeurs in champs.items():
            print(f"  ✓ {chemin}#{numero} {cible}.{champ} → "
                  f"{str(valeurs.get('apres'))[:60]}")
    for chemin, numero, operation, champ, raison in conflits:
        cible = operation["cible"]["id"]
        print(f"  ! {chemin}#{numero} {cible}.{champ} : {raison}")
    for chemin, numero, raison in refusees:
        repere = f"#{numero}" if numero is not None else ""
        print(f"  ✗ {chemin}{repere} : {raison}")


def main():
    analyse = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    analyse.add_argument("fichiers", nargs="+", help="fichiers de contributions")
    analyse.add_argument("--socle", default=str(ICI / "public" / "data"),
                         help="dossier du socle publié")
    analyse.add_argument("--ecrire", help="écrire les opérations acceptées ici")
    options = analyse.parse_args()

    socle = charger_socle(options.socle)
    print(f"socle : {len(socle)} entrées lues depuis {options.socle}", file=sys.stderr)
    acceptees, refusees, conflits = examiner(options.fichiers, socle)
    rapporter(acceptees, refusees, conflits)

    if options.ecrire:
        retenues = [operation for _, _, operation in acceptees]
        pathlib.Path(options.ecrire).write_text(
            json.dumps({"operations": retenues}, ensure_ascii=False, indent=1),
            encoding="utf-8")
        print(f"\n{len(retenues)} opération(s) écrite(s) dans {options.ecrire}")

    # Un conflit n'est pas une erreur du script : c'est une information qui
    # demande une décision. Seul un refus fait sortir en échec.
    return 1 if refusees else 0


if __name__ == "__main__":
    sys.exit(main())
