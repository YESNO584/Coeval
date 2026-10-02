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
        conflits = fusionner.verifier_operation(operation, SOCLE)
    except fusionner.Refus as souci:
        return ("refus", str(souci))
    if not conflits:
        return ("accepte", None)
    return ("conflit", " ; ".join(f"{c} : {r}" for c, r in conflits.items()))


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


# --- La version 2 : une opération par entité ---
#
# Elle existe parce qu'une opération par champ répétait la cible à chaque
# ligne. Le principe ne change pas : seuls les champs touchés, chacun avec
# la valeur vue. Ce qui change est la forme, et les deux doivent se lire —
# un fichier enregistré avant le changement porte du travail réel.

def groupee(champs, cible="Q9312", operation="modification"):
    return {"numero": 1, "operation": operation,
            "cible": {"type": "personne", "id": cible}, "champs": champs}


def test_une_operation_groupee_passe():
    etat, _ = examiner(groupee({
        "nom": {"avant": "Emmanuel Kant", "apres": "Immanuel Kant"},
        "debut": {"avant": "1724", "apres": "1725"},
    }))
    verifier(etat == "accepte", f"attendu accepté, obtenu {etat}")


def test_un_seul_champ_perime_suffit_a_faire_un_conflit():
    """Trois champs justes et un dépassé : c'est un conflit, et il nomme
    lequel. S'arrêter au premier champ examiné cacherait les autres."""
    etat, raison = examiner(groupee({
        "nom": {"avant": "Emmanuel Kant", "apres": "Immanuel Kant"},
        "fin": {"avant": "1800", "apres": "1805"},
    }))
    verifier(etat == "conflit", f"attendu conflit, obtenu {etat}")
    verifier(raison is not None and "fin" in raison,
             f"le conflit doit nommer le champ en cause : {raison}")
    verifier(raison is not None and "nom" not in raison,
             f"il ne doit pas accuser un champ à jour : {raison}")


def test_les_deux_versions_se_lisent_pareil():
    une = fusionner.champs_de(modification("nom", "Emmanuel Kant", "Immanuel Kant"))
    deux = fusionner.champs_de(groupee({
        "nom": {"avant": "Emmanuel Kant", "apres": "Immanuel Kant"}}))
    verifier(une == deux, f"version 1 et version 2 doivent donner la même "
                          f"chose : {une} contre {deux}")


def test_une_operation_sans_aucun_champ_est_refusee():
    etat, raison = examiner(groupee({}))
    verifier(etat == "refus", f"attendu refus, obtenu {etat}")
    verifier(raison is not None and "ne dit rien" in raison, f"raison : {raison}")


def test_un_champ_inconnu_est_refuse_aussi_en_version_2():
    etat, _ = examiner(groupee({"notoriete": {"avant": "1", "apres": "999"}}))
    verifier(etat == "refus", f"attendu refus, obtenu {etat}")


def test_les_chevrons_sont_refuses_aussi_en_version_2():
    etat, _ = examiner(groupee({
        "nom": {"avant": "Emmanuel Kant", "apres": "<script>alert(1)</script>"}}))
    verifier(etat == "refus", f"attendu refus, obtenu {etat}")


def test_une_creation_groupee_passe():
    etat, _ = examiner(groupee({"nom": {"apres": "Une personne"}},
                               cible="tmp-1", operation="ajout"))
    verifier(etat == "accepte", f"attendu accepté, obtenu {etat}")


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
