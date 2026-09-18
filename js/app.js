// Assemblage du lot L1 : charger une catégorie sur une année, l'afficher
// en liste. Pas encore de frise — c'est le lot L2.

import { CATEGORIES, VUE_INITIALE, LIMITE_RESULTATS } from "./config.js";
import { personnesVivantes, notoriete } from "./queries.js";
import { interroger } from "./sparql.js";
import { convertirPersonnes, ajouterNotoriete, trierParNotoriete } from "./model.js";

const zoneEtat = document.querySelector("#etat");
const zoneListe = document.querySelector("#liste");
const zoneDensite = document.querySelector("#densite");

function annoncer(texte, enPanne) {
  zoneEtat.textContent = texte;
  zoneEtat.dataset.panne = enPanne === true ? "oui" : "non";
}

function creer(balise, texte, classe) {
  const element = document.createElement(balise);
  if (texte !== undefined) {
    element.textContent = texte;
  }
  if (classe !== undefined) {
    element.className = classe;
  }
  return element;
}

function afficher(entrees) {
  zoneListe.replaceChildren();
  for (const entree of entrees) {
    const ligne = creer("li", undefined, "entree");
    const lien = creer("a", entree.nom, "nom");
    lien.href = entree.sourceUrl;
    lien.rel = "noopener";
    lien.target = "_blank";
    ligne.append(lien);
    ligne.append(creer("span", `${entree.debut.annee} – ${entree.fin.annee}`, "dates"));
    ligne.append(creer("span", `${entree.notoriete} wikipédias`, "notoriete"));
    zoneListe.append(ligne);
  }
}

function afficherDensite(total, ecartees) {
  const morceaux = [`${total} affichés`];
  if (ecartees.sansDate > 0) {
    morceaux.push(`${ecartees.sansDate} écartés faute de date`);
  }
  if (ecartees.sansNom > 0) {
    morceaux.push(`${ecartees.sansNom} écartés faute de nom`);
  }
  zoneDensite.textContent = morceaux.join(" · ");
}

async function charger() {
  const categorie = CATEGORIES[VUE_INITIALE.categorie];
  const annee = VUE_INITIALE.annee;
  annoncer(`Recherche des ${categorie.nom.toLowerCase()} vivants en ${annee}…`);

  const requete = personnesVivantes(
    categorie.metiers,
    annee,
    annee,
    LIMITE_RESULTATS
  );
  const lignes = await interroger(requete, `personnes:${VUE_INITIALE.categorie}:${annee}`);
  const { entrees, ecartees } = convertirPersonnes(lignes);

  if (entrees.length === 0) {
    annoncer("Wikidata n'a renvoyé personne pour cette période.", true);
    afficherDensite(0, ecartees);
    return;
  }

  // Deuxième requête, jamais en parallèle de la première : la file de
  // js/sparql.js garantit qu'elle part une fois celle-ci revenue.
  annoncer(`${entrees.length} personnes trouvées. Mesure de leur notoriété…`);
  const identifiants = entrees.map((entree) => entree.id);
  const lignesNotoriete = await interroger(
    notoriete(identifiants),
    `notoriete:${identifiants.length}:${identifiants[0]}`
  );

  ajouterNotoriete(entrees, lignesNotoriete);
  const classees = trierParNotoriete(entrees);
  afficher(classees);
  afficherDensite(classees.length, ecartees);
  annoncer(`${categorie.nom} vivants en ${annee}, du plus connu au moins connu.`);
}

charger().catch((erreur) => {
  // Une panne de Wikidata ne doit jamais produire une page blanche.
  annoncer(`${erreur.message} Réessayez dans un instant.`, true);
  console.error(erreur);
});
