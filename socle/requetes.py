#!/usr/bin/env python3
"""Les requêtes SPARQL de la fabrique.

Du texte, et rien d'autre : aucune fonction ici ne touche au reste. C'est ce
qui permettra de les recopier telles quelles dans un portage.

Deux formes obligatoires, l'une et l'autre mesurées le 2026-09-18 :

- « hint:rangeSafe » plus des dates typées : la même requête passe de 58 s
  (échec) à 5,7 s. Ne jamais filtrer avec YEAR(), qui force la lecture de
  toutes les lignes ;
- « COALESCE(?fin, ?debut) » et non « !BOUND(?fin) » : écrite avec BOUND, la
  condition laissait entrer un règne commencé en 2599 av. J.-C. dans une
  fenêtre du XVIIIe siècle.
"""

PREFIXE = "PREFIX hint: <http://www.bigdata.com/queryHints#>"


def _liste(identifiants):
    return " ".join("wd:" + i for i in identifiants)


def _date(annee):
    signe = "-" if annee < 0 else ""
    return f'"{signe}{abs(annee):04d}-01-01T00:00:00Z"^^xsd:dateTime'


def personnes_vivantes(metiers, debut, fin, limite):
    return f"""{PREFIXE}
SELECT DISTINCT ?p ?pLabel ?naissance ?precNaissance ?mort ?precMort WHERE {{
  VALUES ?metier {{ {_liste(metiers)} }}
  ?p wdt:P106 ?metier .
  ?p p:P569/psv:P569 [ wikibase:timeValue ?naissance ;
                       wikibase:timePrecision ?precNaissance ] .
  hint:Prior hint:rangeSafe true .
  ?p p:P570/psv:P570 [ wikibase:timeValue ?mort ;
                       wikibase:timePrecision ?precMort ] .
  FILTER(?naissance <= {_date(fin)})
  FILTER(?mort >= {_date(debut)})
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "fr,en" }}
}}
LIMIT {limite}"""


def souverains_regnants(fonctions, debut, fin, limite):
    """Le périmètre des fonctions est écrit à la main dans perimetre.json.

    La requête générique « tout ce qui descend de monarque » ramenait surtout
    des évêques-princes : leurs charges sont des souverainetés dans l'arbre
    de classes de Wikidata, ce qui est exact mais pas ce qu'on veut montrer.
    """
    return f"""{PREFIXE}
SELECT DISTINCT ?p ?pLabel ?fonction ?fonctionLabel ?debut ?precDebut ?fin ?precFin
WHERE {{
  VALUES ?fonction {{ {_liste(fonctions)} }}
  ?p p:P39 ?st .
  ?st ps:P39 ?fonction ;
      pqv:P580 [ wikibase:timeValue ?debut ; wikibase:timePrecision ?precDebut ] .
  hint:Prior hint:rangeSafe true .
  OPTIONAL {{ ?st pqv:P582 [ wikibase:timeValue ?fin ; wikibase:timePrecision ?precFin ] }}
  FILTER(?debut <= {_date(fin)})
  FILTER(COALESCE(?fin, ?debut) >= {_date(debut)})
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "fr,en" }}
}}
LIMIT {limite}"""


def evenements(classes, debut, fin, limite):
    return f"""{PREFIXE}
SELECT DISTINCT ?e ?eLabel ?classeLabel ?instant ?debut ?fin WHERE {{
  VALUES ?classe {{ {_liste(classes)} }}
  ?e wdt:P31 ?classe .
  {{
    ?e wdt:P585 ?instant . hint:Prior hint:rangeSafe true .
    FILTER(?instant >= {_date(debut)})
    FILTER(?instant <= {_date(fin)})
  }}
  UNION
  {{
    ?e wdt:P580 ?debut . hint:Prior hint:rangeSafe true .
    OPTIONAL {{ ?e wdt:P582 ?fin }}
    FILTER(?debut <= {_date(fin)})
    FILTER(COALESCE(?fin, ?debut) >= {_date(debut)})
  }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "fr,en" }}
}}
LIMIT {limite}"""


def notoriete(identifiants):
    return f"""SELECT ?sujet ?liens WHERE {{
  VALUES ?sujet {{ {_liste(identifiants)} }}
  ?sujet wikibase:sitelinks ?liens .
}}"""


def pays_de_personnes(identifiants):
    return f"""SELECT ?sujet ?paysLabel WHERE {{
  VALUES ?sujet {{ {_liste(identifiants)} }}
  ?sujet wdt:P27 ?pays .
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "fr,en" }}
}}"""


def pays_de_fonctions(identifiants):
    """La juridiction d'abord, le pays à défaut : c'est la fonction qui porte
    l'État d'un souverain, pas sa nationalité."""
    return f"""SELECT ?sujet ?paysLabel WHERE {{
  VALUES ?sujet {{ {_liste(identifiants)} }}
  {{ ?sujet wdt:P1001 ?pays }} UNION {{ ?sujet wdt:P17 ?pays }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "fr,en" }}
}}"""


def pays_d_evenements(identifiants):
    return f"""SELECT ?sujet ?paysLabel WHERE {{
  VALUES ?sujet {{ {_liste(identifiants)} }}
  ?sujet wdt:P17 ?pays .
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "fr,en" }}
}}"""
