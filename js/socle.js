// Lecture du socle : les fichiers fabriqués chaque nuit et publiés à côté
// de la page.
//
// Le socle est facultatif, et ce n'est pas un détail. Il se construit sur
// plusieurs nuits — Wikidata limite le débit d'un client persévérant — donc
// la page doit fonctionner avec un socle absent, partiel, ou complet, sans
// que le visiteur ait à le savoir. Ce qui manque est demandé en direct.

import { CHEMIN_SOCLE } from "./config.js";

let index = null;
let consulte = false;
const siecles = new Map();

function debutDuSiecle(annee) {
  return Math.floor(annee / 100) * 100;
}

// Les siècles que traverse une fenêtre, bornes comprises.
export function siecleseTraverses(debut, fin) {
  const liste = [];
  for (let s = debutDuSiecle(debut); s <= debutDuSiecle(fin); s += 100) {
    liste.push(s);
  }
  return liste;
}

// Ouvre l'index du socle. Son absence n'est pas une erreur : elle signifie
// que rien n'a encore été fabriqué, et la page se rabat sur le direct.
export async function ouvrir() {
  if (consulte) {
    return index;
  }
  consulte = true;
  try {
    const reponse = await fetch(`${CHEMIN_SOCLE}/index.json`, { cache: "no-cache" });
    index = reponse.ok ? await reponse.json() : null;
  } catch (erreur) {
    index = null;
  }
  return index;
}

export function informations() {
  return index;
}

// Le socle couvre-t-il cette catégorie sur toute cette fenêtre ?
//
// Il faut que chaque siècle traversé ait été fabriqué pour cette catégorie.
// Un seul trou et on redemande tout en direct : mélanger un siècle du socle
// et un siècle en direct donnerait une frise dont la densité varierait pour
// une raison invisible au visiteur.
export function couvre(categorie, debut, fin) {
  if (index === null) {
    return false;
  }
  return siecleseTraverses(debut, fin).every((siecle) => {
    const case_ = (index.densite || {})[String(siecle)];
    return case_ !== undefined && case_[categorie] !== undefined
      && case_[categorie].aFaire !== true;
  });
}

async function chargerSiecle(siecle) {
  if (siecles.has(siecle)) {
    return siecles.get(siecle);
  }
  const promesse = fetch(`${CHEMIN_SOCLE}/${siecle}.json`, { cache: "no-cache" })
    .then((reponse) => (reponse.ok ? reponse.json() : []))
    .catch(() => []);
  siecles.set(siecle, promesse);
  return promesse;
}

// Les entrées du socle pour une catégorie et une fenêtre. Les fichiers de
// siècle se chargent l'un après l'autre : ce sont des fichiers statiques,
// mais rien ne justifie d'en demander dix à la fois.
export async function lire(categories, debut, fin) {
  const vues = new Set();
  const entrees = [];
  for (const siecle of siecleseTraverses(debut, fin)) {
    const lot = await chargerSiecle(siecle);
    for (const entree of lot) {
      if (vues.has(entree.id)) {
        continue;
      }
      if (!categories.some((cle) => entree.categories.includes(cle))) {
        continue;
      }
      // Une entrée figure dans chaque siècle qu'elle traverse ; il faut donc
      // vérifier qu'elle recouvre vraiment la fenêtre demandée.
      if (entree.debut.annee > fin || entree.fin.annee < debut) {
        continue;
      }
      vues.add(entree.id);
      entrees.push(entree);
    }
  }
  return entrees;
}
