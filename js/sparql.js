// L'unique porte de sortie vers Wikidata.
//
// Tout passe par une file d'attente qui n'envoie qu'une requête à la fois.
// Ce n'est pas un réglage de confort : mesuré le 2026-09-18, deux appels
// simultanés suffisent à déclencher la limitation de débit du service
// (erreur 429). Voir .claude/plan/coeval.md § 3.6.

import {
  SERVICE,
  IDENTIFICATION,
  DELAI_MAX_MS,
  TENTATIVES,
  ATTENTE_ENTRE_TENTATIVES_MS
} from "./config.js";

// Ce qui a déjà été demandé pendant cette visite. Vidé à la fermeture de
// l'onglet : rien n'est écrit sur la machine du visiteur.
const memoireDeVisite = new Map();

// La file. Chaque nouvelle demande s'accroche à la fin de la précédente,
// ce qui garantit qu'aucune ne part avant que la précédente soit revenue.
let dernierePromesse = Promise.resolve();

function patienter(ms) {
  return new Promise((resoudre) => {
    setTimeout(resoudre, ms);
  });
}

export class ErreurService extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "ErreurService";
    this.cause = cause;
  }
}

async function envoyerUneFois(requete) {
  const abandon = new AbortController();
  const minuterie = setTimeout(() => abandon.abort(), DELAI_MAX_MS);
  try {
    const reponse = await fetch(`${SERVICE}?query=${encodeURIComponent(requete)}`, {
      headers: {
        Accept: "application/sparql-results+json",
        "Api-User-Agent": IDENTIFICATION
      },
      signal: abandon.signal
    });
    if (reponse.status === 429) {
      throw new ErreurService("Wikidata limite le nombre de requêtes.");
    }
    if (!reponse.ok) {
      throw new ErreurService(`Wikidata a répondu ${reponse.status}.`);
    }
    const donnees = await reponse.json();
    return donnees.results.bindings;
  } finally {
    clearTimeout(minuterie);
  }
}

async function envoyerAvecReprises(requete) {
  let derniereErreur = null;
  for (let essai = 0; essai < TENTATIVES; essai += 1) {
    try {
      return await envoyerUneFois(requete);
    } catch (erreur) {
      derniereErreur = erreur;
      const attente = ATTENTE_ENTRE_TENTATIVES_MS[essai];
      if (attente === undefined) {
        break;
      }
      await patienter(attente);
    }
  }
  throw new ErreurService(
    "Wikidata n'a pas répondu après trois tentatives.",
    derniereErreur
  );
}

// Envoie une requête, en attendant son tour. 'cle' sert de mémoire : deux
// demandes identiques pendant la même visite ne partent qu'une fois.
export function interroger(requete, cle) {
  if (cle && memoireDeVisite.has(cle)) {
    return memoireDeVisite.get(cle);
  }
  const resultat = dernierePromesse
    .catch(() => undefined)
    .then(() => envoyerAvecReprises(requete));
  dernierePromesse = resultat;
  if (cle) {
    memoireDeVisite.set(cle, resultat);
    resultat.catch(() => memoireDeVisite.delete(cle));
  }
  return resultat;
}

// Nombre de requêtes en mémoire — lu par les tests et l'encart de densité.
export function tailleMemoire() {
  return memoireDeVisite.size;
}
