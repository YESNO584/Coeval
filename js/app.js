// Assemblage du lot L2 : charger une catégorie sur une fenêtre de temps et
// la dessiner en frise, avec grossissement et défilement.
// Le clic met une entrée en évidence ; calculer ses contemporains est le
// lot L3.

import {
  CATEGORIES,
  VUE_INITIALE,
  LIMITE_RESULTATS,
  QUOTA_PAR_SIECLE
} from "./config.js";
import { personnesVivantes, notoriete } from "./queries.js";
import { interroger } from "./sparql.js";
import {
  convertirPersonnes,
  ajouterNotoriete,
  trierParNotoriete,
  bornes
} from "./model.js";
import { dessiner, mettreEnEvidence, ZOOM_MIN, ZOOM_MAX } from "./timeline.js";

const zoneEtat = document.querySelector("#etat");
const zoneDensite = document.querySelector("#densite");
const cadre = document.querySelector("#cadre");
const svg = document.querySelector("#frise");
const boutonPlus = document.querySelector("#zoom-plus");
const boutonMoins = document.querySelector("#zoom-moins");
const zoneChoix = document.querySelector("#choix");

const etat = {
  entrees: [],
  min: 0,
  max: 0,
  pixelsParAnnee: 3,
  selection: null
};

function annoncer(texte, enPanne) {
  zoneEtat.textContent = texte;
  zoneEtat.dataset.panne = enPanne === true ? "oui" : "non";
}

function decrireSelection(id) {
  const entree = etat.entrees.find((candidate) => candidate.id === id);
  if (entree === undefined) {
    return;
  }
  etat.selection = id;
  const flou = entree.debut.approximative || entree.fin.approximative;
  const mention = flou ? " · dates connues à l'année près" : "";
  zoneChoix.replaceChildren();
  const lien = document.createElement("a");
  lien.href = entree.sourceUrl;
  lien.rel = "noopener";
  lien.target = "_blank";
  lien.textContent = entree.nom;
  zoneChoix.append(lien);
  const suite = document.createElement("span");
  suite.textContent = ` — ${entree.debut.annee} à ${entree.fin.annee}${mention}`;
  zoneChoix.append(suite);
  mettreEnEvidence(svg, [id]);
}

function redessiner() {
  const mesures = dessiner(
    svg,
    etat.entrees,
    etat.min,
    etat.max,
    etat.pixelsParAnnee,
    decrireSelection
  );
  if (etat.selection !== null) {
    mettreEnEvidence(svg, [etat.selection]);
  }
  return mesures;
}

function grossir(facteur) {
  const avant = etat.pixelsParAnnee;
  const centre = (cadre.scrollLeft + cadre.clientWidth / 2) / avant;
  etat.pixelsParAnnee = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, avant * facteur));
  redessiner();
  cadre.scrollLeft = centre * etat.pixelsParAnnee - cadre.clientWidth / 2;
}

boutonPlus.addEventListener("click", () => grossir(1.6));
boutonMoins.addEventListener("click", () => grossir(1 / 1.6));

async function charger() {
  const categorie = CATEGORIES[VUE_INITIALE.categorie];
  const { debut, fin } = VUE_INITIALE;
  annoncer(`Recherche des ${categorie.nom.toLowerCase()} vivants entre ${debut} et ${fin}…`);

  const lignes = await interroger(
    personnesVivantes(categorie.metiers, debut, fin, LIMITE_RESULTATS),
    `personnes:${VUE_INITIALE.categorie}:${debut}:${fin}`
  );
  const { entrees, ecartees } = convertirPersonnes(lignes);

  if (entrees.length === 0) {
    annoncer("Wikidata n'a renvoyé personne pour cette période.", true);
    return;
  }

  annoncer(`${entrees.length} personnes trouvées. Mesure de leur notoriété…`);
  const identifiants = entrees.map((entree) => entree.id);
  const lignesNotoriete = await interroger(
    notoriete(identifiants),
    `notoriete:${identifiants.length}:${identifiants[0]}`
  );
  ajouterNotoriete(entrees, lignesNotoriete);

  const classees = trierParNotoriete(entrees);
  const siecles = Math.max(1, Math.ceil((fin - debut) / 100));
  const plafond = QUOTA_PAR_SIECLE * siecles;
  etat.entrees = classees.slice(0, plafond);
  const horsQuota = classees.length - etat.entrees.length;
  const { min, max } = bornes(etat.entrees);
  etat.min = min;
  etat.max = max;
  etat.pixelsParAnnee = Math.max(
    ZOOM_MIN,
    Math.min(ZOOM_MAX, cadre.clientWidth / Math.max(max - min, 1))
  );
  const mesures = redessiner();

  const details = [`${etat.entrees.length} personnes`, `${mesures.couloirs} couloirs`];
  if (horsQuota > 0) {
    details.push(`${horsQuota} au-delà du quota de ${plafond}`);
  }
  if (ecartees.doublons > 0) {
    details.push(`${ecartees.doublons} dates concurrentes arbitrées`);
  }
  if (ecartees.sansDate > 0) {
    details.push(`${ecartees.sansDate} écartées faute de date précise`);
  }
  if (ecartees.sansNom > 0) {
    details.push(`${ecartees.sansNom} écartées faute de nom`);
  }
  zoneDensite.textContent = details.join(" · ");
  annoncer(`${categorie.nom} vivants entre ${min} et ${max}. Cliquez une barre.`);
}

charger().catch((erreur) => {
  annoncer(`${erreur.message} Réessayez dans un instant.`, true);
  console.error(erreur);
});
