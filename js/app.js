// Assemblage : la barre de filtres, le chargement, le regroupement et la
// frise. Ce fichier ne sait rien de SPARQL ; il branche les morceaux.

import { VUE_INITIALE, QUOTA_PAR_SIECLE, GROUPEMENTS } from "./config.js";
import { installer } from "./filters.js";
import { chargerTout } from "./chargement.js";
import { trierParNotoriete, bornes } from "./model.js";
import { grouper } from "./groupes.js";
import { dessiner, mettreEnEvidence, ZOOM_MIN, ZOOM_MAX } from "./timeline.js";

const zoneEtat = document.querySelector("#etat");
const zoneDensite = document.querySelector("#densite");
const zoneChoix = document.querySelector("#choix");
const zoneFiltres = document.querySelector("#filtres");
const colonne = document.querySelector("#colonne");
const cadre = document.querySelector("#cadre");
const svg = document.querySelector("#frise");

const etat = {
  chargees: [],
  ecartees: {},
  affichees: [],
  min: 0,
  max: 0,
  pixelsParAnnee: 3,
  selection: null,
  occupe: false
};

let filtres = null;

function annoncer(texte, enPanne) {
  zoneEtat.textContent = texte;
  zoneEtat.dataset.panne = enPanne === true ? "oui" : "non";
}

function creer(balise, classe, texte) {
  const element = document.createElement(balise);
  if (classe !== undefined) {
    element.className = classe;
  }
  if (texte !== undefined) {
    element.textContent = texte;
  }
  return element;
}

function recouvre(a, b) {
  return a.debut.annee <= b.fin.annee && a.fin.annee >= b.debut.annee;
}

// La colonne de gauche. Ses bandes sont calées au pixel près sur celles de
// la frise, dont le dessin renvoie la géométrie exacte.
function dessinerColonne(bandes) {
  colonne.replaceChildren();
  if (bandes.length === 1 && bandes[0].nom === "") {
    colonne.hidden = true;
    return;
  }
  colonne.hidden = false;
  for (const bande of bandes) {
    const bloc = creer("div", "bande");
    bloc.style.height = `${bande.hauteur}px`;
    bloc.append(creer("span", "nom-bande", bande.nom));
    bloc.append(creer("span", "compte-bande", String(bande.entrees)));
    colonne.append(bloc);
  }
}

function selectionner(id) {
  const choisie = etat.affichees.find((entree) => entree.id === id);
  if (choisie === undefined) {
    return;
  }
  etat.selection = id;
  const contemporaines = etat.affichees.filter((entree) => recouvre(entree, choisie));
  mettreEnEvidence(svg, contemporaines.map((entree) => entree.id));

  zoneChoix.replaceChildren();
  const lien = document.createElement("a");
  lien.href = choisie.sourceUrl;
  lien.rel = "noopener";
  lien.target = "_blank";
  lien.textContent = choisie.nom;
  const quand = choisie.instantane
    ? String(choisie.debut.annee)
    : `${choisie.debut.annee} à ${choisie.fin.annee}`;
  zoneChoix.append(lien);
  zoneChoix.append(creer("span", undefined,
    ` — ${quand} · ${contemporaines.length - 1} entrées contemporaines`));
}

function redessiner(bandes) {
  const mesures = dessiner(
    svg, bandes, etat.min, etat.max, etat.pixelsParAnnee, selectionner
  );
  dessinerColonne(mesures.bandes);
  if (etat.selection !== null) {
    selectionner(etat.selection);
  }
  return mesures;
}

// Le quota du plan (§ 6.1) : les N plus notoires **par catégorie** et par
// siècle. Appliqué globalement, il effaçait une catégorie entière — mesuré
// le 2026-09-18, les événements disparaissaient tous, leur notoriété étant
// bien plus basse que celle des personnes. Un quota qui supprime une
// catégorie sans le dire est pire que pas de quota.
function appliquerQuota(entrees) {
  const siecles = Math.max(1, Math.ceil((etat.max - etat.min) / 100));
  const plafond = QUOTA_PAR_SIECLE * siecles;
  const parCategorie = new Map();
  for (const entree of entrees) {
    const cle = entree.categories[0] ?? "autre";
    const connues = parCategorie.get(cle);
    if (connues === undefined) {
      parCategorie.set(cle, [entree]);
    } else {
      connues.push(entree);
    }
  }
  const gardees = [];
  let horsQuota = 0;
  for (const membres of parCategorie.values()) {
    const classees = trierParNotoriete(membres);
    gardees.push(...classees.slice(0, plafond));
    horsQuota += Math.max(classees.length - plafond, 0);
  }
  return { gardees: trierParNotoriete(gardees), horsQuota, plafond };
}

