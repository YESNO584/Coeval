// La base de travail : le socle, plus le fichier de contributions.
//
// Ce que la page affiche n'est pas le socle brut. C'est le socle **corrigé
// par votre fichier** : vos corrections visibles, vos créations présentes,
// vos suppressions masquées. Sans cela vous ne verriez jamais le résultat de
// votre travail, et vous le referiez.
//
// Une règle, et une seule, en cas de désaccord : **votre version l'emporte à
// l'écran, et le désaccord est signalé.** Si une nuit de fabrique a changé
// une entrée que vous aviez corrigée, la page ne choisit pas à votre place —
// elle montre votre version et vous dit qu'il y a un écart. C'est la même
// règle que le script de fusion : signaler, jamais trancher.

const VALEURS_PAR_DEFAUT = {
  type: "personne",
  nom: "",
  detail: "",
  description: "",
  instantane: false,
  categories: [],
  pays: [],
  notoriete: null,
  sourceUrl: "",
};

// Comment un champ se lit en texte. Cette fonction est le pendant exact de
// « ecrireChamp » : une seule définition pour les deux sens, sinon le
// panneau de détail et la fusion finiraient par ne plus s'accorder.
export function lireChamp(entree, cle) {
  if (cle === "debut" || cle === "fin") {
    return String(entree[cle].annee);
  }
  if (cle === "pays") {
    return entree.pays.join(", ");
  }
  return entree[cle] === undefined || entree[cle] === null
    ? "" : String(entree[cle]);
}

function ecrireChamp(entree, cle, texte) {
  if (cle === "debut" || cle === "fin") {
    const annee = Number.parseInt(texte, 10);
    if (Number.isNaN(annee)) {
      return;
    }
    const ancienne = entree[cle] || {};
    entree[cle] = { ...ancienne, annee, corrigee: true };
    return;
  }
  if (cle === "pays") {
    entree.pays = texte === ""
      ? []
      : texte.split(",").map((pays) => pays.trim()).filter((pays) => pays !== "");
    return;
  }
  entree[cle] = texte;
}

function dateNeuve() {
  return { annee: 0, code: 9, precision: "année", approximative: true };
}

function entreeNeuve(id, type) {
  return {
    ...VALEURS_PAR_DEFAUT,
    id,
    idSujet: id,
    type: type || VALEURS_PAR_DEFAUT.type,
    debut: dateNeuve(),
    fin: dateNeuve(),
    categories: [],
    pays: [],
    creee: true,
  };
}

// Les champs touchés par une opération, quelle que soit la version du
// fichier. La version 1 écrivait une opération par champ (« champ »,
// « avant », « apres » à la racine) ; la version 2 les groupe par entité
// sous « champs ». Un fichier enregistré avant le 2026-10-02 doit rester
// lisible : il porte du travail que personne ne refera.
function champsDe(operation) {
  if (operation.champs !== undefined && operation.champs !== null) {
    return operation.champs;
  }
  if (operation.champ === undefined || operation.champ === null) {
    return {};
  }
  return {
    [operation.champ]: { avant: operation.avant, apres: operation.apres },
  };
}

// Applique les opérations d'un fichier sur une liste d'entrées du socle.
//
// Rend les entrées corrigées et la liste des désaccords. Les entrées ne sont
// jamais modifiées sur place : le socle reste tel qu'il a été lu, ce qui
// permet de recharger un autre fichier sans tout redemander.
export function appliquer(entrees, operations) {
  const parIdentifiant = new Map();
  for (const entree of entrees) {
    parIdentifiant.set(entree.id, { ...entree });
  }
  const supprimees = new Set();
  const desaccords = [];
  const creees = new Map();

  for (const operation of operations || []) {
    const cible = operation.cible || {};
    const id = cible.id;
    if (id === undefined || id === null) {
      continue;
    }

    if (operation.operation === "suppression") {
      supprimees.add(id);
      creees.delete(id);
      continue;
    }

    // Une opération porte tous les champs touchés d'une même entité. Le
    // format d'avant en écrivait un par champ ; « champsDe » lit les deux,
    // pour qu'un fichier déjà enregistré reste lisible.
    const champs = champsDe(operation);

    if (operation.operation === "ajout") {
      if (!creees.has(id)) {
        creees.set(id, entreeNeuve(id, cible.type));
      }
      for (const [champ, valeurs] of Object.entries(champs)) {
        ecrireChamp(creees.get(id), champ, String(valeurs.apres ?? ""));
      }
      continue;
    }

    if (operation.operation !== "modification") {
      continue;
    }
    const entree = parIdentifiant.get(id);
    if (entree === undefined) {
      // L'entrée corrigée n'est pas dans la fenêtre affichée : ce n'est pas
      // une anomalie, on ne regarde qu'un morceau du socle à la fois.
      continue;
    }
    for (const [champ, valeurs] of Object.entries(champs)) {
      const actuelle = lireChamp(entree, champ);
      if (valeurs.avant !== undefined && String(valeurs.avant) !== actuelle) {
        desaccords.push({
          id,
          nom: entree.nom,
          champ,
          vueParVous: String(valeurs.avant),
          dansLeSocle: actuelle,
          votreVersion: String(valeurs.apres ?? ""),
        });
      }
      ecrireChamp(entree, champ, String(valeurs.apres ?? ""));
      entree.corrigee = true;
    }
  }

  const resultat = [];
  for (const [id, entree] of parIdentifiant) {
    if (!supprimees.has(id)) {
      resultat.push(entree);
    }
  }
  for (const entree of creees.values()) {
    if (!supprimees.has(entree.id)) {
      resultat.push(entree);
    }
  }
  return { entrees: resultat, desaccords };
}
