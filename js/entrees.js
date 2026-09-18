// Les deux autres sortes d'entrées : les règnes et les événements.
// Les personnes vivent dans js/model.js, avec les aides que ce fichier
// réutilise ici — une seule définition des règles de date pour tout le monde.

import {
  FORME_IDENTIFIANT,
  identifiantDepuisUrl,
  valeurDe,
  dateDepuis,
  meilleure
} from "./model.js";

// --- Souverains ---
//
// Un règne est une entrée à lui seul : une même personne qui a occupé deux
// trônes donne deux barres, ce qui est ce qu'on veut voir sur une frise.
// Le pays viendra de la fonction, pas de la personne (voir R6).
export function convertirSouverains(lignes) {
  const parCle = new Map();
  const ecartees = { sansDate: 0, sansNom: 0, doublons: 0 };

  for (const ligne of lignes) {
    const url = valeurDe(ligne, "p");
    const urlFonction = valeurDe(ligne, "fonction");
    const nom = valeurDe(ligne, "pLabel") ?? "";
    const debut = dateDepuis(valeurDe(ligne, "debut"), valeurDe(ligne, "precDebut"));
    const fin = valeurDe(ligne, "fin") === undefined
      ? debut
      : dateDepuis(valeurDe(ligne, "fin"), valeurDe(ligne, "precFin"));

    if (url === undefined || urlFonction === undefined) {
      ecartees.sansDate += 1;
      continue;
    }
    const id = identifiantDepuisUrl(url);
    const fonction = identifiantDepuisUrl(urlFonction);
    if (nom === "" || FORME_IDENTIFIANT.test(nom)) {
      ecartees.sansNom += 1;
      continue;
    }
    if (debut === null || fin === null) {
      ecartees.sansDate += 1;
      continue;
    }

    const cle = `${id}:${fonction}`;
    const connue = parCle.get(cle);
    if (connue !== undefined) {
      ecartees.doublons += 1;
      connue.debut = meilleure(connue.debut, debut);
      connue.fin = meilleure(connue.fin, fin);
      continue;
    }
    parCle.set(cle, {
      id: cle,
      idSujet: id,
      idFonction: fonction,
      type: "souverain",
      nom,
      detail: valeurDe(ligne, "fonctionLabel") ?? "",
      debut,
      fin,
      instantane: false,
      categories: ["souverains"],
      pays: [],
      notoriete: null,
      sourceUrl: `https://www.wikidata.org/wiki/${id}`
    });
  }
  return { entrees: [...parCle.values()], ecartees };
}

// --- Événements ---
//
// Un événement est un instant (un sacre) ou une durée (une guerre). Les deux
// se dessinent différemment, d'où le drapeau « instantane ». Quand la source
// ne donne pas de fin, on ne l'invente pas : l'entrée est comptée à part.
export function convertirEvenements(lignes) {
  const parIdentifiant = new Map();
  const ecartees = { sansDate: 0, sansNom: 0, doublons: 0, sansFin: 0 };

  for (const ligne of lignes) {
    const url = valeurDe(ligne, "e");
    const nom = valeurDe(ligne, "eLabel") ?? "";
    const instant = valeurDe(ligne, "instant");
    const ponctuel = instant !== undefined;
    const debut = dateDepuis(ponctuel ? instant : valeurDe(ligne, "debut"), "11");
    const brutFin = valeurDe(ligne, "fin");
    const fin = ponctuel || brutFin === undefined ? debut : dateDepuis(brutFin, "11");

    if (url === undefined) {
      ecartees.sansDate += 1;
      continue;
    }
    const id = identifiantDepuisUrl(url);
    if (nom === "" || FORME_IDENTIFIANT.test(nom)) {
      ecartees.sansNom += 1;
      continue;
    }
    if (debut === null || fin === null) {
      ecartees.sansDate += 1;
      continue;
    }
    if (!ponctuel && brutFin === undefined) {
      ecartees.sansFin += 1;
    }
    if (parIdentifiant.has(id)) {
      ecartees.doublons += 1;
      continue;
    }
    parIdentifiant.set(id, {
      id,
      idSujet: id,
      type: "evenement",
      nom,
      detail: valeurDe(ligne, "classeLabel") ?? "",
      debut,
      fin,
      instantane: ponctuel || debut.annee === fin.annee,
      categories: ["evenements"],
      pays: [],
      notoriete: null,
      sourceUrl: `https://www.wikidata.org/wiki/${id}`
    });
  }
  return { entrees: [...parIdentifiant.values()], ecartees };
}
