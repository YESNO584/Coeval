#!/usr/bin/env python3
"""Transforme les réponses de Wikidata en entrées, et compte les écartées.

Les règles viennent de mesures, pas de principes :

- 400 lignes ne font que 227 personnes : chacune porte plusieurs dates
  concurrentes, et la requête multiplie les combinaisons. On arbitre ici,
  gratuitement, plutôt qu'avec le filtre « BestRank » qui coûte 11,1 s au
  lieu de 3,1 s et en laisse passer un tiers ;
- une entrée sans nom ne s'affiche jamais. Quand Wikidata n'a pas de
  libellé, son service de noms renvoie l'identifiant lui-même ;
- une date moins précise que l'année n'est pas plaçable sur une frise.
"""
import re

FORME_IDENTIFIANT = re.compile(r"^Q\d+$")
FORME_DATE = re.compile(r"^(-?\d{4,})-(\d{2})-(\d{2})")
PRECISION_ANNEE = 9
NOMS_PRECISION = {9: "année", 10: "mois", 11: "jour"}


def identifiant(url):
    return url.rsplit("/", 1)[-1]


def valeur(ligne, nom):
    """Lit un champ sans supposer qu'il est là. Une réponse inattendue doit
    faire écarter une ligne, jamais interrompre la fabrique."""
    champ = ligne.get(nom)
    return None if champ is None else champ.get("value")


def date(brut, code_precision):
    if brut is None or code_precision is None:
        return None
    trouve = FORME_DATE.match(brut)
    try:
        code = int(code_precision)
    except (TypeError, ValueError):
        return None
    if trouve is None or code < PRECISION_ANNEE:
        return None
    return {
        "annee": int(trouve.group(1)),
        "code": code,
        "precision": NOMS_PRECISION.get(code, "année"),
        "approximative": code == PRECISION_ANNEE,
        # La date complète sert à départager deux valeurs de même précision.
        # Comparer les seules années ne distingue pas le 4 du 5 mars 1827 —
        # les deux dates de mort concurrentes de Laplace, justement.
        "brut": brut,
    }


def meilleure(connue, candidate):
    """Entre deux dates concurrentes, la plus précise ; à précision égale, la
    plus ancienne, pour que deux exécutions donnent le même socle."""
    if connue is None:
        return candidate
    if candidate["code"] != connue["code"]:
        return candidate if candidate["code"] > connue["code"] else connue
    return candidate if candidate["brut"] < connue["brut"] else connue


def _nouvelle(id_sujet, cle, type_entree, nom, debut, fin, categorie, detail, instantane):
    return {
        "id": cle,
        "idSujet": id_sujet,
        "type": type_entree,
        "nom": nom,
        "detail": detail,
        "debut": debut,
        "fin": fin,
        "instantane": instantane,
        "categories": [categorie],
        "pays": [],
        "notoriete": None,
        "sourceUrl": f"https://www.wikidata.org/wiki/{id_sujet}",
    }


def _nom_valide(nom, ecartees):
    if not nom or FORME_IDENTIFIANT.match(nom):
        ecartees["sansNom"] += 1
        return False
    return True


def convertir_personnes(lignes, categorie, noms=None):
    """'noms' porte les libellés, demandés par une requête à part.

    Les garder dans la requête principale la faisait échouer sur les
    catégories à gros effectifs — voir requetes.libelles.
    """
    noms = noms or {}
    retenues, ecartees = {}, {"sansDate": 0, "sansNom": 0, "doublons": 0}
    for ligne in lignes:
        url = valeur(ligne, "p")
        if url is None:
            ecartees["sansDate"] += 1
            continue
        nom = valeur(ligne, "pLabel") or noms.get(identifiant(url), "")
        if not _nom_valide(nom, ecartees):
            continue
        debut = date(valeur(ligne, "naissance"), valeur(ligne, "precNaissance"))
        fin = date(valeur(ligne, "mort"), valeur(ligne, "precMort"))
        if debut is None or fin is None:
            ecartees["sansDate"] += 1
            continue
        cle = identifiant(url)
        if cle in retenues:
            ecartees["doublons"] += 1
            retenues[cle]["debut"] = meilleure(retenues[cle]["debut"], debut)
            retenues[cle]["fin"] = meilleure(retenues[cle]["fin"], fin)
            continue
        retenues[cle] = _nouvelle(cle, cle, "personne", nom, debut, fin, categorie, "", False)
    return list(retenues.values()), ecartees


