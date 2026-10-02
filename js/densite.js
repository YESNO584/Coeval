// L'encart qui dit, sous la frise, ce qu'elle montre et ce qu'elle tait.
//
// Une frise ne se juge pas sur ce qu'elle affiche mais sur ce qu'elle a
// écarté en chemin : un quota, un regroupement, des dates manquantes, un
// socle d'avant-hier, un fichier de contributions posé par-dessus. Tout
// cela est dit ici, en une ligne, plutôt que laissé à deviner.
//
// Sorti de app.js le 2026-10-02 : ce fichier avait dépassé les 250 lignes
// que le vérificateur de code tolère, et ce calcul forme un tout.

import * as socle from "./socle.js";

export function resumerLAffichage(etat, mesure) {
  const details = [`${etat.affichees.length} entrées`, `${mesure.bandes} bandes`];
  if (mesure.horsQuota > 0) {
    details.push(`${mesure.horsQuota} au-delà du quota de ${mesure.plafond} par catégorie`);
  }
  if (mesure.regroupees > 0) {
    details.push(`${mesure.regroupees} réunies sous « autres »`);
  }
  if (mesure.indeterminees > 0) {
    details.push(`${mesure.indeterminees} sans valeur connue`);
  }
  for (const [cle, mot] of Object.entries({
    sansDate: "sans date précise", sansNom: "sans nom",
    doublons: "dates concurrentes arbitrées", sansFin: "sans date de fin"
  })) {
    if (etat.ecartees[cle] > 0) {
      details.push(`${etat.ecartees[cle]} ${mot}`);
    }
  }
  // D'où viennent les données, et de quand elles datent. Une frise qui ne
  // dit pas si elle montre un socle d'avant-hier ou une réponse de Wikidata
  // à l'instant laisse croire à une fraîcheur qu'elle n'a pas.
  const informations = socle.informations();
  if (etat.origines.socle > 0 && informations !== null) {
    details.push(`${etat.origines.socle} du socle du ${informations.fabriqueLe}`);
  }
  if (etat.origines.direct > 0) {
    details.push(`${etat.origines.direct} demandées à Wikidata à l'instant`);
  }
  if (etat.nonCouvertes.length > 0) {
    details.push(`${etat.nonCouvertes.join(", ")} absentes du socle`);
  }
  // Ce que votre fichier a changé dans ce qui est affiché, et les écarts
  // qu'il faut connaître : une nuit de fabrique peut avoir modifié une
  // entrée que vous aviez corrigée. On montre votre version et on le dit.
  const corrigees = etat.affichees.filter((entree) => entree.corrigee === true).length;
  const creees = etat.affichees.filter((entree) => entree.creee === true).length;
  if (corrigees > 0) {
    details.push(`${corrigees} corrigée${corrigees > 1 ? "s" : ""} par votre fichier`);
  }
  if (creees > 0) {
    details.push(`${creees} créée${creees > 1 ? "s" : ""} par vous`);
  }
  if (etat.desaccords.length > 0) {
    const noms = [...new Set(etat.desaccords.map((d) => d.nom))].slice(0, 3);
    details.push(`${etat.desaccords.length} écart${etat.desaccords.length > 1 ? "s" : ""}`
      + ` avec le socle (${noms.join(", ")}) : votre version est affichée`);
  }
  return details.join(" · ");
}
