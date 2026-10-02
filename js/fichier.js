// Le fichier de travail : le désigner, le lire, l'écrire.
//
// **Le fichier est la base de travail, pas une sortie.** La page le lit au
// démarrage, y ajoute ce que vous faites, et le réécrit entier. Le registre
// des opérations vit dans js/contributions.js ; ce fichier-ci ne s'occupe
// que du disque.
//
// Chrome et Edge savent rouvrir un fichier désigné, et c'est sur eux que
// repose ce mécanisme. Les autres navigateurs n'ont pas
// « showSaveFilePicker » : chaque enregistrement y est un téléchargement de
// plus, et le script de fusion sait en avaler plusieurs.
//
// Deux limites du navigateur, qu'il ne faut pas promettre autrement :
// il ne donne jamais le chemin d'un fichier, seulement son nom ; et il
// redemande l'autorisation d'accès à chaque réouverture de la page, à la
// suite d'un clic seulement.

import { VERSION_CONTRIBUTIONS } from "./config.js";
import * as contributions from "./contributions.js";
import * as repere from "./repere.js";

let fichier = null;

function nomParDefaut() {
  const jour = new Date().toISOString().slice(0, 10);
  return `coeval-contributions-${jour}.json`;
}

export function reecritureDisponible() {
  return typeof window.showSaveFilePicker === "function";
}

export function fichierChoisi() {
  return fichier === null ? null : fichier.name;
}

// Oublie le fichier et tout ce qu'il portait : « repartir de zéro ». Le
// prochain enregistrement redemandera où créer le nouveau fichier, et
// celui-là deviendra la référence.
export async function repartirDeZero() {
  contributions.toutOublier();
  fichier = null;
  await repere.oublier();
}

function verifierLeContenu(lu) {
  if (lu === null || typeof lu !== "object") {
    throw new Error("Ce fichier n'est pas un fichier de contributions Coeval.");
  }
  if (lu.format !== "coeval-contributions") {
    throw new Error("Ce fichier n'est pas un fichier de contributions Coeval.");
  }
  if (lu.version !== VERSION_CONTRIBUTIONS) {
    throw new Error(
      `Ce fichier est en version ${lu.version}, la page écrit la version `
      + `${VERSION_CONTRIBUTIONS}. Il n'est pas relu, pour ne rien abîmer.`);
  }
  if (!Array.isArray(lu.operations)) {
    throw new Error("Ce fichier ne contient aucune liste d'opérations.");
  }
  return lu.operations;
}

// Lit un fichier et en fait la base de travail. Lève si le fichier ne se
// laisse pas lire : mieux vaut le dire que repartir de zéro en silence.
export async function charger(choisi) {
  const texte = (await (await choisi.getFile()).text()).trim();
  let lues = [];
  if (texte !== "") {
    // Un fichier tout juste créé est vide : ce n'est pas une anomalie.
    let lu = null;
    try {
      lu = JSON.parse(texte);
    } catch (erreur) {
      throw new Error("Ce fichier n'est pas lisible : " + erreur.message);
    }
    lues = verifierLeContenu(lu);
  }
  contributions.remplacerPar(lues);
  fichier = choisi;
  await repere.garder(choisi);
  return { nom: choisi.name, operations: lues.length };
}

const TYPES = [{
  description: "Contributions Coeval",
  accept: { "application/json": [".json"] },
}];

// Ouvre un sélecteur et rend le repère choisi, sans toucher au registre.
// Rend null si l'utilisateur renonce — ce n'est pas une erreur.
async function demander(pourCreer) {
  try {
    if (pourCreer) {
      return await window.showSaveFilePicker({
        suggestedName: nomParDefaut(), types: TYPES,
      });
    }
    return (await window.showOpenFilePicker({ multiple: false, types: TYPES }))[0];
  } catch (erreur) {
    return null;
  }
}

// Désigne un fichier existant et le prend pour base de travail.
export async function choisirUnFichier() {
  const choisi = await demander(false);
  return choisi === null ? null : charger(choisi);
}

// Le fichier gardé d'une session à l'autre, s'il y en a un et s'il existe
// encore. Ne demande aucune autorisation : cette fonction sert à savoir s'il
// faut proposer quelque chose, pas à ouvrir quoi que ce soit.
export async function repereGarde() {
  if (!reecritureDisponible()) {
    return null;
  }
  const garde = await repere.recuperer();
  return garde === null ? null : { fichier: garde, nom: garde.name };
}

// Reprend le fichier gardé. À n'appeler que dans la foulée d'un clic : le
// navigateur ne demande son autorisation qu'à ce moment-là.
export async function reprendreLeRepere(garde) {
  if (!await repere.autoriser(garde, true)) {
    throw new Error("Le navigateur n'a pas autorisé l'accès à ce fichier.");
  }
  return charger(garde);
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

// Enregistre tout le registre — la base relue et les nouvelles opérations.
// Renvoie le nom du fichier écrit, ou null si l'utilisateur a renoncé au
// moment de choisir où.
export async function enregistrer(redemander) {
  const texte = JSON.stringify(contributions.contenu(), null, 1);
  if (!reecritureDisponible()) {
    telecharger(texte);
    contributions.marquerEnregistre();
    return nomParDefaut();
  }
  if (fichier === null || redemander === true) {
    // On demande le repère sans rien changer au registre : ce qui est en
    // cours doit être écrit dans le fichier qu'on vient de désigner, pas
    // perdu en le désignant.
    const choisi = await demander(true);
    if (choisi === null) {
      return null;
    }
    fichier = choisi;
  }
  await ecrireDansLeFichier(texte);
  contributions.marquerEnregistre();
  await repere.garder(fichier);
  return fichier.name;
}
