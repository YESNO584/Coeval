// Transforme ce que renvoie Wikidata en entrées affichables, et compte
// tout ce qui a été écarté.
//
// Deux règles viennent de mesures faites le 2026-09-18 :
//   - une entrée sans date connue n'est pas plaçable sur une frise ;
//   - une entrée sans nom ne doit jamais être affichée. Quand Wikidata n'a
//     pas de libellé, son service de noms renvoie l'identifiant lui-même
//     (« Q12345 ») : c'est à cela qu'on reconnaît un nom manquant.
// Voir .claude/plan/coeval.md § 3.7 et § 3.9.

const FORME_IDENTIFIANT = /^Q\d+$/;
const FORME_DATE = /^(-?\d{4,})-(\d{2})-(\d{2})/;

export function identifiantDepuisUrl(url) {
  return url.substring(url.lastIndexOf("/") + 1);
}

function anneeDepuis(valeur) {
  const trouve = FORME_DATE.exec(valeur);
  return trouve === null ? null : Number.parseInt(trouve[1], 10);
}

// La précision des dates (« vers 1450 ») n'est pas encore demandée : le coût
// de la jointure qui la porte n'a pas été mesuré, et le plan interdit de
// supposer un coût. Elle reste donc nulle, et la frise du lot L2 ne pourra
// pas encore estomper les bords. À mesurer avant le L2.
function dateDepuis(valeur) {
  const annee = anneeDepuis(valeur);
  if (annee === null) {
    return null;
  }
  return { annee, precision: null, brut: valeur };
}

export function convertirPersonnes(lignes) {
  const entrees = [];
  const ecartees = { sansDate: 0, sansNom: 0 };

  for (const ligne of lignes) {
    const id = identifiantDepuisUrl(ligne.p.value);
    const nom = ligne.pLabel === undefined ? "" : ligne.pLabel.value;
    const debut = dateDepuis(ligne.naissance.value);
    const fin = dateDepuis(ligne.mort.value);

    if (nom === "" || FORME_IDENTIFIANT.test(nom)) {
      ecartees.sansNom += 1;
      continue;
    }
    if (debut === null || fin === null) {
      ecartees.sansDate += 1;
      continue;
    }

    entrees.push({
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
  }

  return { entrees, ecartees };
}

// Ajoute la notoriété mesurée séparément (requête R2).
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
