// Transforme ce que renvoie Wikidata en entrées affichables, et compte tout
// ce qui a été écarté.
//
// Règles issues de mesures faites le 2026-09-18 :
//   - une entrée sans date connue à l'année près n'est pas plaçable ;
//   - une entrée sans nom ne doit jamais être affichée : quand Wikidata n'a
//     pas de libellé, son service de noms renvoie l'identifiant lui-même ;
//   - une même personne revient plusieurs fois, avec des dates concurrentes.
//     Sur 400 lignes, 228 personnes seulement, dont 80 en double.
// Voir .claude/plan/coeval.md § 3.7 et § 3.9.

const FORME_IDENTIFIANT = /^Q\d+$/;
const FORME_DATE = /^(-?\d{4,})-(\d{2})-(\d{2})/;

// Codes de précision de Wikidata. En deçà de 9, la date ne vaut pas mieux
// qu'une décennie : impossible de placer une barre honnêtement.
const PRECISION_ANNEE = 9;
const NOMS_PRECISION = { 9: "année", 10: "mois", 11: "jour" };

export function identifiantDepuisUrl(url) {
  return url.substring(url.lastIndexOf("/") + 1);
}

function dateDepuis(valeur, codePrecision) {
  const trouve = FORME_DATE.exec(valeur);
  const code = Number.parseInt(codePrecision, 10);
  if (trouve === null || Number.isNaN(code) || code < PRECISION_ANNEE) {
    return null;
  }
  return {
    annee: Number.parseInt(trouve[1], 10),
    code,
    precision: NOMS_PRECISION[code] === undefined ? "année" : NOMS_PRECISION[code],
    approximative: code === PRECISION_ANNEE,
    brut: valeur
  };
}

// Entre deux dates concurrentes pour la même personne, on garde la plus
// précise ; à précision égale, la plus ancienne, pour que deux exécutions
// donnent toujours le même résultat.
function meilleure(existante, candidate) {
  if (existante === null) {
    return candidate;
  }
  if (candidate.code !== existante.code) {
    return candidate.code > existante.code ? candidate : existante;
  }
  return candidate.brut < existante.brut ? candidate : existante;
}

export function convertirPersonnes(lignes) {
  const parIdentifiant = new Map();
  const ecartees = { sansDate: 0, sansNom: 0, doublons: 0 };

  for (const ligne of lignes) {
    const id = identifiantDepuisUrl(ligne.p.value);
    const nom = ligne.pLabel === undefined ? "" : ligne.pLabel.value;
    const debut = dateDepuis(ligne.naissance.value, ligne.precNaissance.value);
    const fin = dateDepuis(ligne.mort.value, ligne.precMort.value);

    if (nom === "" || FORME_IDENTIFIANT.test(nom)) {
      ecartees.sansNom += 1;
      continue;
    }
    if (debut === null || fin === null) {
      ecartees.sansDate += 1;
      continue;
    }

    const connue = parIdentifiant.get(id);
    if (connue === undefined) {
      parIdentifiant.set(id, {
        id,
        type: "personne",
        nom,
        debut,
        fin,
        instantane: false,
        categories: [],
        notoriete: null,
        sourceUrl: `https://www.wikidata.org/wiki/${id}`
      });
      continue;
    }
    ecartees.doublons += 1;
    connue.debut = meilleure(connue.debut, debut);
    connue.fin = meilleure(connue.fin, fin);
  }

  return { entrees: [...parIdentifiant.values()], ecartees };
}

export function ajouterNotoriete(entrees, lignes) {
  const parIdentifiant = new Map();
  for (const ligne of lignes) {
    const id = identifiantDepuisUrl(ligne.p.value);
    parIdentifiant.set(id, Number.parseInt(ligne.liens.value, 10));
  }
  for (const entree of entrees) {
    const liens = parIdentifiant.get(entree.id);
    entree.notoriete = liens === undefined ? 0 : liens;
  }
  return entrees;
}

export function trierParNotoriete(entrees) {
  return [...entrees].sort((a, b) => b.notoriete - a.notoriete);
}

// Bornes de la frise : la plus ancienne naissance, la plus récente mort.
export function bornes(entrees) {
  let min = Infinity;
  let max = -Infinity;
  for (const entree of entrees) {
    min = Math.min(min, entree.debut.annee);
    max = Math.max(max, entree.fin.annee);
  }
  return entrees.length === 0 ? { min: 0, max: 0 } : { min, max };
}
