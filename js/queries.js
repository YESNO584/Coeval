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
  const valeurs = metiers.map((q) => `wd:${q}`).join(" ");
  return `${PREFIXE}
SELECT DISTINCT ?p ?pLabel ?naissance ?precNaissance ?mort ?precMort WHERE {
  VALUES ?metier { ${valeurs} }
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
  const valeurs = identifiants.map((q) => `wd:${q}`).join(" ");
  return `SELECT ?p ?liens WHERE {
  VALUES ?p { ${valeurs} }
  ?p wikibase:sitelinks ?liens .
}`;
}
