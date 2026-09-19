// Le panneau de détail : tout ce qu'une entrée contient, et modifiable.
//
// Il remplace la frise à l'écran plutôt que de flotter par-dessus. C'est
// délibéré : on ne revient à la frise qu'en ayant enregistré ses
// modifications ou en les abandonnant, et un panneau qu'on peut ignorer d'un
// clic à côté ne le ferait pas respecter.

import * as contributions from "./contributions.js";
import { creer } from "./html.js";

// Ce qui se modifie, et comment. « notoriete » et « sourceUrl » n'y sont
// pas : ils viennent de la source et n'ont pas de sens hors d'elle.
const CHAMPS = [
  { cle: "nom", etiquette: "Nom", forme: "texte" },
  { cle: "debut", etiquette: "Début", forme: "annee" },
  { cle: "fin", etiquette: "Fin", forme: "annee" },
  { cle: "detail", etiquette: "Précision", forme: "texte" },
  { cle: "pays", etiquette: "Pays", forme: "liste" },
  { cle: "description", etiquette: "Description", forme: "long" },
];

function lire(entree, cle) {
  if (cle === "debut" || cle === "fin") {
    return String(entree[cle].annee);
  }
  if (cle === "pays") {
    return entree.pays.join(", ");
  }
  return entree[cle] === undefined ? "" : String(entree[cle]);
}

function ligneLecture(etiquette, valeur) {
  const ligne = creer("div", "ligne-detail");
  ligne.append(creer("span", "etiquette-detail", etiquette));
  ligne.append(creer("span", "valeur-detail", valeur));
  return ligne;
}

function champSaisie(champ, valeur) {
  if (champ.forme === "long") {
    const zone = document.createElement("textarea");
    zone.rows = 3;
    zone.value = valeur;
    return zone;
  }
  const entree = document.createElement("input");
  entree.type = "text";
  entree.value = valeur;
  if (champ.forme === "annee") {
    entree.inputMode = "numeric";
  }
  return entree;
}

// Construit le panneau. 'surChangement' est prévenu à chaque modification,
// pour que le reste de la page sache qu'il y a du travail non enregistré.
export function remplir(racine, entree, origine, surChangement, surSuppression) {
  racine.replaceChildren();

  const titre = creer("h2", "titre-detail", entree.nom || "Nouvelle entrée");
  racine.append(titre);

  const nature = creer("p", "nature-detail");
  const categories = entree.categories.join(", ");
  nature.textContent = `${entree.type}${categories === "" ? "" : ` · ${categories}`}`;
  racine.append(nature);

  const formulaire = creer("div", "formulaire-detail");
  for (const champ of CHAMPS) {
    const valeur = lire(entree, champ.cle);
    const bloc = creer("label", "ligne-detail");
    bloc.append(creer("span", "etiquette-detail", champ.etiquette));
    const saisie = champSaisie(champ, valeur);
    saisie.dataset.champ = champ.cle;

    saisie.addEventListener("change", () => {
      const pose = saisie.value.trim();
      const initiale = lire(origine, champ.cle);
      if (champ.forme === "annee" && !contributions.estUneAnnee(pose)) {
        saisie.classList.add("invalide");
        return;
      }
      saisie.classList.remove("invalide");
      contributions.oublier(entree.id, champ.cle);
      if (pose !== initiale) {
        contributions.noter(
          entree.id.startsWith("tmp-") ? "ajout" : "modification",
          { type: entree.type, id: entree.id },
          champ.cle,
          entree.id.startsWith("tmp-") ? undefined : initiale,
          pose
        );
      }
      surChangement();
    });

    bloc.append(saisie);
    formulaire.append(bloc);
  }
  racine.append(formulaire);

  const informations = creer("div", "informations-detail");
  informations.append(ligneLecture("Précision des dates",
    `${entree.debut.precision} / ${entree.fin.precision}`));
  informations.append(ligneLecture("Notoriété",
    entree.notoriete === null ? "inconnue" : `${entree.notoriete} wikipédias`));
  if (!entree.id.startsWith("tmp-")) {
    const source = creer("div", "ligne-detail");
    source.append(creer("span", "etiquette-detail", "Source"));
    const lien = document.createElement("a");
    lien.href = entree.sourceUrl;
    lien.rel = "noopener";
    lien.target = "_blank";
    lien.textContent = entree.id;
    source.append(lien);
    informations.append(source);
  }
  racine.append(informations);

  const supprimer = creer("button", "bouton-danger", "Supprimer cette entrée");
  supprimer.type = "button";
  supprimer.addEventListener("click", () => {
    contributions.noter("suppression", { type: entree.type, id: entree.id },
      null, entree.nom, undefined);
    surChangement();
    surSuppression();
  });
  racine.append(supprimer);
}

// Une entrée neuve, avec un identifiant provisoire : un contributeur ne peut
// pas inventer un numéro Wikidata, c'est le script de fusion qui en posera un.
export function entreeNeuve() {
  const id = contributions.identifiantProvisoire();
  return {
    id,
    idSujet: id,
    type: "personne",
    nom: "",
    detail: "",
    description: "",
    debut: { annee: 0, code: 9, precision: "année", approximative: true },
    fin: { annee: 0, code: 9, precision: "année", approximative: true },
    instantane: false,
    categories: [],
    pays: [],
    notoriete: null,
    sourceUrl: "",
  };
}
