# Coeval — plan de développement

> État : plan validé sur son périmètre, pas encore sur son contenu.
> Écrit le 2026-09-18. Aucun code n'existe encore dans ce dépôt.

## 1. Le produit en une page

**Coeval répond à une seule question : qui vivait en même temps que qui ?**

On ouvre une page web, on voit une frise chronologique. Chaque personne y est
une barre horizontale qui va de sa naissance à sa mort. On clique sur Napoléon :
toutes les barres qui recouvrent la sienne s'allument. Ce sont ses contemporains.

Deux filtres cadrent ce qu'on voit :

- **par catégorie** — souverains, philosophes, scientifiques, artistes ;
- **par personne** — on choisit une figure, la frise se recentre sur sa période.

### Ce qui est dans la version 1

- La frise, ses deux filtres, le clic « montre-moi les contemporains ».
- Une fiche minimale au survol ou au clic : nom, dates, catégorie, lien Wikidata.
- Un indicateur d'attente et un message clair quand la source ne répond pas.
- Un encart de densité : combien de personnes affichées par siècle et par
  catégorie (voir § 8).

### Ce qui est hors périmètre, explicitement

- La carte et les frontières historiques. Reportées, décidées ainsi.
- Les lieux de résidence datés (`P551`), les époques nommées (PeriodO), les
  événements. Le modèle de données leur laisse la place (§ 5), le produit non.
- Tout compte utilisateur, toute sauvegarde, toute base de données.
- L'application Flutter. Le § 11 dit ce qu'il faut préserver pour elle.

## 2. Décisions déjà prises

| Décision | Choix | Conséquence |
|---|---|---|
| Forme livrée | Pages HTML statiques | Aucun serveur, aucun hébergement à payer |
| Données | Wikidata interrogé en direct depuis le navigateur | Rien n'est stocké dans le dépôt |
| Organisation | Plusieurs fichiers séparés | Plus facile à faire évoluer qu'un fichier unique |
| Dépôt | Public | GitHub Pages gratuit |
| Version 1 | Frise seule | La carte viendra après, si elle vient |
| Branche | `main` | Conforme au `CLAUDE.md` du projet |

## 3. Ce qui a été mesuré, et qui commande tout le reste

Ces neuf constats ont été obtenus en interrogeant réellement le service
Wikidata depuis cette session, le 2026-09-18. **Ils ne sont pas des
suppositions.** Ils décident de l'architecture, donc ils sont en tête du plan.

### 3.1 Wikidata autorise les appels depuis n'importe quel site

Le service répond avec l'en-tête `access-control-allow-origin: *`. C'est
l'autorisation explicite donnée à tous les sites web. Une page hébergée sur
GitHub Pages peut donc l'interroger directement, sans intermédiaire.

### 3.2 La requête naïve échoue

« Tous les humains vivants en 1800, triés par notoriété » : **erreur 502 après
58 secondes**. Le service coupe à 60 secondes. Cette forme est inutilisable et
il ne faut pas la tenter.

### 3.3 Deux ingrédients rendent une requête viable

```sparql
PREFIX hint: <http://www.bigdata.com/queryHints#>
?p wdt:P569 ?birth . hint:Prior hint:rangeSafe true .
FILTER(?birth <= "1800-01-01T00:00:00Z"^^xsd:dateTime)
```

- `hint:Prior hint:rangeSafe true` autorise le moteur à utiliser son index de
  dates.
- La date de comparaison doit être écrite comme une vraie date typée, pas
  extraite avec `YEAR()`. `YEAR()` force la lecture de toutes les lignes.

Avec ces deux ingrédients, plus un filtre de métier : **400 lignes en 5,7 s**.

### 3.4 Le tri par notoriété tue la requête

La même requête, avec `wikibase:sitelinks` ajouté pour trier par notoriété :
**66 secondes**, au-delà du budget du service. Elle n'a réussi que de justesse
et ne réussira pas toujours.

### 3.5 La notoriété se demande séparément, et c'est instantané

En deux temps : on récupère d'abord les identifiants (5,7 s), puis on demande
la notoriété de ces identifiants-là seulement, par une liste fermée `VALUES`.
**400 entités en 0,76 s.**

**C'est le motif central de l'application : une requête large pour les
identifiants, des requêtes bornées pour tout le reste.**

### 3.6 Deux requêtes en parallèle déclenchent une limitation

Erreur 429 dès deux appels simultanés depuis la même adresse. **Les requêtes
doivent être mises en file et envoyées une par une.** Ce n'est pas un réglage
de confort, c'est une condition de fonctionnement.

### 3.7 Les dates manquent souvent

Les 83 « rois des Francs » remontent en 3 s, mais le premier de la liste
(Cararic) n'a ni naissance ni mort. **Une personne sans date n'est pas
plaçable sur une frise** : il faut la filtrer, et compter combien ont été
écartées pour le dire à l'écran.

### 3.8 Un lien vers un fichier HTML dans GitHub n'affiche pas la page

GitHub sert les fichiers bruts comme du texte, avec une consigne qui interdit
au navigateur de les interpréter. On voit le code source, pas la page.
**GitHub Pages est obligatoire**, ce n'est pas un raffinement.

