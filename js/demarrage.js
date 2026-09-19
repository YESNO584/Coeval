// Le branchement de l'édition au reste de la page.
//
// Ce fichier n'existe que pour garder app.js sous le seuil de 250 lignes fixé
// au lot L0 : il ne fait qu'attacher les morceaux les uns aux autres.

import * as edition from "./edition.js";

export function demarrer(contexte) {
  edition.installer({
    detail: document.querySelector("#detail"),
    contenu: document.querySelector("#contenu-detail"),
    barrage: document.querySelector("#barrage"),
    compteur: document.querySelector("#compteur-modifications"),
    retour: document.querySelector("#retour-frise"),
    ajouter: document.querySelector("#ajouter-entree"),
    frise: document.querySelector(".zone-frise"),
  }, {
    annoncer: contexte.annoncer,
    // Refermer le détail rend la frise entière : plus de sélection, plus
    // d'estompage. Sans cela on reviendrait sur une frise à moitié éteinte
    // sans comprendre pourquoi.
    surFermeture: () => {
      if (contexte.etat.selection !== null) {
        contexte.mettreEnEvidence(contexte.svg, []);
        contexte.etat.selection = null;
        contexte.zoneChoix.replaceChildren();
      }
    },
  });
}
