#!/usr/bin/env python3
"""Tests du script de fusion. Aucun ne touche au réseau ni au socle publié.

Le fichier de contributions vient de l'extérieur, et le socle alimente une
page publique : ces tests portent surtout sur ce que le script **refuse**.
"""
import sys

import fusionner

echecs = []


def verifier(condition, message):
    if not condition:
        echecs.append(message)


SOCLE = {
    "Q9312": {
        "id": "Q9312", "nom": "Emmanuel Kant", "detail": "",
        "debut": {"annee": 1724}, "fin": {"annee": 1804},
        "pays": ["royaume de Prusse"], "description": "",
    },
}


def examiner(operation):
    """Renvoie ('accepte', None), ('conflit', raison) ou ('refus', raison)."""
    try:
        conflit = fusionner.verifier_operation(operation, SOCLE)
    except fusionner.Refus as souci:
        return ("refus", str(souci))
    return ("conflit", conflit) if conflit else ("accepte", None)


def modification(champ, avant, apres, cible="Q9312"):
    return {"numero": 1, "operation": "modification",
            "cible": {"type": "personne", "id": cible},
            "champ": champ, "avant": avant, "apres": apres}


def test_une_modification_correcte_passe():
    etat, _ = examiner(modification("nom", "Emmanuel Kant", "Immanuel Kant"))
    verifier(etat == "accepte", f"attendu accepté, obtenu {etat}")


def test_une_valeur_avant_perimee_est_un_conflit():
    """Le socle a pu changer depuis que la personne a lu la valeur.

    Ce n'est ni une erreur ni une acceptation : c'est une décision à prendre,
    et le script la signale au lieu de choisir à la place de l'humain.
    """
    etat, raison = examiner(modification("nom", "Kant (ancien nom)", "Immanuel Kant"))
    verifier(etat == "conflit", f"attendu conflit, obtenu {etat}")
    verifier(raison is not None and "Emmanuel Kant" in raison,
             "le conflit doit citer ce que le socle contient")


def test_une_modification_sans_avant_est_refusee():
    sans = modification("nom", None, "Immanuel Kant")
    del sans["avant"]
    etat, raison = examiner(sans)
    verifier(etat == "refus", f"attendu refus, obtenu {etat}")
    verifier("avant" in (raison or ""), "la raison doit nommer le champ manquant")


def test_une_cible_absente_du_socle_est_refusee():
    etat, _ = examiner(modification("nom", "x", "y", cible="Q999999"))
    verifier(etat == "refus", f"attendu refus, obtenu {etat}")


def test_un_champ_non_modifiable_est_refuse():
    for champ in ("notoriete", "sourceUrl", "id"):
        etat, _ = examiner(modification(champ, "1", "2"))
        verifier(etat == "refus", f"{champ} : attendu refus, obtenu {etat}")


def test_les_chevrons_sont_refuses():
    """Le socle alimente une page publique.

    Un chevron n'a rien à faire dans un nom de personne, et tout à faire dans
    une tentative d'injection.
    """
    etat, raison = examiner(
        modification("nom", "Emmanuel Kant", "<script>alert(1)</script>"))
    verifier(etat == "refus", f"attendu refus, obtenu {etat}")
    verifier("chevron" in (raison or ""), "la raison doit nommer les chevrons")


def test_un_texte_trop_long_est_refuse():
    etat, _ = examiner(modification("description", "", "x" * 5000))
    verifier(etat == "refus", f"attendu refus, obtenu {etat}")


def test_les_annees_sont_controlees():
    verifier(examiner(modification("debut", "1724", "-44"))[0] == "accepte",
             "une année avant J.-C. doit passer")
    verifier(examiner(modification("debut", "1724", "mille"))[0] == "refus",
             "un texte n'est pas une année")
    verifier(examiner(modification("debut", "1724", "999999"))[0] == "refus",
             "une année hors bornes doit être refusée")


def test_une_creation_utilise_un_identifiant_provisoire():
    ajout = {"numero": 1, "operation": "ajout",
             "cible": {"type": "personne", "id": "tmp-1"},
             "champ": "nom", "apres": "Jeanne Dupont"}
    etat, _ = examiner(ajout)
    verifier(etat == "accepte", f"un ajout provisoire doit passer, obtenu {etat}")

    ajout_modif = dict(ajout, operation="modification", avant="x")
    verifier(examiner(ajout_modif)[0] == "refus",
             "un identifiant provisoire ne peut pas être modifié : il n'existe pas")


def test_un_fichier_d_une_version_trop_recente_est_refuse():
    import json
    import pathlib
    import tempfile
    with tempfile.TemporaryDirectory() as dossier:
        chemin = pathlib.Path(dossier) / "c.json"
        chemin.write_text(json.dumps({
            "format": "coeval-contributions",
            "version": fusionner.VERSION_MAX + 1, "operations": [],
        }), encoding="utf-8")
        _, refusees, _ = fusionner.examiner([str(chemin)], SOCLE)
        verifier(len(refusees) == 1, "une version inconnue doit être refusée")
        verifier("version" in refusees[0][2], "la raison doit nommer la version")


def main():
    for nom, fonction in sorted(globals().items()):
        if nom.startswith("test_") and callable(fonction):
            fonction()
    if echecs:
        print(f"{len(echecs)} échec(s) :", file=sys.stderr)
        for echec in echecs:
            print(f"  - {echec}", file=sys.stderr)
        return 1
    print("tous les tests de fusion passent")
    return 0


if __name__ == "__main__":
    sys.exit(main())
