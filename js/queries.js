// Les requêtes envoyées à Wikidata. Du texte, et rien d'autre : aucune
// fonction ici ne touche à l'affichage, pour qu'elles se recopient telles
// quelles dans un portage Flutter.
//
// Deux contraintes mesurées le 2026-09-18 commandent leur forme :
//   - l'indice « hint:rangeSafe » et des dates typées font passer la même
//     requête de 58 s (échec) à 5,7 s ;
//   - demander la notoriété dans la même requête la fait monter à 66 s, au
//     delà du budget du service. Elle se demande donc séparément, sur une
//     liste fermée d'identifiants : 0,76 s pour 400.
// Voir .claude/plan/coeval.md § 3.4 et § 3.5.

const PREFIXE = 'PREFIX hint: <http://www.bigdata.com/queryHints#>';

function dateTypee(annee) {
  const signe = annee < 0 ? "-" : "";
  const valeur = String(Math.abs(annee)).padStart(4, "0");
  return `"${signe}${valeur}-01-01T00:00:00Z"^^xsd:dateTime`;
}

// R1 — les personnes d'une catégorie dont la vie recouvre une fenêtre.
// Une catégorie × une fenêtre par requête : au-delà, le service renonce.
export function personnesVivantes(metiers, debut, fin, limite) {
  const valeurs = metiers.map((q) => `wd:${q}`).join(" ");
  return `${PREFIXE}
SELECT DISTINCT ?p ?pLabel ?naissance ?mort WHERE {
  VALUES ?metier { ${valeurs} }
  ?p wdt:P106 ?metier .
  ?p wdt:P569 ?naissance . hint:Prior hint:rangeSafe true .
  ?p wdt:P570 ?mort . hint:Prior hint:rangeSafe true .
  FILTER(?naissance <= ${dateTypee(fin)})
  FILTER(?mort >= ${dateTypee(debut)})
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" }
}
LIMIT ${limite}`;
}

// R2 — la notoriété d'un lot d'identifiants déjà connus.
// La liste est fermée, donc le service répond en moins d'une seconde.
export function notoriete(identifiants) {
  const valeurs = identifiants.map((q) => `wd:${q}`).join(" ");
  return `SELECT ?p ?liens WHERE {
  VALUES ?p { ${valeurs} }
  ?p wikibase:sitelinks ?liens .
}`;
}
