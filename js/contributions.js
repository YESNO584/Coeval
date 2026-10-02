// Le registre des modifications en cours.
//
// Il porte **tout** le contenu du fichier de travail : ce qui en a été relu
// au démarrage, et ce qui a été fait depuis. Jusqu'au 2026-10-02 il était
// vidé après chaque enregistrement, et le deuxième enregistrement dans le
// même fichier effaçait le premier — le « fichier cumulatif » ne cumulait
// rien. La vérification d'alors ne pouvait pas le voir : elle enregistrait
// une seule fois.
//
// L'écriture et la lecture du fichier sont dans js/fichier.js. Ce fichier-ci
// ne connaît que la liste d'opérations et le contrat de
// socle/contributions.md.

import { VERSION_CONTRIBUTIONS, MOTIF_ANNEE } from "./config.js";
import * as socle from "./socle.js";

const operations = [];
// Combien d'opérations sont déjà dans le fichier. Tout ce qui est au-delà
// n'est pas enregistré — c'est cela que compte le bandeau de retour.
let enregistrees = 0;
let fichier = null;
let creations = 0;

export function nombre() {
  return operations.length - enregistrees;
}

export function total() {
  return operations.length;
}

export function liste() {
  return operations;
}

// Abandonne ce qui n'est pas enregistré, et garde ce qui l'est : le fichier
// reste la base de travail même quand on renonce aux dernières corrections.
export function abandonner() {
  operations.length = enregistrees;
  creations = 0;
}

export function identifiantProvisoire() {
  creations += 1;
  return `tmp-${Date.now()}-${creations}`;
}

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
// en a une **et qu'elle n'est pas déjà enregistrée**. Sert quand on repose la
// valeur d'origine. Une opération déjà écrite dans le fichier ne se retire
// pas en silence : elle serait perdue pour le script de fusion.
export function oublier(idCible, champ) {
  for (let i = operations.length - 1; i >= enregistrees; i -= 1) {
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
    operations: operations.map((operation, rang) => ({ ...operation, numero: rang + 1 })),
  };
}

export function estUneAnnee(texte) {
  return MOTIF_ANNEE.test(String(texte).trim());
}


// Remplace tout le registre par ce qu'un fichier contenait. Tout est alors
// « enregistré » : c'est l'état du fichier sur le disque.
export function remplacerPar(lues) {
  operations.length = 0;
  operations.push(...lues);
  enregistrees = operations.length;
  creations = 0;
}

// Tout ce qui est en mémoire est maintenant dans le fichier.
export function marquerEnregistre() {
  enregistrees = operations.length;
}

// Oublie tout, y compris ce qui était enregistré : « repartir de zéro ».
export function toutOublier() {
  operations.length = 0;
  enregistrees = 0;
  creations = 0;
}
