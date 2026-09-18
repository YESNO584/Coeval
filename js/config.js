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
  philosophes: { nom: "Philosophes", metiers: ["Q4964182"] },
  scientifiques: {
    nom: "Scientifiques",
    metiers: ["Q901", "Q170790", "Q593644", "Q11063", "Q864503"]
  },
  artistes: {
    nom: "Artistes",
    metiers: ["Q1028181", "Q36834", "Q49757", "Q36180", "Q1281618"]
  }
};

// Ce que la page affiche à l'ouverture, tant qu'il n'y a ni frise ni filtres.
export const VUE_INITIALE = { categorie: "philosophes", debut: 1700, fin: 1800 };

// Plafond de sécurité par requête. Mesuré : 400 lignes reviennent en 3,1 s.
// Attention : 400 lignes ne font pas 400 personnes. Wikidata porte plusieurs
// dates concurrentes par personne, et la requête les multiplie — 400 lignes
// ont donné 227 personnes lors de la mesure du 2026-09-18.
export const LIMITE_RESULTATS = 400;

// Le quota du plan (§ 6.1) : les 60 plus notoires par catégorie et par
// siècle. Sans lui, 227 vies qui se chevauchent occupent 227 couloirs et la
// frise fait cinq mille pixels de haut — mesuré, et illisible. Ce qui passe
// au-dessus du quota est compté et affiché, jamais tu.
export const QUOTA_PAR_SIECLE = 60;
