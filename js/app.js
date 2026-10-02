// Assemblage : la barre de filtres, le chargement, le regroupement et la
// frise. Ce fichier ne sait rien de SPARQL ; il branche les morceaux.

import { VUE_INITIALE, QUOTA_PAR_SIECLE } from "./config.js";
import { installer } from "./filters.js";
import { chargerTout } from "./chargement.js";
import { trierParNotoriete, bornes, appliquerQuota } from "./model.js";
import { grouper } from "./groupes.js";
import { creer } from "./html.js";
import * as edition from "./edition.js";
import { demarrer } from "./demarrage.js";
import * as travail from "./travail.js";
import * as bandeau from "./etat.js";
import { accueillir, expliquerLeVide } from "./accueil.js";
import { resumerLAffichage } from "./densite.js";
import {
  dessiner,
  dessinerColonne,
  mettreEnEvidence,
  ZOOM_MIN,
  ZOOM_MAX
} from "./timeline.js";

bandeau.installer(document.querySelector("#etat"));
const zoneDensite = document.querySelector("#densite");
const zoneChoix = document.querySelector("#choix");
const zoneFiltres = document.querySelector("#filtres");
const colonne = document.querySelector("#colonne");
const cadre = document.querySelector("#cadre");
const svg = document.querySelector("#frise");

const etat = {
  chargees: [],
  ecartees: {},
  origines: { socle: 0, direct: 0 },
  nonCouvertes: [],
  desaccords: [],
  affichees: [],
  min: 0,
  max: 0,
  pixelsParAnnee: 3,
  selection: null,
  occupe: false
};

let filtres = null;

const annoncer = (texte, enPanne) => bandeau.annoncer(texte, enPanne, etat.occupe);

function recouvre(a, b) {
  return a.debut.annee <= b.fin.annee && a.fin.annee >= b.debut.annee;
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

  // Le clic ouvre le détail. C'est là que tout se modifie.
  edition.ouvrir(choisie);
}

function redessiner(bandes) {
  const mesures = dessiner(
    svg, bandes, etat.min, etat.max, etat.pixelsParAnnee, selectionner
  );
  dessinerColonne(colonne, mesures.bandes);
  if (etat.selection !== null) {
    selectionner(etat.selection);
  }
  return mesures;
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

  const { gardees, horsQuota, plafond } = appliquerQuota(
    retenues, QUOTA_PAR_SIECLE, etat.max - etat.min
  );
  etat.affichees = gardees;

  const { bandes, regroupees, indeterminees } = grouper(etat.affichees, valeurs.groupement);
  filtres.majChoix(etat.chargees);
  const mesures = redessiner(bandes);

  zoneDensite.textContent = resumerLAffichage(etat, {
    horsQuota, plafond, regroupees, indeterminees,
    bandes: mesures.bandes.length,
  });

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
  filtres.verrouiller(true);
  annoncer("Préparation des requêtes…");
  try {
    const { entrees, ecartees, origines, nonCouvertes, desaccords } =
      await chargerTout(valeurs, annoncer);
    etat.chargees = entrees;
    etat.ecartees = ecartees;
    etat.origines = origines;
    etat.nonCouvertes = nonCouvertes;
    etat.desaccords = desaccords;
    etat.selection = null;
    zoneChoix.replaceChildren();
    if (entrees.length === 0) {
      // Une frise vide sans explication ressemble à une panne. On dit
      // précisément ce qui manque, et ce qui existe.
      annoncer(expliquerLeVide(nonCouvertes), true);
      svg.replaceChildren();
      colonne.hidden = true;
      zoneDensite.textContent = "";
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
    filtres.verrouiller(false);
    bandeau.finDAttente();
  }
}

function grossir(facteur) {
  const avant = etat.pixelsParAnnee;
  const centre = (cadre.scrollLeft + cadre.clientWidth / 2) / avant;
  etat.pixelsParAnnee = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, avant * facteur));
  const valeurs = filtres.valeurs();
  redessiner(grouper(etat.affichees, valeurs.groupement).bandes);
  cadre.scrollLeft = centre * etat.pixelsParAnnee - cadre.clientWidth / 2;
}

document.querySelector("#zoom-plus").addEventListener("click", () => grossir(1.6));
document.querySelector("#zoom-moins").addEventListener("click", () => grossir(1 / 1.6));

filtres = installer(zoneFiltres, {
  debut: VUE_INITIALE.debut,
  fin: VUE_INITIALE.fin,
  categories: VUE_INITIALE.categories,
  groupement: VUE_INITIALE.groupement
}, recharger);

// Au lancement, on ne cherche rien : on lit seulement l'index du socle — un
// petit fichier — pour pouvoir dire ce qui est disponible. Chercher d'office
// ferait travailler la page pour une question que personne n'a posée.
demarrer({
  svg,
  zoneChoix,
  etat,
  annoncer,
  mettreEnEvidence,
  surChangementDeBase
});

// Changer de fichier, ou en reprendre un, change ce qui doit s'afficher :
// la frise montre « socle + fichier ». On la refait si elle montrait déjà
// quelque chose, sinon il n'y a rien à refaire.
async function surChangementDeBase() {
  travail.rafraichirLEtiquette();
  if (etat.chargees.length > 0) {
    await recharger();
  }
}

travail.installer(document.querySelector("#fichier-travail"),
  surChangementDeBase, annoncer);

accueillir(annoncer, zoneDensite).then(() => travail.accueillirLeFichier());
