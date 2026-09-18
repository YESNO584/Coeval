// La barre de filtres.
//
// Deux sortes de filtres, qui ne coûtent pas la même chose :
//   - ceux qui changent ce qu'il faut demander à Wikidata — la fenêtre de
//     temps et les catégories. Ils déclenchent des requêtes ;
//   - ceux qui ne font que trier ce qui est déjà là — le pays, le
//     regroupement, le choix d'une entrée comme centre. Ils sont instantanés.
// Les mélanger enverrait des requêtes pour rien.

import { CATEGORIES, GROUPEMENTS } from "./config.js";

function creer(balise, attributs, texte) {
  const element = document.createElement(balise);
  for (const [cle, valeur] of Object.entries(attributs)) {
    if (cle === "class") {
      element.className = valeur;
    } else {
      element.setAttribute(cle, String(valeur));
    }
  }
  if (texte !== undefined) {
    element.textContent = texte;
  }
  return element;
}

function champNombre(id, etiquette, valeur) {
  const bloc = creer("label", { class: "champ", for: id }, etiquette);
  const entree = creer("input", { id, type: "number", step: "1", value: valeur });
  bloc.append(entree);
  return { bloc, entree };
}

function menu(id, etiquette, options, choisi) {
  const bloc = creer("label", { class: "champ", for: id }, etiquette);
  const liste = creer("select", { id });
  for (const [valeur, nom] of options) {
    const option = creer("option", { value: valeur }, nom);
    if (valeur === choisi) {
      option.selected = true;
    }
    liste.append(option);
  }
  bloc.append(liste);
  return { bloc, liste };
}

// Construit la barre et renvoie de quoi la lire et la mettre à jour.
export function installer(racine, depart, surRecharger, surAffiner) {
  racine.replaceChildren();

  const periode = creer("div", { class: "groupe-filtre" });
  periode.append(creer("span", { class: "titre-filtre" }, "Période"));
  const debut = champNombre("filtre-debut", "de", depart.debut);
  const fin = champNombre("filtre-fin", "à", depart.fin);
  const appliquer = creer("button", { type: "button", id: "filtre-appliquer" }, "Charger");
  periode.append(debut.bloc, fin.bloc, appliquer);

  const categories = creer("div", { class: "groupe-filtre" });
  categories.append(creer("span", { class: "titre-filtre" }, "Catégories"));
  const cases = new Map();
  for (const [cle, categorie] of Object.entries(CATEGORIES)) {
    const bloc = creer("label", { class: "case" });
    const boite = creer("input", { type: "checkbox", value: cle });
    boite.checked = depart.categories.includes(cle);
    bloc.append(boite, creer("span", {}, categorie.nom));
    cases.set(cle, boite);
    categories.append(bloc);
  }

  const affinage = creer("div", { class: "groupe-filtre" });
  affinage.append(creer("span", { class: "titre-filtre" }, "Affiner"));
  const pays = menu("filtre-pays", "pays", [["", "tous"]], "");
  const groupement = menu(
    "filtre-groupement",
    "grouper par",
    Object.entries(GROUPEMENTS).map(([cle, valeur]) => [cle, valeur.nom]),
    depart.groupement
  );
  const largeur = menu(
    "filtre-largeur",
    "largeur",
    GROUPEMENTS.fourchette.largeurs.map((n) => [String(n), `${n} ans`]),
    String(GROUPEMENTS.fourchette.largeur)
  );
  const recherche = creer("label", { class: "champ", for: "filtre-centre" }, "centré sur");
  const centre = creer("input", {
    id: "filtre-centre",
    type: "search",
    list: "liste-entrees",
    placeholder: "une personne ou un événement"
  });
  recherche.append(centre);
  const catalogue = creer("datalist", { id: "liste-entrees" });
  affinage.append(pays.bloc, groupement.bloc, largeur.bloc, recherche, catalogue);

  racine.append(periode, categories, affinage);

  function majLargeur() {
    largeur.bloc.hidden = groupement.liste.value !== "fourchette";
  }
  majLargeur();

  appliquer.addEventListener("click", () => surRecharger());
  for (const boite of cases.values()) {
    boite.addEventListener("change", () => surRecharger());
  }
  for (const controle of [pays.liste, groupement.liste, largeur.liste]) {
    controle.addEventListener("change", () => {
      majLargeur();
      surAffiner();
    });
  }
  centre.addEventListener("change", () => surAffiner());

  return {
    valeurs() {
      const choisies = [...cases.entries()]
        .filter(([, boite]) => boite.checked)
        .map(([cle]) => cle);
      return {
        debut: Number.parseInt(debut.entree.value, 10),
        fin: Number.parseInt(fin.entree.value, 10),
        categories: choisies,
        pays: pays.liste.value,
        groupement: groupement.liste.value,
        largeur: Number.parseInt(largeur.liste.value, 10),
        centre: centre.value.trim()
      };
    },

    // Les listes de pays et de noms viennent des données chargées : on ne
    // propose jamais un filtre qui ne trouverait rien.
    majChoix(entrees) {
      const noms = new Set();
      const tous = new Set();
      for (const entree of entrees) {
        noms.add(entree.nom);
        for (const nom of entree.pays) {
          tous.add(nom);
        }
      }
      const choisi = pays.liste.value;
      pays.liste.replaceChildren(creer("option", { value: "" }, "tous"));
      for (const nom of [...tous].sort((a, b) => a.localeCompare(b, "fr"))) {
        const option = creer("option", { value: nom }, nom);
        option.selected = nom === choisi;
        pays.liste.append(option);
      }
      catalogue.replaceChildren();
      for (const nom of [...noms].sort((a, b) => a.localeCompare(b, "fr"))) {
        catalogue.append(creer("option", { value: nom }));
      }
    },

    ecrireFenetre(min, max) {
      debut.entree.value = String(min);
      fin.entree.value = String(max);
    }
  };
}