### 3.9 Les identifiants de catégories, vérifiés un par un

| Identifiant | Signification |
|---|---|
| `Q4964182` | philosophe |
| `Q901` | scientifique |
| `Q170790` | mathématicien | 
| `Q593644` | chimiste |
| `Q11063` | astronome |
| `Q864503` | biologiste |
| `Q1028181` | artiste peintre |
| `Q36834` | compositeur |
| `Q49757` | poète |
| `Q36180` | écrivain |
| `Q1281618` | sculpteur |
| `Q483501` | artiste |
| `Q116` | monarque |
| `Q39018` | empereur |
| `Q22923081` | roi des Francs |

## 4. Architecture des fichiers

```
index.html            page unique, structure et conteneurs
css/coeval.css        mise en forme
js/config.js          catégories, identifiants Wikidata, seuils, URL du service
js/sparql.js          file d'attente série, envoi, erreurs, mémoire de session
js/queries.js         les requêtes, une fonction par usage (§ 6)
js/model.js           normalisation en objets Personne, filtrage qualité
js/timeline.js        dessin de la frise en SVG, zoom, défilement
js/filters.js         les deux filtres et leur état
js/contemporains.js   calcul et mise en évidence des vies qui se recouvrent
js/coverage.js        encart de densité (§ 8)
js/app.js             assemblage, séquence de démarrage
```

Pas de cadre logiciel, pas d'étape de compilation, pas de dépendance
téléchargée. Des modules JavaScript standard (`<script type="module">`), que
tout navigateur récent charge directement. **Raison :** un fichier qu'on ouvre
et qui marche, sans rien installer, est exactement ce qui a été demandé.

## 5. Le modèle de données

Une **Personne** est un objet :

```js
{
  id: "Q517",                  // identifiant Wikidata, la clé de tout
  nom: "Napoléon Ier",
  naissance: { annee: 1769, precision: "jour", brut: "1769-08-15" },
  mort:      { annee: 1821, precision: "jour", brut: "1821-05-05" },
  categories: ["souverain"],   // plusieurs possibles
  notoriete: 312,              // nombre de liens entre wikipédias
  sourceUrl: "https://www.wikidata.org/wiki/Q517"
}
```

Trois règles :

1. **L'identifiant Wikidata est la clé unique.** Jamais le nom. Deux personnes
   peuvent porter le même nom ; deux identifiants ne se confondent pas.
2. **Une date porte toujours sa précision.** Wikidata sait dire « vers 1450 ».
   Une frise qui affiche « 1450 » sans le signaler ment. La précision voyage
   avec la date et se voit à l'écran (barre aux bords estompés).
3. **Le champ `sourceUrl` n'est pas décoratif.** Toute affirmation à l'écran
   doit pouvoir être remontée à sa source en un clic.

**Place laissée pour la suite, sans être remplie :** `lieux` (résidences
datées), `periodes` (époques nommées), `relations`. Déclarés dans le modèle,
ignorés par la version 1.

## 6. Les requêtes

Quatre requêtes, pas une de plus. Chacune vit dans `js/queries.js`, comme une
fonction qui prend des paramètres et renvoie du texte SPARQL.

### R1 — Les personnes d'une catégorie vivantes dans une fenêtre

La requête large. Forme obligatoire (§ 3.3), sans notoriété, sans tri.
Mesurée : 5,7 s pour 400 lignes.

### R2 — La notoriété d'un lot d'identifiants

`VALUES ?p { ... }` puis `?p wikibase:sitelinks ?n`. Mesurée : 0,76 s pour 400.
Sert à trier et à couper quand il y a trop de monde à afficher.

### R3 — Les souverains

Ils ne se trouvent pas par le métier mais par la **fonction occupée** (`P39`),
avec ses qualificatifs de début et de fin de règne (`P580`, `P582`). C'est ce
qui donne les dates de règne, distinctes des dates de vie.

### R4 — La fiche d'une personne

Une seule personne, un seul identifiant : instantané. Lieu de naissance, de
mort, métiers, image.

**Règle qui s'applique aux quatre :** toute requête part avec un en-tête
`User-Agent` descriptif nommant le projet et son dépôt. C'est ce que demande
Wikidata, et c'est ce qui évite d'être bloqué.

## 7. Tenir face aux limites du service

| Limite mesurée | Réponse dans le code |
|---|---|
| Une requête à la fois (§ 3.6) | File d'attente série dans `sparql.js`. Aucune exception. |
| 60 secondes maximum (§ 3.2) | Aucune requête sans filtre de catégorie *et* de fenêtre. |
| Le service tombe parfois | Trois tentatives espacées, puis un message nommant le problème. Jamais une page blanche. |
| Latence de 1 à 6 s | Indicateur d'attente dès le premier appel. |
| Rien n'est stocké | Mémoire de session : ce qui a été téléchargé pendant la visite n'est pas redemandé. Tout disparaît à la fermeture de l'onglet. |

**Ce que « mémoire de session » ne veut pas dire :** aucun fichier de données
n'entre dans le dépôt, rien n'est écrit sur le disque du visiteur. C'est
seulement le navigateur qui ne repose pas deux fois la même question.

