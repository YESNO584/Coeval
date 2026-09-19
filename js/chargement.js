// Tout ce qu'il faut demander à Wikidata pour remplir une fenêtre de temps.
//
// L'ordre compte, et il est toujours le même : une requête large par
// catégorie, puis des requêtes bornées pour la notoriété et les pays. Ce
// second temps est ce qui rend l'ensemble tenable — mesuré le 2026-09-18, le
// pays demandé dans la requête large coûte 13,2 s au lieu de 1,1 s demandé à
// part, et la notoriété 66 s au lieu de 0,76 s.
//
// Rien ne part en parallèle : deux requêtes simultanées suffisent à faire
// refuser le service. La file de js/sparql.js s'en charge, et ce fichier ne
// la contourne jamais.

import {
  CATEGORIES,
  LIMITE_RESULTATS,
  TRANCHE_ANS,
  MAX_TRANCHES
} from "./config.js";
import {
  personnesVivantes,
  souverainsRegnants,
  evenements,
  notoriete,
  paysDePersonnes,
  paysDeFonctions,
  paysDEvenements
} from "./queries.js";
import { interroger } from "./sparql.js";
import { convertirPersonnes, ajouterNotoriete, ajouterPays } from "./model.js";
import { convertirSouverains, convertirEvenements } from "./entrees.js";
import * as socle from "./socle.js";

const TAILLE_LOT = 300;

function cumuler(total, ajout) {
  for (const [cle, valeur] of Object.entries(ajout)) {
    total[cle] = (total[cle] === undefined ? 0 : total[cle]) + valeur;
  }
  return total;
}

// Découpe une liste d'identifiants en lots envoyés l'un après l'autre.
// Jamais Promise.all : le service refuserait.
async function parLots(identifiants, fabriquer, prefixe) {
  const lignes = [];
  for (let debut = 0; debut < identifiants.length; debut += TAILLE_LOT) {
    const lot = identifiants.slice(debut, debut + TAILLE_LOT);
    const reponse = await interroger(fabriquer(lot), `${prefixe}:${lot[0]}:${lot.length}`);
    lignes.push(...reponse);
  }
  return lignes;
}

// Découpe une fenêtre en tranches. Vingt-cinq ans par défaut — au-delà du
// plafond de tranches, elles s'élargissent plutôt que de se multiplier.
export function tranches(debut, fin) {
  const etendue = Math.max(fin - debut, 1);
  const largeur = Math.max(TRANCHE_ANS, Math.ceil(etendue / MAX_TRANCHES));
  const morceaux = [];
  for (let borne = debut; borne < fin; borne += largeur) {
    morceaux.push({ debut: borne, fin: Math.min(borne + largeur, fin) });
  }
  return morceaux.length === 0 ? [{ debut, fin }] : morceaux;
}

async function chargerTranche(cle, debut, fin) {
  const categorie = CATEGORIES[cle];
  if (categorie.source === "metier") {
    const lignes = await interroger(
      personnesVivantes(categorie.metiers, debut, fin, LIMITE_RESULTATS),
      `personnes:${cle}:${debut}:${fin}`
    );
    const resultat = convertirPersonnes(lignes);
    for (const entree of resultat.entrees) {
      entree.categories = [cle];
    }
    return resultat;
  }
  if (categorie.source === "fonction") {
    const lignes = await interroger(
      souverainsRegnants(debut, fin, LIMITE_RESULTATS),
      `souverains:${debut}:${fin}`
    );
    return convertirSouverains(lignes);
  }
  const lignes = await interroger(
    evenements(categorie.classes, debut, fin, LIMITE_RESULTATS),
    `evenements:${debut}:${fin}`
  );
  return convertirEvenements(lignes);
}

// Une même entrée peut revenir dans deux tranches voisines : une vie de
// 1770 à 1830 recouvre les deux. On garde la première rencontrée.
async function chargerCategorie(cle, debut, fin, annoncer) {
  const morceaux = tranches(debut, fin);
  const parIdentifiant = new Map();
  const ecartees = {};
  let rang = 0;
  for (const morceau of morceaux) {
    rang += 1;
    const suite = morceaux.length > 1 ? ` (${rang} sur ${morceaux.length})` : "";
    annoncer(`Recherche : ${CATEGORIES[cle].nom.toLowerCase()}${suite}…`);
    const resultat = await chargerTranche(cle, morceau.debut, morceau.fin);
    for (const entree of resultat.entrees) {
      if (!parIdentifiant.has(entree.id)) {
        parIdentifiant.set(entree.id, entree);
      }
    }
    cumuler(ecartees, resultat.ecartees);
  }
  return { entrees: [...parIdentifiant.values()], ecartees };
}

async function attacherPays(entrees) {
  const groupes = [
    { type: "personne", cle: "idSujet", requete: paysDePersonnes, nom: "paysP" },
    { type: "souverain", cle: "idFonction", requete: paysDeFonctions, nom: "paysF" },
    { type: "evenement", cle: "idSujet", requete: paysDEvenements, nom: "paysE" }
  ];
  for (const groupe of groupes) {
    const concernees = entrees.filter((entree) => entree.type === groupe.type);
    if (concernees.length === 0) {
      continue;
    }
    const identifiants = [...new Set(concernees.map((entree) => entree[groupe.cle]))];
    const lignes = await parLots(identifiants, groupe.requete, groupe.nom);
    ajouterPays(concernees, lignes, groupe.cle);
  }
}

// Charge tout ce que demandent les filtres. 'annoncer' sert à dire où on en
// est : une attente de plusieurs secondes sans un mot ressemble à une panne.
//
// Chaque catégorie vient du socle quand il la couvre, du direct sinon. La
// bascule se fait catégorie par catégorie : le socle se construit sur
// plusieurs nuits, et il serait absurde d'attendre qu'il soit complet pour
// profiter de ce qu'il contient déjà.
export async function chargerTout(valeurs, annoncer) {
  const entrees = [];
  const ecartees = {};
  const origines = { socle: 0, direct: 0 };

  await socle.ouvrir();

  for (const cle of valeurs.categories) {
    if (socle.couvre(cle, valeurs.debut, valeurs.fin)) {
      annoncer(`${CATEGORIES[cle].nom} : lecture du socle…`);
      const lues = await socle.lire([cle], valeurs.debut, valeurs.fin);
      entrees.push(...lues);
      origines.socle += lues.length;
      continue;
    }
    const resultat = await chargerCategorie(cle, valeurs.debut, valeurs.fin, annoncer);
    entrees.push(...resultat.entrees);
    origines.direct += resultat.entrees.length;
    cumuler(ecartees, resultat.ecartees);
  }

  if (entrees.length === 0) {
    return { entrees, ecartees, origines };
  }

  // Le socle porte déjà notoriété et pays : on ne redemande que pour ce qui
  // vient du direct.
  const aCompleter = entrees.filter((entree) => entree.notoriete === null);
  if (aCompleter.length > 0) {
    annoncer(`${aCompleter.length} entrées à compléter. Mesure de leur notoriété…`);
    const sujets = [...new Set(aCompleter.map((entree) => entree.idSujet))];
    const lignesNotoriete = await parLots(sujets, notoriete, "notoriete");
    ajouterNotoriete(aCompleter, lignesNotoriete, "idSujet");
    annoncer("Recherche des pays…");
    await attacherPays(aCompleter);
  }

  return { entrees, ecartees, origines };
}
