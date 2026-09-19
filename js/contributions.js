// Le registre des modifications en cours, et son enregistrement en fichier.
//
// Rien n'est envoyé nulle part : tout reste chez le visiteur. Le fichier
// produit suit le contrat de socle/contributions.md, qui est le seul point
// de rencontre entre cette page et le script de fusion.
//
// Deux chemins d'enregistrement, selon ce que le navigateur permet :
//   - Chrome et Edge savent réécrire le même fichier, une fois qu'on l'a
//     désigné. Le repère vers ce fichier survit à la fermeture de la page ;
//   - Firefox et Safari ne le savent pas. Chaque enregistrement y est un
//     téléchargement de plus, et le script de fusion sait en avaler
//     plusieurs.
// Vérifié le 2026-09-18 dans les données de compatibilité de MDN.

import { VERSION_CONTRIBUTIONS, MOTIF_ANNEE } from "./config.js";
import * as socle from "./socle.js";

const operations = [];
let fichier = null;
let creations = 0;

export function nombre() {
  return operations.length;
}

export function liste() {
  return operations;
}

export function vider() {
  operations.length = 0;
  creations = 0;
}

export function identifiantProvisoire() {
  creations += 1;
  return `tmp-${creations}`;
}

// Enregistre une opération. 'avant' est obligatoire sur une modification :
// c'est lui qui permettra de détecter qu'une nuit de fabrique a changé la
// valeur entre-temps.
export function noter(operation, cible, champ, avant, apres, pourquoi) {
  operations.push({
    numero: operations.length + 1,
    faitLe: new Date().toISOString(),
    operation,
    cible,
    champ,
    avant,
    apres,
    pourquoi: pourquoi === undefined ? "" : pourquoi,
  });
}

// Retire la dernière opération portant sur ce champ de cette entrée, s'il y
// en a une. Sert quand on repose la valeur d'origine : inscrire un
// changement nul ferait travailler le script pour rien.
export function oublier(idCible, champ) {
  for (let i = operations.length - 1; i >= 0; i -= 1) {
    if (operations[i].cible.id === idCible && operations[i].champ === champ) {
      operations.splice(i, 1);
      return true;
    }
  }
  return false;
}

export function contenu() {
  const informations = socle.informations();
  return {
    format: "coeval-contributions",
    version: VERSION_CONTRIBUTIONS,
    editeur: "Coeval 0.1",
    socle: { fabriqueLe: informations === null ? null : informations.fabriqueLe },
    operations,
  };
}

export function estUneAnnee(texte) {
  return MOTIF_ANNEE.test(String(texte).trim());
}

function nomParDefaut() {
  const jour = new Date().toISOString().slice(0, 10);
  return `coeval-contributions-${jour}.json`;
}

// Le navigateur sait-il réécrire un fichier désigné ?
export function reecritureDisponible() {
  return typeof window.showSaveFilePicker === "function";
}

async function ecrireDansLeFichier(texte) {
  const flux = await fichier.createWritable();
  await flux.write(texte);
  await flux.close();
}

function telecharger(texte) {
  const lien = document.createElement("a");
  const adresse = URL.createObjectURL(new Blob([texte], { type: "application/json" }));
  lien.href = adresse;
  lien.download = nomParDefaut();
  lien.click();
  URL.revokeObjectURL(adresse);
}

// Enregistre. Renvoie le nom du fichier écrit, ou null si l'utilisateur a
// renoncé au moment de choisir où.
export async function enregistrer(redemander) {
  const texte = JSON.stringify(contenu(), null, 1);
  if (!reecritureDisponible()) {
    telecharger(texte);
    return nomParDefaut();
  }
  if (fichier === null || redemander === true) {
    try {
      fichier = await window.showSaveFilePicker({
        suggestedName: nomParDefaut(),
        types: [{
          description: "Contributions Coeval",
          accept: { "application/json": [".json"] },
        }],
      });
    } catch (erreur) {
      return null;
    }
  }
  await ecrireDansLeFichier(texte);
  return fichier.name;
}

export function fichierChoisi() {
  return fichier === null ? null : fichier.name;
}
