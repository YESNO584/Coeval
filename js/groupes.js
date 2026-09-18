// Le regroupement : la colonne de gauche de la frise.
//
// Une bande par valeur — un pays, une catégorie, un siècle, une tranche
// d'années. Deux bandes ne se ressemblent pas et méritent d'être nommées :
//
//   « Indéterminé » — la source ne dit rien. Mesuré le 2026-09-18 : 46 %
//     seulement des événements portent un pays. Cacher ce trou ferait passer
//     une lacune de Wikidata pour un fait historique.
//   « Autres » — la source dit quelque chose, mais trop rarement pour mériter
//     sa bande. 40 des 62 pays rencontrés ne comptaient qu'une ou deux
//     personnes.

import {
  CATEGORIES,
  GROUPEMENTS,
  MAX_BANDES,
  BANDE_AUTRES,
  BANDE_INDETERMINEE
} from "./config.js";

const CHIFFRES_ROMAINS = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
];

function romain(nombre) {
  let reste = nombre;
  let sortie = "";
  for (const [valeur, signe] of CHIFFRES_ROMAINS) {
    while (reste >= valeur) {
      sortie += signe;
      reste -= valeur;
    }
  }
  return sortie;
}

function nomDuSiecle(annee) {
  if (annee <= 0) {
    return `${romain(Math.floor(-annee / 100) + 1)}e siècle av. J.-C.`;
  }
  return `${romain(Math.floor((annee - 1) / 100) + 1)}e siècle`;
}

// Les valeurs d'une entrée pour une dimension donnée. Plusieurs sont
// possibles : un roi de France et de Navarre appartient aux deux bandes,
// et l'y montrer deux fois est plus juste que d'en choisir une au hasard.
function valeurs(entree, dimension) {
  if (dimension === "pays") {
    return entree.pays.length === 0 ? [] : entree.pays;
  }
  if (dimension === "categorie") {
    return entree.categories.map((cle) => {
      const connue = CATEGORIES[cle];
      return connue === undefined ? cle : connue.nom;
    });
  }
  if (dimension === "siecle") {
    return [nomDuSiecle(entree.debut.annee)];
  }
  return [];
}

// Range les entrées en bandes. Renvoie aussi ce qui a été réuni sous
// « autres », pour que l'écran puisse le dire.
export function grouper(entrees, dimension) {
  if (dimension === "aucun" || GROUPEMENTS[dimension] === undefined) {
    return { bandes: [{ nom: "", entrees }], regroupees: 0, indeterminees: 0 };
  }

  const parValeur = new Map();
  const indeterminees = [];
  for (const entree of entrees) {
    const trouvees = valeurs(entree, dimension);
    if (trouvees.length === 0) {
      indeterminees.push(entree);
      continue;
    }
    for (const valeur of trouvees) {
      const connues = parValeur.get(valeur);
      if (connues === undefined) {
        parValeur.set(valeur, [entree]);
      } else {
        connues.push(entree);
      }
    }
  }

  // Les bandes chronologiques se lisent dans l'ordre du temps ; les autres,
  // de la plus fournie à la moins fournie.
  const chronologique = dimension === "siecle";
  const rangees = [...parValeur.entries()].sort((a, b) => {
    if (chronologique) {
      return a[1][0].debut.annee - b[1][0].debut.annee;
    }
    return b[1].length - a[1].length || a[0].localeCompare(b[0], "fr");
  });

  const place = MAX_BANDES - (indeterminees.length > 0 ? 1 : 0);
  const gardees = chronologique ? rangees : rangees.slice(0, place);
  const reste = chronologique ? [] : rangees.slice(place);

  const bandes = gardees.map(([nom, membres]) => ({ nom, entrees: membres }));
  const dansAutres = new Set();
  for (const [, membres] of reste) {
    for (const entree of membres) {
      dansAutres.add(entree);
    }
  }
  if (dansAutres.size > 0) {
    bandes.push({ nom: BANDE_AUTRES, entrees: [...dansAutres] });
  }
  if (indeterminees.length > 0) {
    bandes.push({ nom: BANDE_INDETERMINEE, entrees: indeterminees });
  }
  return { bandes, regroupees: dansAutres.size, indeterminees: indeterminees.length };
}
