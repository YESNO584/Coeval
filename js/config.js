// Réglages de Coeval. Seul fichier où vivent les adresses et les seuils.
//
// La règle « no-hardcoded-endpoint » signale l'adresse ci-dessous : c'est
// voulu. C'est la seule occurrence attendue dans tout le projet, et la voir
// apparaître ailleurs dans le rapport est justement le signal recherché.

export const SERVICE = "https://query.wikidata.org/sparql";

// Wikidata demande que chaque appel s'identifie. Un navigateur n'a pas le
// droit de modifier son propre « User-Agent » ; le service accepte pour cela
// un en-tête « Api-User-Agent », vérifié le 2026-09-18 dans les en-têtes
// d'autorisation renvoyés par le service.
export const IDENTIFICATION = "Coeval/0.1 (https://github.com/YESNO584/Coeval)";

// Une requête au-delà de ce délai est perdue : le service coupe à 60 s.
export const DELAI_MAX_MS = 65000;

// Trois tentatives espacées, puis on renonce et on le dit à l'écran.
export const TENTATIVES = 3;
export const ATTENTE_ENTRE_TENTATIVES_MS = [2000, 6000];

// Les catégories du socle. Les identifiants ont été vérifiés un par un
// contre Wikidata le 2026-09-18 — voir .claude/plan/coeval.md § 3.9.
export const CATEGORIES = {
  souverains: { nom: "Souverains", source: "fonction" },
  philosophes: { nom: "Philosophes", source: "metier", metiers: ["Q4964182"] },
  scientifiques: {
    nom: "Scientifiques",
    source: "metier",
    metiers: ["Q901", "Q170790", "Q593644", "Q11063", "Q864503"]
  },
  artistes: {
    nom: "Artistes",
    source: "metier",
    metiers: ["Q1028181", "Q36834", "Q49757", "Q36180", "Q1281618"]
  },
  evenements: {
    nom: "Événements",
    source: "evenement",
    classes: ["Q13418847", "Q198", "Q10931", "Q131569"]
  }
};

// Ce que la page affiche à l'ouverture, tant qu'il n'y a ni frise ni filtres.
export const VUE_INITIALE = {
  categories: ["philosophes", "souverains", "evenements"],
  debut: 1780,
  fin: 1805,
  groupement: "categorie"
};

// Largeur maximale d'une tranche interrogée d'un coup.
//
// Mesuré le 2026-09-18 : la même requête rend 400 lignes en 4,9 s sur vingt
// ans, mais met 19,6 s sur un siècle — et a échoué par dépassement de délai
// au premier essai. Une fenêtre plus large est donc découpée en tranches
// envoyées l'une après l'autre : autant de temps au total, aucune requête
// au bord du plafond.
//
// La règle « une catégorie par siècle » notée au § 3.3 du plan avait été
// mesurée sur un comptage, qui ne ramène qu'un nombre. Elle ne vaut pas pour
// une requête qui ramène des lignes.
export const TRANCHE_ANS = 25;

// Plafond du nombre de tranches.
//
// Sans lui, une fenêtre de 300 000 ans — permise, la préhistoire est un
// sujet — donnerait douze mille requêtes envoyées l'une après l'autre. Au
// delà de ce plafond les tranches s'élargissent au lieu de se multiplier :
// les périodes très anciennes sont si peu documentées qu'une tranche large
// y ramène peu de chose, et donc répond vite.
export const MAX_TRANCHES = 8;

// --- Saisie ---

// Une année : jusqu'à six chiffres, signe moins accepté pour « avant J.-C. ».
// -300000 est la borne théorique demandée ; rien d'aussi ancien n'est daté à
// l'année dans Wikidata, mais rien n'oblige le champ à le refuser.
export const MOTIF_ANNEE = /^-?\d{1,6}$/;
export const ANNEE_MIN = -300000;
export const ANNEE_MAX = 3000;

// Plafond de sécurité par requête. Mesuré : 400 lignes reviennent en 3,1 s.
// Attention : 400 lignes ne font pas 400 personnes. Wikidata porte plusieurs
// dates concurrentes par personne, et la requête les multiplie — 400 lignes
// ont donné 227 personnes lors de la mesure du 2026-09-18.
export const LIMITE_RESULTATS = 400;

// Où la page va chercher le socle fabriqué chaque nuit. Un chemin relatif :
// la page et son socle sont publiés côte à côte.
export const CHEMIN_SOCLE = "data";

// Le quota du plan (§ 6.1) : les 60 plus notoires par catégorie et par
// siècle. Sans lui, 227 vies qui se chevauchent occupent 227 couloirs et la
// frise fait cinq mille pixels de haut — mesuré, et illisible. Ce qui passe
// au-dessus du quota est compté et affiché, jamais tu.
export const QUOTA_PAR_SIECLE = 60;

// --- Regroupement (colonne de gauche) ---

// Mesuré le 2026-09-18 : 228 philosophes se répartissent sur 62 pays, dont
// 40 n'en contiennent qu'une ou deux personnes. Une bande par pays donnerait
// une colonne illisible. Les plus fournies sont donc gardées, le reste est
// réuni sous « autres » — et ce que la source ignore va dans « indéterminé »,
// qui reste visible au lieu de disparaître.
export const MAX_BANDES = 12;
export const BANDE_AUTRES = "Autres";
export const BANDE_INDETERMINEE = "Indéterminé";

export const GROUPEMENTS = {
  aucun: { nom: "Aucun" },
  categorie: { nom: "Catégorie" },
  pays: { nom: "Pays" },
  siecle: { nom: "Siècle" }
};
