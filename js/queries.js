// Les requêtes envoyées à Wikidata. Du texte, et rien d'autre : aucune
// fonction ici ne touche à l'affichage, pour qu'elles se recopient telles
// quelles dans un portage Flutter.
//
// Trois contraintes mesurées commandent leur forme :
//   - l'indice « hint:rangeSafe » et des dates typées font passer la même
//     requête de 58 s (échec) à 5,7 s ;
//   - demander la notoriété dans la même requête la fait monter à 66 s. Elle
//     se demande séparément, sur une liste fermée : 0,76 s pour 400 ;
//   - demander la précision des dates ne coûte rien, au contraire : 3,1 s
//     contre 5,7 s sans elle (mesuré le 2026-09-18).
// Voir .claude/plan/coeval.md § 3.

const PREFIXE = 'PREFIX hint: <http://www.bigdata.com/queryHints#>';

function liste(identifiants) {
  return identifiants.map((q) => `wd:${q}`).join(" ");
}

function dateTypee(annee) {
  const signe = annee < 0 ? "-" : "";
  const valeur = String(Math.abs(annee)).padStart(4, "0");
  return `"${signe}${valeur}-01-01T00:00:00Z"^^xsd:dateTime`;
}

// R1 — les personnes d'une catégorie dont la vie recouvre une fenêtre.
//
// Chaque personne peut porter plusieurs dates de naissance et de mort
// concurrentes dans Wikidata ; la requête les multiplie, si bien que 400
// lignes ne font que 228 personnes (mesuré). Le filtre « BestRank » réduirait
// les doublons mais coûte 11 s au lieu de 3,1 s et en laisse passer. Ils sont
// donc résolus dans js/model.js, gratuitement et complètement.
export function personnesVivantes(metiers, debut, fin, limite) {
  return `${PREFIXE}
SELECT DISTINCT ?p ?pLabel ?naissance ?precNaissance ?mort ?precMort WHERE {
  VALUES ?metier { ${liste(metiers)} }
  ?p wdt:P106 ?metier .
  ?p p:P569/psv:P569 [ wikibase:timeValue ?naissance ;
                       wikibase:timePrecision ?precNaissance ] .
  hint:Prior hint:rangeSafe true .
  ?p p:P570/psv:P570 [ wikibase:timeValue ?mort ;
                       wikibase:timePrecision ?precMort ] .
  FILTER(?naissance <= ${dateTypee(fin)})
  FILTER(?mort >= ${dateTypee(debut)})
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" }
}
LIMIT ${limite}`;
}

// R2 — la notoriété d'un lot d'identifiants déjà connus.
export function notoriete(identifiants) {
  return `SELECT ?p ?liens WHERE {
  VALUES ?p { ${liste(identifiants)} }
  ?p wikibase:sitelinks ?liens .
}`;
}

// R3 — les souverains dont un règne recouvre la fenêtre.
//
// « COALESCE(?fin, ?debut) » et non « !BOUND(?fin) » : écrite avec BOUND, la
// condition laissait entrer tout règne sans date de fin, quelle que soit sa
// date de début. Constaté le 2026-09-18 — un règne commencé en 2599 av. J.-C.
// s'affichait dans une fenêtre 1780-1805, et étirait la frise sur 4 500 ans.
// Un règne dont on ignore la fin est traité comme s'il s'arrêtait à son
// début : c'est la lecture prudente, et elle ne ment pas sur ce qu'on sait.
//
// Un souverain ne se trouve pas par son métier mais par la fonction qu'il a
// occupée. La fonction porte aussi l'État concerné, ce qui donne le pays d'un
// roi là où sa nationalité ne veut rien dire (R6).
export function souverainsRegnants(debut, fin, limite) {
  return `${PREFIXE}
SELECT DISTINCT ?p ?pLabel ?fonction ?fonctionLabel ?debut ?precDebut ?fin ?precFin
WHERE {
  ?fonction wdt:P279* wd:Q116 .
  ?p p:P39 ?st .
  ?st ps:P39 ?fonction ;
      pqv:P580 [ wikibase:timeValue ?debut ; wikibase:timePrecision ?precDebut ] .
  hint:Prior hint:rangeSafe true .
  OPTIONAL { ?st pqv:P582 [ wikibase:timeValue ?fin ; wikibase:timePrecision ?precFin ] }
  FILTER(?debut <= ${dateTypee(fin)})
  FILTER(COALESCE(?fin, ?debut) >= ${dateTypee(debut)})
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" }
}
LIMIT ${limite}`;
}

// R4 — les événements dont la durée recouvre la fenêtre.
//
// Un événement est soit un instant (un sacre), soit une durée (une guerre).
// Les deux formes vivent dans des propriétés différentes, d'où l'alternative.
export function evenements(classes, debut, fin, limite) {
  return `${PREFIXE}
SELECT DISTINCT ?e ?eLabel ?classeLabel ?instant ?debut ?fin WHERE {
  VALUES ?classe { ${liste(classes)} }
  ?e wdt:P31 ?classe .
  {
    ?e wdt:P585 ?instant . hint:Prior hint:rangeSafe true .
    FILTER(?instant >= ${dateTypee(debut)})
    FILTER(?instant <= ${dateTypee(fin)})
  }
  UNION
  {
    ?e wdt:P580 ?debut . hint:Prior hint:rangeSafe true .
    OPTIONAL { ?e wdt:P582 ?fin }
    FILTER(?debut <= ${dateTypee(fin)})
    FILTER(COALESCE(?fin, ?debut) >= ${dateTypee(debut)})
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" }
}
LIMIT ${limite}`;
}

// R5 — le pays d'un lot de personnes : leur nationalité.
// Demandé à part : dans la requête principale il coûte 13,2 s au lieu de
// 3,1 s ; ici, 1,1 s pour 228 personnes (mesuré le 2026-09-18).
export function paysDePersonnes(identifiants) {
  return `SELECT ?sujet ?paysLabel WHERE {
  VALUES ?sujet { ${liste(identifiants)} }
  ?sujet wdt:P27 ?pays .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" }
}`;
}

// R6 — le pays d'un lot de fonctions souveraines : l'État sur lequel elles
// s'exercent. La juridiction d'abord, le pays à défaut.
export function paysDeFonctions(identifiants) {
  return `SELECT ?sujet ?paysLabel WHERE {
  VALUES ?sujet { ${liste(identifiants)} }
  { ?sujet wdt:P1001 ?pays } UNION { ?sujet wdt:P17 ?pays }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" }
}`;
}

// R7 — le pays d'un lot d'événements. Couverture mesurée : 46 % seulement,
// d'où l'importance de la bande « indéterminé ».
export function paysDEvenements(identifiants) {
  return `SELECT ?sujet ?paysLabel WHERE {
  VALUES ?sujet { ${liste(identifiants)} }
  ?sujet wdt:P17 ?pays .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" }
}`;
}
