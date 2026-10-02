// Le registre des modifications en cours.
//
// Il porte **tout** le contenu du fichier de travail : ce qui en a été relu
// au démarrage, et ce qui a été fait depuis.
//
// **Une opération par entité**, et non une par champ. Corriger quatre champs
// d'une personne ne produit qu'une ligne, qui liste les quatre. Les retouches
// successives d'un même champ se rejoignent : on garde le « avant » de la
// première — la valeur du socle qu'on avait sous les yeux, celle qui sert au
// contrôle de conflit — et le « apres » de la dernière.
//
// Ce qui ne change pas, et ne doit pas changer : **seuls les champs touchés
// sont écrits, chacun avec la valeur vue.** Une copie de l'entité entière
// serait une copie d'une base qui bouge toutes les nuits, et chacun de ses
// champs non modifiés affirmerait « cette valeur est juste » sans que
// personne l'ait dit.
//
// L'écriture et la lecture du fichier sont dans js/fichier.js.

import { VERSION_CONTRIBUTIONS, MOTIF_ANNEE } from "./config.js";
import * as socle from "./socle.js";

let operations = [];
// L'état du registre au dernier enregistrement. Il sert à deux choses :
// revenir en arrière quand on abandonne, et compter ce qui reste à écrire.
let enregistre = [];
let creations = 0;

function copier(liste) {
  return JSON.parse(JSON.stringify(liste));
}

// Chaque valeur du registre, repérée par son entité et son champ. Une
// suppression porte sur l'entrée entière : elle a sa propre clé.
function valeurs(liste) {
  const par = new Map();
  for (const operation of liste) {
    const id = operation.cible.id;
    if (operation.operation === "suppression") {
      par.set(`${id}\u0000supprimée`, true);
      continue;
    }
    for (const [champ, valeur] of Object.entries(operation.champs || {})) {
      par.set(`${id}\u0000${champ}`, valeur.apres);
    }
  }
  return par;
}

// Ce qui n'est pas encore dans le fichier, compté par champ et non par
// geste. Retoucher trois fois le même champ ne fait qu'une modification à
// écrire ; le reposer à sa valeur d'origine n'en fait aucune. Un compteur
// de gestes annonçait « 3 modifications » pour un seul champ changé.
export function nombre() {
  const avant = valeurs(enregistre);
  const maintenant = valeurs(operations);
  let compte = 0;
  for (const [cle, valeur] of maintenant) {
    if (!avant.has(cle) || avant.get(cle) !== valeur) {
      compte += 1;
    }
  }
  for (const cle of avant.keys()) {
    if (!maintenant.has(cle)) {
      compte += 1;
    }
  }
  return compte;
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
  operations = copier(enregistre);
  creations = 0;
}

export function identifiantProvisoire() {
  creations += 1;
  return `tmp-${Date.now()}-${creations}`;
}

function trouver(quoi, id) {
  return operations.find(
    (operation) => operation.operation === quoi && operation.cible.id === id);
}

// Note une correction de champ. 'avant' est la valeur du socle ; elle n'est
// retenue que la première fois qu'on touche ce champ.
export function noter(quoi, cible, champ, avant, apres, pourquoi) {
  let operation = trouver(quoi, cible.id);
  if (operation === undefined) {
    operation = {
      numero: operations.length + 1,
      faitLe: new Date().toISOString(),
      operation: quoi,
      cible,
      champs: {},
      pourquoi: pourquoi === undefined ? "" : pourquoi,
    };
    operations.push(operation);
  }
  operation.faitLe = new Date().toISOString();
  if (pourquoi !== undefined && pourquoi !== "") {
    operation.pourquoi = pourquoi;
  }
  const connu = operation.champs[champ];
  operation.champs[champ] = {
    // Le premier « avant » est le bon : c'est la valeur du socle. Celui
    // d'une deuxième retouche serait notre propre correction précédente, et
    // le contrôle de conflit ne vérifierait plus rien.
    avant: connu === undefined ? avant : connu.avant,
    apres,
  };
  if (avant === undefined && connu === undefined) {
    delete operation.champs[champ].avant;
  }
}

// Note une suppression. Elle ne porte pas de champs : c'est l'entrée entière
// qui est en cause.
export function noterSuppression(cible, nom) {
  const connue = trouver("suppression", cible.id);
  if (connue !== undefined) {
    return;
  }
  operations.push({
    numero: operations.length + 1,
    faitLe: new Date().toISOString(),
    operation: "suppression",
    cible,
    avant: nom,
    pourquoi: "",
  });
}

// Retire un champ d'une opération : sert quand on repose la valeur
// d'origine. Une opération qui n'a plus aucun champ disparaît — elle ne dit
// plus rien.
export function oublier(idCible, champ) {
  for (let i = operations.length - 1; i >= 0; i -= 1) {
    const operation = operations[i];
    if (operation.cible.id !== idCible || operation.champs === undefined) {
      continue;
    }
    if (operation.champs[champ] === undefined) {
      continue;
    }
    delete operation.champs[champ];
    if (Object.keys(operation.champs).length === 0) {
      operations.splice(i, 1);
    }
    return true;
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
  operations = copier(lues);
  enregistre = copier(lues);
  creations = 0;
}

// Tout ce qui est en mémoire est maintenant dans le fichier.
export function marquerEnregistre() {
  enregistre = copier(operations);
}

// Oublie tout, y compris ce qui était enregistré : « repartir de zéro ».
export function toutOublier() {
  operations = [];
  enregistre = [];
  creations = 0;
}