## 8. L'encart de densité

Une frise qui montre 40 souverains européens et 3 africains pour le XVIIIe
siècle ne dit rien sur l'histoire : elle dit quelque chose sur Wikidata.

L'encart affiche, pour ce qui est à l'écran : le nombre de personnes par
siècle, et **le nombre de personnes écartées faute de dates** (§ 3.7).

Ce n'est pas un ornement. C'est ce qui empêche l'application de faire passer un
trou de la source pour un fait historique.

## 9. Hébergement et livraison

1. Rendre le dépôt public.
2. Activer GitHub Pages sur la branche `main`, dossier racine.
3. L'adresse devient `https://yesno584.github.io/Coeval/`.
4. Vérifier depuis un navigateur : la page s'affiche et les données arrivent.

Toute personne ayant l'adresse peut ouvrir l'application. Rien à installer,
rien à payer.

## 10. Découpage en lots

Chaque lot se termine par quelque chose qui marche et qui se montre.

### L0 — Remettre le vérificateur de code en état
**Avant la première ligne de code produit.** Aujourd'hui `code_rules.json` est
un modèle réglé pour le langage C# et `discover_units.py` ne trouve aucun
dossier à examiner : le vérificateur passe au vert sans rien vérifier.
- Régler `scope.include_globs` sur les fichiers JavaScript, CSS et HTML.
- Régler `scope.unit_discovery` pour qu'il voie les dossiers du projet.
- Regénérer les règles avec l'agent `code-convention-miner` une fois le premier
  code écrit.

**Fini quand :** le vérificateur trouve au moins une unité et signale au moins
une vraie violation sur un fichier volontairement fautif.

### L1 — Le squelette qui affiche quelque chose
`index.html`, `sparql.js` (file d'attente série), `queries.js` (R1 seule),
`model.js`. Pas encore de frise : une liste de noms et de dates à l'écran.

**Fini quand :** la page, ouverte depuis GitHub Pages, affiche les philosophes
vivants en 1800 avec leurs dates, sans erreur dans la console.

### L2 — La frise
`timeline.js` : axe des années, une barre par personne, zoom et défilement.
Les dates imprécises s'affichent avec des bords estompés.

**Fini quand :** les mesures prises dans un vrai navigateur (agent
`static-page-layout-verifier`) confirment le placement des barres, le zoom, et
l'absence d'erreur JavaScript.

### L3 — Les contemporains
`contemporains.js` : clic sur une barre, mise en évidence de tout ce qui
recouvre sa période.

**Fini quand :** cliquer sur Napoléon allume Goethe, Beethoven et Kant, et
n'allume pas Descartes.

### L4 — Les filtres
`filters.js` : catégories (les quatre) et choix d'une personne comme centre.
Les souverains passent par R3, pas par le métier.

**Fini quand :** changer un filtre déclenche exactement une requête, jamais
deux en parallèle, et la frise se met à jour.

### L5 — Robustesse et notoriété
R2 pour le tri, mémoire de session, trois tentatives, messages d'erreur,
indicateur d'attente.

**Fini quand :** couper le réseau pendant une requête produit un message
compréhensible, et pas une page figée.

### L6 — L'encart de densité
`coverage.js`, avec le compte des personnes écartées faute de dates.

**Fini quand :** le nombre affiché est vérifié à la main sur un cas connu.

### L7 — Finition et mise en ligne
Affichage sur téléphone, mode sombre, page publiée, `README.md` expliquant à
quoi sert l'application et d'où viennent les données.

**Fini quand :** l'adresse publique fonctionne depuis un autre appareil.

## 11. Ce qu'il faut préserver pour un portage Flutter

Le portage refera l'interface. Il ne doit pas refaire le reste.

- **`queries.js` et `model.js` sont le cœur transférable.** Les requêtes sont
  du texte, elles se recopient telles quelles dans n'importe quel langage.
- **Garder les requêtes séparées de leur affichage.** Aucune fonction de
  `queries.js` ne doit toucher au HTML.
- **Documenter chaque requête par son critère**, pas seulement par son code :
  « les philosophes dont la vie recouvre la fenêtre » se réécrit ; un bloc
  SPARQL sans explication se recopie mal.
- Les constats du § 3 valent pour Flutter aussi : ce sont des propriétés du
  service Wikidata, pas du navigateur.

## 12. Ce qui reste incertain

- **Le seuil de notoriété n'est pas fixé.** Trop haut, la frise est vide avant
  1500 ; trop bas, elle est illisible. Il se réglera à l'écran, au lot L5.
- **Le nombre de personnes affichables sans ramer** n'a pas été mesuré. Une
  frise SVG tient sans doute quelques milliers de barres ; à vérifier au L2.
- **Les catégories restent à arrêter.** « Scientifique » couvre-t-il les
  médecins, les ingénieurs ? Décision de contenu, pas de technique.
- **Wikidata est biaisé** vers l'Occident, le récent et les hommes. L'encart du
  § 8 rend le biais visible ; il ne le corrige pas. Le corriger demanderait des
  quotas par aire culturelle — un chantier à part entière.