def convertir_souverains(lignes, noms=None):
    """Un règne est une entrée : deux trônes occupés donnent deux barres."""
    noms = noms or {}
    retenues, ecartees = {}, {"sansDate": 0, "sansNom": 0, "doublons": 0}
    for ligne in lignes:
        url, url_fonction = valeur(ligne, "p"), valeur(ligne, "fonction")
        if url is None or url_fonction is None:
            ecartees["sansDate"] += 1
            continue
        nom = valeur(ligne, "pLabel") or noms.get(identifiant(url), "")
        if not _nom_valide(nom, ecartees):
            continue
        debut = date(valeur(ligne, "debut"), valeur(ligne, "precDebut"))
        fin = debut if valeur(ligne, "fin") is None else date(
            valeur(ligne, "fin"), valeur(ligne, "precFin"))
        if debut is None or fin is None:
            ecartees["sansDate"] += 1
            continue
        sujet, fonction = identifiant(url), identifiant(url_fonction)
        cle = f"{sujet}:{fonction}"
        if cle in retenues:
            ecartees["doublons"] += 1
            retenues[cle]["debut"] = meilleure(retenues[cle]["debut"], debut)
            retenues[cle]["fin"] = meilleure(retenues[cle]["fin"], fin)
            continue
        entree = _nouvelle(sujet, cle, "souverain", nom, debut, fin, "souverains",
                           valeur(ligne, "fonctionLabel") or "", False)
        entree["idFonction"] = fonction
        retenues[cle] = entree
    return list(retenues.values()), ecartees


def convertir_evenements(lignes, noms=None):
    noms = noms or {}
    retenues = {}
    ecartees = {"sansDate": 0, "sansNom": 0, "doublons": 0, "sansFin": 0}
    for ligne in lignes:
        url = valeur(ligne, "e")
        if url is None:
            ecartees["sansDate"] += 1
            continue
        nom = valeur(ligne, "eLabel") or noms.get(identifiant(url), "")
        if not _nom_valide(nom, ecartees):
            continue
        instant = valeur(ligne, "instant")
        ponctuel = instant is not None
        debut = date(instant if ponctuel else valeur(ligne, "debut"), "11")
        brut_fin = valeur(ligne, "fin")
        fin = debut if (ponctuel or brut_fin is None) else date(brut_fin, "11")
        if debut is None or fin is None:
            ecartees["sansDate"] += 1
            continue
        if not ponctuel and brut_fin is None:
            ecartees["sansFin"] += 1
        cle = identifiant(url)
        if cle in retenues:
            ecartees["doublons"] += 1
            continue
        retenues[cle] = _nouvelle(
            cle, cle, "evenement", nom, debut, fin, "evenements",
            valeur(ligne, "classeLabel")
            or noms.get(identifiant(valeur(ligne, "classe") or ""), ""), ponctuel or debut["annee"] == fin["annee"])
    return list(retenues.values()), ecartees


def attacher(entrees, lignes, cle_entree, champ, transforme=None):
    """Rattache un attribut demandé à part (notoriété, pays) à ses entrées."""
    par_sujet = {}
    for ligne in lignes:
        url, brut = valeur(ligne, "sujet"), valeur(ligne, champ)
        if url is None or brut is None:
            continue
        par_sujet.setdefault(identifiant(url), []).append(brut)
    for entree in entrees:
        trouves = par_sujet.get(entree.get(cle_entree))
        if trouves is not None:
            entree[champ if transforme is None else transforme] = trouves
    return entrees
