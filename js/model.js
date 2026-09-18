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

export const FORME_IDENTIFIANT = /^Q\d+$/;
const FORME_DATE = /^(-?\d{4,})-(\d{2})-(\d{2})/;

// Codes de précision de Wikidata. En deçà de 9, la date ne vaut pas mieux
// qu'une décennie : impossible de placer une barre honnêtement.
const PRECISION_ANNEE = 9;
const NOMS_PRECISION = { 9: "année", 10: "mois", 11: "jour" };

// Lit une valeur d'une ligne de réponse sans supposer qu'elle est là.
// Une réponse inattendue doit faire écarter une ligne, jamais planter la
// page : le plan interdit la page blanche (§ 7).
export function valeurDe(ligne, nom) {
  const champ = ligne[nom];
  return champ === undefined || champ === null ? undefined : champ.value;
}

export function identifiantDepuisUrl(url) {
  return url.substring(url.lastIndexOf("/") + 1);
}

export function dateDepuis(valeur, codePrecision) {
  if (valeur === undefined) {
    return null;
  }
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
export function meilleure(existante, candidate) {
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
    const url = valeurDe(ligne, "p");
    const nom = valeurDe(ligne, "pLabel") ?? "";
    const debut = dateDepuis(valeurDe(ligne, "naissance"), valeurDe(ligne, "precNaissance"));
    const fin = dateDepuis(valeurDe(ligne, "mort"), valeurDe(ligne, "precMort"));

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

    const connue = parIdentifiant.get(id);
    if (connue === undefined) {
      parIdentifiant.set(id, {
        id,
        idSujet: id,
        type: "personne",
        detail: "",
        nom,
        debut,
        fin,
        instantane: false,
        categories: [],
        pays: [],
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

export function ajouterNotoriete(entrees, lignes, cle) {
  const parIdentifiant = new Map();
  for (const ligne of lignes) {
    const url = valeurDe(ligne, "p");
    if (url === undefined) {
      continue;
    }
    parIdentifiant.set(identifiantDepuisUrl(url), Number.parseInt(valeurDe(ligne, "liens"), 10));
  }
  const champ = cle === undefined ? "id" : cle;
  for (const entree of entrees) {
    const liens = parIdentifiant.get(entree[champ]);
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

// Rattache les pays à leurs entrées. 'cle' dit sur quel identifiant la
// réponse porte : la personne elle-même, ou la fonction qu'elle occupait.
export function ajouterPays(entrees, lignes, cle) {
  const parSujet = new Map();
  for (const ligne of lignes) {
    const url = valeurDe(ligne, "sujet");
    const nom = valeurDe(ligne, "paysLabel");
    if (url === undefined || nom === undefined) {
      continue;
    }
    const sujet = identifiantDepuisUrl(url);
    const connus = parSujet.get(sujet);
    if (connus === undefined) {
      parSujet.set(sujet, [nom]);
    } else if (!connus.includes(nom)) {
      connus.push(nom);
    }
  }
  for (const entree of entrees) {
    const trouves = parSujet.get(entree[cle]);
    if (trouves !== undefined) {
      entree.pays = trouves;
    }
  }
  return entrees;
}
