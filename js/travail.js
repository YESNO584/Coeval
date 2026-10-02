// Le fichier de travail, vu de la page : l'accueil, le repère affiché, et le
// changement de fichier.
//
// Trois règles, et elles tiennent ensemble :
//   1. ce qui s'affiche est toujours le socle **plus** le fichier ;
//   2. on ne change pas de fichier en laissant du travail non enregistré ;
//   3. on ne reprend jamais un fichier sans que l'utilisateur l'ait demandé
//      par un clic — le navigateur l'exige pour redonner l'accès, et c'est
//      aussi la bonne manière de ne pas décider à sa place.

import * as contributions from "./contributions.js";
import * as fichier from "./fichier.js";
import { demander } from "./dialogue.js";

let zone = null;
let rappels = { annoncer: () => {}, surChangementDeBase: () => {} };

function etiquette() {
  const nom = fichier.fichierChoisi();
  if (nom === null) {
    return "aucun fichier";
  }
  const combien = contributions.total();
  return combien === 0 ? nom : `${nom} · ${combien}`;
}

export function rafraichirLEtiquette() {
  if (zone === null) {
    return;
  }
  const nom = fichier.fichierChoisi();
  zone.textContent = etiquette();
  zone.dataset.actif = nom === null ? "non" : "oui";
  zone.title = nom === null
    ? "Aucun fichier de travail. Cliquez pour en désigner un."
    : `Fichier de travail : ${nom}. Cliquez pour en changer.`;
}

async function appliquerLeChoix(resultat) {
  rafraichirLEtiquette();
  rappels.annoncer(resultat.operations === 0
    ? `${resultat.nom} : fichier vide, votre travail s'y ajoutera.`
    : `${resultat.nom} : ${resultat.operations} modification`
      + `${resultat.operations > 1 ? "s" : ""} reprise`
      + `${resultat.operations > 1 ? "s" : ""}.`);
  await rappels.surChangementDeBase();
}

// Le clic sur le repère : désigner un autre fichier.
async function changerDeFichier() {
  if (contributions.nombre() > 0) {
    const combien = contributions.nombre();
    const suite = await demander({
      titre: "Modifications en cours",
      texte: [
        combien > 1
          ? `${combien} modifications ne sont pas enregistrées. Changer de`
            + " fichier maintenant les perdrait."
          : "Une modification n'est pas enregistrée. Changer de fichier"
            + " maintenant la perdrait.",
        "Êtes-vous sûr ?",
      ],
      choix: [
        { libelle: "Non, revenir", valeur: "non" },
        { libelle: "Oui, changer et les perdre", valeur: "oui", classe: "bouton-danger" },
      ],
      valeurParDefaut: "non",
    });
    if (suite !== "oui") {
      return;
    }
    contributions.abandonner();
  }
  try {
    const resultat = await fichier.choisirUnFichier();
    if (resultat === null) {
      return;
    }
    await appliquerLeChoix(resultat);
  } catch (erreur) {
    rappels.annoncer(erreur.message, true);
  }
}

// À l'ouverture : proposer de reprendre le dernier fichier, s'il y en a un.
export async function accueillirLeFichier() {
  rafraichirLEtiquette();
  const garde = await fichier.repereGarde();
  if (garde === null) {
    return;
  }
  const suite = await demander({
    titre: "Reprendre votre travail ?",
    texte: [
      `Dernier fichier utilisé : ${garde.nom}.`,
      "Le reprendre affichera la frise corrigée par vos modifications."
      + " Repartir de zéro laissera ce fichier intact ; un nouveau vous sera"
      + " demandé à votre première modification.",
    ],
    choix: [
      { libelle: `Reprendre ${garde.nom}`, valeur: "reprendre", classe: "bouton-principal" },
      { libelle: "Repartir de zéro", valeur: "zero" },
    ],
    valeurParDefaut: "zero",
  });

  if (suite !== "reprendre") {
    await fichier.repartirDeZero();
    rafraichirLEtiquette();
    rappels.annoncer("Reparti de zéro. Un fichier vous sera demandé à votre"
      + " première modification.");
    return;
  }
  try {
    await appliquerLeChoix(await fichier.reprendreLeRepere(garde.fichier));
  } catch (erreur) {
    rappels.annoncer(`${erreur.message} Cliquez sur le nom du fichier en haut`
      + " à droite pour le redésigner.", true);
    rafraichirLEtiquette();
  }
}

export function installer(element, surChangementDeBase, annoncer) {
  zone = element;
  rappels = { annoncer, surChangementDeBase };
  zone.addEventListener("click", changerDeFichier);
  if (!fichier.reecritureDisponible()) {
    // Firefox et Safari n'ont pas de repère de fichier : chaque
    // enregistrement y est un téléchargement, et il n'y a rien à rouvrir.
    zone.hidden = true;
    return;
  }
  rafraichirLEtiquette();
}
