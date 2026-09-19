// L'édition : ouvrir une entrée, la modifier, l'enregistrer.
//
// Ce fichier tient l'enchaînement ; le panneau lui-même est dans
// js/detail.js, le registre des modifications dans js/contributions.js, et
// la règle du retour barré dans js/vues.js.

import * as contributions from "./contributions.js";
import * as detail from "./detail.js";
import * as vues from "./vues.js";

const zones = {};
let rappels = {};
let ouverte = null;
let origine = null;

function majCompteur() {
  const combien = contributions.nombre();
  zones.compteur.textContent = combien === 0
    ? ""
    : `${combien} modification${combien > 1 ? "s" : ""} non enregistrée${combien > 1 ? "s" : ""}`;
}

function afficherLeBarrage() {
  vues.barrerLeRetour(zones.barrage, enregistrerPuisRevenir, abandonner);
}

function surChangement() {
  majCompteur();
  afficherLeBarrage();
}

async function enregistrerPuisRevenir(ailleurs) {
  const nom = await contributions.enregistrer(ailleurs === true);
  if (nom === null) {
    // L'utilisateur a renoncé au moment de choisir où : on ne revient pas,
    // et surtout on ne perd rien.
    rappels.annoncer("Enregistrement abandonné. Vos modifications sont intactes.", true);
    return;
  }
  contributions.vider();
  rappels.annoncer(`Modifications enregistrées dans ${nom}.`);
  fermer();
}

function abandonner() {
  contributions.vider();
  rappels.annoncer("Modifications abandonnées.");
  fermer();
}

function fermer() {
  ouverte = null;
  zones.detail.hidden = true;
  zones.frise.hidden = false;
  majCompteur();
  rappels.surFermeture();
}

export function ouvrir(entree) {
  ouverte = entree;
  // Une copie figée de l'entrée telle qu'elle était : c'est elle qui fournit
  // la valeur « avant » de chaque modification, et qui permet de reconnaître
  // un champ remis à sa valeur d'origine.
  origine = JSON.parse(JSON.stringify(entree));
  zones.frise.hidden = true;
  zones.detail.hidden = false;
  detail.remplir(zones.contenu, entree, origine, surChangement, () => {
    rappels.annoncer("Suppression notée. Elle sera proposée au moment de la fusion.");
  });
  surChangement();
}

export function estOuverte() {
  return ouverte !== null;
}

export function installer(elements, nouveauxRappels) {
  Object.assign(zones, elements);
  rappels = nouveauxRappels;

  zones.retour.addEventListener("click", () => {
    if (contributions.nombre() > 0) {
      // Le retour est barré : on ne se contente pas de refuser, on montre
      // les deux issues.
      afficherLeBarrage();
      zones.barrage.scrollIntoView({ block: "nearest" });
      return;
    }
    fermer();
  });

  zones.ajouter.addEventListener("click", () => {
    ouvrir(detail.entreeNeuve());
    rappels.annoncer("Nouvelle entrée. Son identifiant sera posé à la fusion.");
  });

  vues.installerAvertissementDeFermeture();
  majCompteur();
}
