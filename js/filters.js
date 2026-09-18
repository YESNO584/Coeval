// La barre de filtres.
//
// Rien ne part avant le clic sur « Charger ». Changer une case ou un menu ne
// fait que noter l'intention : la frise ne bouge pas, aucune requête ne
// s'envoie. C'est ce qui permet de composer plusieurs filtres tranquillement
// avant de payer une seule fois le prix du chargement.

import { CATEGORIES, GROUPEMENTS, MOTIF_ANNEE, ANNEE_MIN, ANNEE_MAX } from "./config.js";

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

function champTexte(id, etiquette, valeur, motif, aide) {
  const bloc = creer("label", { class: "champ", for: id }, etiquette);
  const entree = creer("input", {
    id,
    type: "text",
    inputmode: motif === undefined ? "text" : "numeric",
    autocomplete: "off",
    value: valeur
  });
  if (motif !== undefined) {
    entree.setAttribute("pattern", motif.source);
  }
  if (aide !== undefined) {
    entree.setAttribute("title", aide);
    entree.setAttribute("placeholder", aide);
  }
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

function anneeValide(texte) {
  if (!MOTIF_ANNEE.test(texte)) {
    return null;
  }
  const valeur = Number.parseInt(texte, 10);
  return valeur >= ANNEE_MIN && valeur <= ANNEE_MAX ? valeur : null;
}

export function installer(racine, depart, surCharger) {
  racine.replaceChildren();

  const aideAnnee = `de ${ANNEE_MIN} à ${ANNEE_MAX}, négatif = avant J.-C.`;
  const soucAnnee = `Année invalide : ${aideAnnee}`;
  const periode = creer("div", { class: "groupe-filtre" });
  periode.append(creer("span", { class: "titre-filtre" }, "Période"));
  const debut = champTexte("filtre-debut", "de", depart.debut, MOTIF_ANNEE, aideAnnee);
  const fin = champTexte("filtre-fin", "à", depart.fin, MOTIF_ANNEE, aideAnnee);
  periode.append(debut.bloc, fin.bloc);

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
  const centre = champTexte("filtre-centre", "centré sur", "", undefined,
    "une personne ou un événement");
  centre.entree.setAttribute("list", "liste-entrees");
  const catalogue = creer("datalist", { id: "liste-entrees" });
  affinage.append(pays.bloc, groupement.bloc, centre.bloc, catalogue);

  // Le bouton ferme le panneau, sur sa propre ligne : c'est le dernier geste,
  // et le seul qui déclenche quelque chose.
  const pied = creer("div", { class: "pied-filtres" });
  const message = creer("p", { class: "message-filtres", role: "status" }, "");
  const bouton = creer("button", { type: "button", id: "filtre-charger" }, "Charger");
  pied.append(message, bouton);

  racine.append(periode, categories, affinage, pied);

  const champsAnnee = [debut.entree, fin.entree];

  function verifier() {
    const a = anneeValide(debut.entree.value.trim());
    const b = anneeValide(fin.entree.value.trim());
    for (const [entree, valeur] of [[debut.entree, a], [fin.entree, b]]) {
      entree.classList.toggle("invalide", valeur === null);
    }
    const choisies = [...cases.values()].filter((boite) => boite.checked).length;

    let souci = "";
    if (a === null || b === null) {
      souci = soucAnnee;
    } else if (a > b) {
      souci = "La date de début est postérieure à la date de fin.";
    } else if (choisies === 0) {
      souci = "Choisissez au moins une catégorie.";
    }
    message.textContent = souci;
    bouton.disabled = souci !== "";
    return souci === "";
  }

  for (const entree of champsAnnee) {
    entree.addEventListener("input", verifier);
  }
  for (const boite of cases.values()) {
    boite.addEventListener("change", verifier);
  }
  bouton.addEventListener("click", () => {
    if (verifier()) {
      surCharger();
    }
  });
  verifier();

  const commandes = [
    ...champsAnnee, ...cases.values(), pays.liste, groupement.liste, centre.entree
  ];

  return {
    valeurs() {
      return {
        debut: anneeValide(debut.entree.value.trim()),
        fin: anneeValide(fin.entree.value.trim()),
        categories: [...cases.entries()]
          .filter(([, boite]) => boite.checked)
          .map(([cle]) => cle),
        pays: pays.liste.value,
        groupement: groupement.liste.value,
        centre: centre.entree.value.trim()
      };
    },

    // Pendant un chargement, tout est verrouillé : sans cela un second clic
    // lancerait une seconde salve de requêtes par-dessus la première.
    verrouiller(occupe) {
      for (const commande of commandes) {
        commande.disabled = occupe;
      }
      bouton.disabled = occupe || !verifier();
      bouton.textContent = occupe ? "Chargement…" : "Charger";
    },

    // Les listes proposées viennent des données chargées : on ne propose
    // jamais un filtre qui ne trouverait rien.
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
    }
  };
}
