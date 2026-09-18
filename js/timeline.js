// La frise. Une barre horizontale par entrée, sur un axe des années.
//
// Deux choix d'affichage à connaître :
//   - les barres sont rangées en couloirs : une entrée descend d'un cran tant
//     qu'elle en chevauche une autre. Rien ne se recouvre, rien n'est caché ;
//   - une date connue à l'année seulement est dessinée en plus pâle, bord
//     tireté. Afficher « 1746 » comme une certitude quand la source dit
//     seulement « quelque part en 1746 » serait un mensonge d'affichage.

const SVG = "http://www.w3.org/2000/svg";

export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 40;

const HAUTEUR_COULOIR = 22;
const HAUTEUR_BARRE = 14;
const HAUTEUR_AXE = 26;
const MARGE_HAUT = 8;
const LARGEUR_MIN_TEXTE = 55;

function creerSvg(nom, attributs) {
  const element = document.createElementNS(SVG, nom);
  for (const [cle, valeur] of Object.entries(attributs)) {
    element.setAttribute(cle, String(valeur));
  }
  return element;
}

// Range les entrées en couloirs. Les entrées arrivent triées par notoriété ;
// on les replace par date de début pour que le rangement soit stable.
function repartirEnCouloirs(entrees) {
  const ordonnees = [...entrees].sort((a, b) => a.debut.annee - b.debut.annee);
  const finDeCouloir = [];
  const places = [];
  for (const entree of ordonnees) {
    let couloir = finDeCouloir.findIndex((fin) => fin < entree.debut.annee);
    if (couloir === -1) {
      couloir = finDeCouloir.length;
    }
    finDeCouloir[couloir] = entree.fin.annee;
    places.push({ entree, couloir });
  }
  return { places, couloirs: Math.max(finDeCouloir.length, 1) };
}

// Un pas de graduation qui reste lisible quel que soit le grossissement.
function pasDeGraduation(pixelsParAnnee) {
  const candidats = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000];
  return candidats.find((pas) => pas * pixelsParAnnee >= 60) ?? 2000;
}

function dessinerAxe(svg, min, max, pixelsParAnnee, hauteur) {
  const pas = pasDeGraduation(pixelsParAnnee);
  const premier = Math.ceil(min / pas) * pas;
  const groupe = creerSvg("g", { class: "axe" });
  for (let annee = premier; annee <= max; annee += pas) {
    const x = (annee - min) * pixelsParAnnee;
    groupe.append(creerSvg("line", { x1: x, y1: 0, x2: x, y2: hauteur, class: "graduation" }));
    const etiquette = creerSvg("text", { x: x + 4, y: hauteur - 8, class: "annee" });
    etiquette.textContent = annee < 0 ? `${-annee} av. J.-C.` : String(annee);
    groupe.append(etiquette);
  }
  svg.append(groupe);
}

function dessinerBarre(place, min, pixelsParAnnee, surSelection) {
  const { entree, couloir } = place;
  const x = (entree.debut.annee - min) * pixelsParAnnee;
  const largeur = Math.max((entree.fin.annee - entree.debut.annee) * pixelsParAnnee, 3);
  const y = MARGE_HAUT + couloir * HAUTEUR_COULOIR;
  const approximative = entree.debut.approximative || entree.fin.approximative;

  const groupe = creerSvg("g", {
    class: approximative ? "entree approximative" : "entree",
    "data-id": entree.id,
    tabindex: 0,
    role: "button"
  });
  groupe.append(creerSvg("rect", {
    x, y, width: largeur, height: HAUTEUR_BARRE, rx: 3, class: "barre"
  }));

  const titre = creerSvg("title", {});
  const mention = approximative ? " — dates connues à l'année près" : "";
  titre.textContent = `${entree.nom} (${entree.debut.annee} – ${entree.fin.annee})${mention}`;
  groupe.append(titre);

  if (largeur >= LARGEUR_MIN_TEXTE) {
    const texte = creerSvg("text", {
      x: x + 5, y: y + HAUTEUR_BARRE - 3, class: "etiquette"
    });
    texte.textContent = entree.nom;
    groupe.append(texte);
  }

  groupe.addEventListener("click", () => surSelection(entree.id));
  groupe.addEventListener("keydown", (evenement) => {
    if (evenement.key === "Enter" || evenement.key === " ") {
      evenement.preventDefault();
      surSelection(entree.id);
    }
  });
  return groupe;
}

// Dessine la frise entière. Renvoie ses dimensions, pour que l'appelant
// puisse les vérifier plutôt que les supposer.
export function dessiner(svg, entrees, min, max, pixelsParAnnee, surSelection) {
  svg.replaceChildren();
  const { places, couloirs } = repartirEnCouloirs(entrees);
  const largeur = Math.max((max - min) * pixelsParAnnee, 1);
  const hauteur = MARGE_HAUT * 2 + couloirs * HAUTEUR_COULOIR + HAUTEUR_AXE;

  svg.setAttribute("width", String(largeur));
  svg.setAttribute("height", String(hauteur));
  svg.setAttribute("viewBox", `0 0 ${largeur} ${hauteur}`);

  dessinerAxe(svg, min, max, pixelsParAnnee, hauteur);
  const corps = creerSvg("g", { class: "entrees" });
  for (const place of places) {
    corps.append(dessinerBarre(place, min, pixelsParAnnee, surSelection));
  }
  svg.append(corps);
  return { largeur, hauteur, couloirs, barres: places.length };
}

// Met en évidence une sélection et ce qui la recouvre dans le temps.
export function mettreEnEvidence(svg, identifiants) {
  const choisis = new Set(identifiants);
  for (const groupe of svg.querySelectorAll(".entree")) {
    const retenu = choisis.size === 0 || choisis.has(groupe.dataset.id);
    groupe.classList.toggle("estompee", !retenu);
  }
}
