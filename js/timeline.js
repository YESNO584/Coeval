// La frise. Une barre par entrée, rangée en couloirs, à l'intérieur de
// bandes nommées quand un regroupement est demandé.
//
// Trois choix d'affichage :
//   - les couloirs : une entrée descend d'un cran tant qu'elle en chevauche
//     une autre. Rien ne se recouvre, rien n'est caché ;
//   - une date connue à l'année seulement est pâle, bord tireté. Afficher
//     « 1746 » comme une certitude quand la source dit seulement « quelque
//     part en 1746 » serait un mensonge d'affichage ;
//   - un événement ponctuel est un losange, pas une barre d'un jour : une
//     barre invisible ferait croire à une absence.

const SVG = "http://www.w3.org/2000/svg";

export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 40;

export const HAUTEUR_COULOIR = 22;
const HAUTEUR_BARRE = 14;
const HAUTEUR_AXE = 26;
const MARGE_BANDE = 8;
const LARGEUR_MIN_TEXTE = 55;
const COTE_LOSANGE = 7;

function creerSvg(nom, attributs) {
  const element = document.createElementNS(SVG, nom);
  for (const [cle, valeur] of Object.entries(attributs)) {
    element.setAttribute(cle, String(valeur));
  }
  return element;
}

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

function forme(entree, x, y, largeur) {
  if (!entree.instantane) {
    return creerSvg("rect", {
      x, y, width: largeur, height: HAUTEUR_BARRE, rx: 3, class: "barre"
    });
  }
  const cx = x;
  const cy = y + HAUTEUR_BARRE / 2;
  const c = COTE_LOSANGE;
  return creerSvg("polygon", {
    points: `${cx},${cy - c} ${cx + c},${cy} ${cx},${cy + c} ${cx - c},${cy}`,
    class: "barre losange"
  });
}

function dessinerEntree(place, min, pixelsParAnnee, decalage, surSelection) {
  const { entree, couloir } = place;
  const x = (entree.debut.annee - min) * pixelsParAnnee;
  const largeur = Math.max((entree.fin.annee - entree.debut.annee) * pixelsParAnnee, 3);
  const y = decalage + couloir * HAUTEUR_COULOIR;
  const approximative = entree.debut.approximative || entree.fin.approximative;

  const classes = ["entree", `type-${entree.type}`];
  if (approximative) {
    classes.push("approximative");
  }
  const groupe = creerSvg("g", {
    class: classes.join(" "),
    "data-id": entree.id,
    tabindex: 0,
    role: "button"
  });
  groupe.append(forme(entree, x, y, largeur));

  const titre = creerSvg("title", {});
  const quand = entree.instantane
    ? String(entree.debut.annee)
    : `${entree.debut.annee} – ${entree.fin.annee}`;
  const precision = approximative ? " — dates connues à l'année près" : "";
  const detail = entree.detail === "" ? "" : ` · ${entree.detail}`;
  titre.textContent = `${entree.nom}${detail} (${quand})${precision}`;
  groupe.append(titre);

  if (!entree.instantane && largeur >= LARGEUR_MIN_TEXTE) {
    const texte = creerSvg("text", { x: x + 5, y: y + HAUTEUR_BARRE - 3, class: "etiquette" });
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

// Dessine la frise entière. Renvoie sa géométrie — y compris la hauteur de
// chaque bande — pour que la colonne de gauche s'aligne dessus au pixel près,
// et pour que tout cela soit mesurable plutôt que supposé.
export function dessiner(svg, bandes, min, max, pixelsParAnnee, surSelection) {
  svg.replaceChildren();
  const largeur = Math.max((max - min) * pixelsParAnnee, 1);
  const corps = creerSvg("g", { class: "entrees" });
  const separateurs = creerSvg("g", { class: "separateurs" });
  const mesures = [];
  let y = MARGE_BANDE;
  let barres = 0;

  for (const bande of bandes) {
    const { places, couloirs } = repartirEnCouloirs(bande.entrees);
    const hauteur = couloirs * HAUTEUR_COULOIR + MARGE_BANDE;
    for (const place of places) {
      corps.append(dessinerEntree(place, min, pixelsParAnnee, y, surSelection));
      barres += 1;
    }
    mesures.push({ nom: bande.nom, y, hauteur, couloirs, entrees: bande.entrees.length });
    y += hauteur;
    if (bande !== bandes[bandes.length - 1]) {
      separateurs.append(creerSvg("line", {
        x1: 0, y1: y - MARGE_BANDE / 2, x2: largeur, y2: y - MARGE_BANDE / 2,
        class: "separateur"
      }));
    }
  }

  const hauteur = y + HAUTEUR_AXE;
  svg.setAttribute("width", String(largeur));
  svg.setAttribute("height", String(hauteur));
  svg.setAttribute("viewBox", `0 0 ${largeur} ${hauteur}`);
  dessinerAxe(svg, min, max, pixelsParAnnee, hauteur);
  svg.append(separateurs);
  svg.append(corps);
  return { largeur, hauteur, bandes: mesures, barres };
}

export function mettreEnEvidence(svg, identifiants) {
  const choisis = new Set(identifiants);
  for (const groupe of svg.querySelectorAll(".entree")) {
    const retenu = choisis.size === 0 || choisis.has(groupe.dataset.id);
    groupe.classList.toggle("estompee", !retenu);
  }
}
