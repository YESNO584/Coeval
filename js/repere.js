// Le repère vers le fichier de travail, gardé d'une session à l'autre.
//
// Pourquoi IndexedDB et pas localStorage : un repère de fichier est un objet
// du navigateur, pas du texte. localStorage ne stocke que des chaînes, donc
// il ne peut pas le garder — il garderait un « [object Object] » inutile.
// IndexedDB, lui, sait stocker l'objet tel quel et le rendre après la
// fermeture de l'onglet.
//
// Ce que le navigateur ne permet pas, et qu'il ne faut pas promettre :
//   - il ne donne jamais le chemin du fichier, seulement son nom. C'est une
//     règle de sécurité, pas un manque de notre côté ;
//   - il redemande l'autorisation d'accès à chaque réouverture de la page,
//     et seulement à la suite d'un clic. D'où la fenêtre d'accueil : le clic
//     sur « Reprendre » est ce geste.

const BASE = "coeval";
const MAGASIN = "repere";
const CLE = "fichier-de-travail";

function ouvrirLaBase() {
  return new Promise((resoudre, rejeter) => {
    const demande = indexedDB.open(BASE, 1);
    demande.onupgradeneeded = () => {
      demande.result.createObjectStore(MAGASIN);
    };
    demande.onsuccess = () => resoudre(demande.result);
    demande.onerror = () => rejeter(demande.error);
  });
}

function transaction(mode, action) {
  return ouvrirLaBase().then((base) => new Promise((resoudre, rejeter) => {
    const t = base.transaction(MAGASIN, mode);
    const demande = action(t.objectStore(MAGASIN));
    demande.onsuccess = () => resoudre(demande.result);
    demande.onerror = () => rejeter(demande.error);
  }));
}

// Chaque fonction rend une valeur neutre plutôt que de lever : un navigateur
// en navigation privée peut refuser IndexedDB, et la page doit alors marcher
// sans mémoire du fichier, pas s'arrêter.
export async function garder(fichier) {
  try {
    await transaction("readwrite", (magasin) => magasin.put(fichier, CLE));
    return true;
  } catch (erreur) {
    return false;
  }
}

export async function recuperer() {
  try {
    const garde = await transaction("readonly", (magasin) => magasin.get(CLE));
    return garde === undefined ? null : garde;
  } catch (erreur) {
    return null;
  }
}

export async function oublier() {
  try {
    await transaction("readwrite", (magasin) => magasin.delete(CLE));
    return true;
  } catch (erreur) {
    return false;
  }
}

// L'autorisation d'écrire dans le fichier. 'demander' ne doit être vrai que
// dans la foulée d'un clic : hors d'un geste de l'utilisateur, le navigateur
// refuse sans rien afficher.
export async function autoriser(fichier, demander) {
  const quoi = { mode: "readwrite" };
  if (typeof fichier.queryPermission !== "function") {
    // Tous les repères ne passent pas par le sélecteur de fichiers — ceux du
    // magasin privé du navigateur, par exemple, sont accessibles sans
    // autorisation à redemander.
    return true;
  }
  if (await fichier.queryPermission(quoi) === "granted") {
    return true;
  }
  if (demander !== true) {
    return false;
  }
  return await fichier.requestPermission(quoi) === "granted";
}