// Ne touche pas au réseau : ne fait que trier ce qui est déjà chargé.
function affiner() {
  const valeurs = filtres.valeurs();
  let retenues = etat.chargees;

  if (valeurs.pays !== "") {
    retenues = retenues.filter((entree) => entree.pays.includes(valeurs.pays));
  }

  let centre = null;
  if (valeurs.centre !== "") {
    centre = etat.chargees.find((entree) => entree.nom === valeurs.centre);
    if (centre !== undefined) {
      retenues = retenues.filter((entree) => recouvre(entree, centre));
    }
  }

  const { gardees, horsQuota, plafond } = appliquerQuota(retenues);
  etat.affichees = gardees;

  const { bandes, regroupees, indeterminees } = grouper(
    etat.affichees, valeurs.groupement, valeurs.largeur
  );
  filtres.majChoix(etat.chargees);
  const mesures = redessiner(bandes);

  const details = [`${etat.affichees.length} entrées`, `${mesures.bandes.length} bandes`];
  if (horsQuota > 0) {
    details.push(`${horsQuota} au-delà du quota de ${plafond} par catégorie`);
  }
  if (regroupees > 0) {
    details.push(`${regroupees} réunies sous « autres »`);
  }
  if (indeterminees > 0) {
    details.push(`${indeterminees} sans valeur connue`);
  }
  for (const [cle, mot] of Object.entries({
    sansDate: "sans date précise", sansNom: "sans nom",
    doublons: "dates concurrentes arbitrées", sansFin: "sans date de fin"
  })) {
    if (etat.ecartees[cle] > 0) {
      details.push(`${etat.ecartees[cle]} ${mot}`);
    }
  }
  zoneDensite.textContent = details.join(" · ");

  if (centre !== undefined && centre !== null) {
    annoncer(`Ce qui recouvre ${centre.nom} (${centre.debut.annee}–${centre.fin.annee}).`);
  } else {
    annoncer(`${etat.affichees.length} entrées entre ${etat.min} et ${etat.max}.`);
  }
}

async function recharger() {
  if (etat.occupe) {
    return;
  }
  const valeurs = filtres.valeurs();
  if (valeurs.categories.length === 0) {
    annoncer("Choisissez au moins une catégorie.", true);
    return;
  }
  etat.occupe = true;
  try {
    const { entrees, ecartees } = await chargerTout(valeurs, annoncer);
    etat.chargees = entrees;
    etat.ecartees = ecartees;
    etat.selection = null;
    zoneChoix.replaceChildren();
    if (entrees.length === 0) {
      annoncer("Wikidata n'a rien renvoyé pour ces filtres.", true);
      return;
    }
    const { min, max } = bornes(entrees);
    etat.min = min;
    etat.max = max;
    etat.pixelsParAnnee = Math.max(
      ZOOM_MIN, Math.min(ZOOM_MAX, cadre.clientWidth / Math.max(max - min, 1))
    );
    affiner();
  } catch (erreur) {
    annoncer(`${erreur.message} Réessayez dans un instant.`, true);
    console.error(erreur);
  } finally {
    etat.occupe = false;
  }
}

function grossir(facteur) {
  const avant = etat.pixelsParAnnee;
  const centre = (cadre.scrollLeft + cadre.clientWidth / 2) / avant;
  etat.pixelsParAnnee = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, avant * facteur));
  const valeurs = filtres.valeurs();
  redessiner(grouper(etat.affichees, valeurs.groupement, valeurs.largeur).bandes);
  cadre.scrollLeft = centre * etat.pixelsParAnnee - cadre.clientWidth / 2;
}

document.querySelector("#zoom-plus").addEventListener("click", () => grossir(1.6));
document.querySelector("#zoom-moins").addEventListener("click", () => grossir(1 / 1.6));

filtres = installer(zoneFiltres, {
  debut: VUE_INITIALE.debut,
  fin: VUE_INITIALE.fin,
  categories: VUE_INITIALE.categories,
  groupement: VUE_INITIALE.groupement,
  largeur: GROUPEMENTS.fourchette.largeur
}, recharger, affiner);

recharger();
