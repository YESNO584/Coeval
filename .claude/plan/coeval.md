# Coeval — plan de développement

> Écrit le 2026-09-18, révisé le même jour après mesure du service Wikidata et
> lecture du dépôt AN-API. Architecture arrêtée : **option C**.

## 1. Le produit en une page

**Coeval répond à une question : que se passait-il en même temps ?**

Une frise chronologique. Chaque personne est une barre qui va de sa naissance à
sa mort ; chaque événement est un point (le sacre de Napoléon, 2 décembre 1804)
ou une barre (la Révolution française, 1789-1799). On clique sur Napoléon :
tout ce qui recouvre sa vie s'allume — les souverains régnants, les
philosophes vivants, les guerres en cours.

Deux filtres : **par catégorie** (souverains, philosophes, scientifiques,
artistes, événements) et **par personne** (on choisit une figure, la frise se
recentre sur sa période).

### Dans la version 1

- La frise, ses deux filtres, le clic « montre-moi ce qui était contemporain ».
- Une fiche minimale : nom, dates, catégorie, lien vers la source.
- Un encart de densité : combien d'entrées par siècle, et combien ont été
  écartées faute de date ou de nom (§ 8).

### Hors périmètre, explicitement

- La carte et les frontières historiques.
- Les lieux de résidence datés, les époques nommées (PeriodO).
- Tout compte utilisateur, toute base de données.
- L'application Flutter. Le § 11 dit quoi préserver pour elle.
- **La persistance dans le navigateur (IndexedDB).** Écartée sur décision de
  l'utilisateur le 2026-09-18. Elle deviendrait utile si le socle grossissait
  au point que le téléchargement par siècle devienne pesant ; ce n'est pas le
  cas. Idée conservée ici pour ne pas être redécouverte, pas pour être
  réactivée seule.

## 2. Décisions arrêtées

| Décision | Choix |
|---|---|
| Forme livrée | Pages HTML statiques, fichiers séparés |
| Architecture | **Option C** : socle fabriqué chaque nuit + requêtes en direct pour le reste |
| Hébergement | GitHub Pages en mode « GitHub Actions », dépôt public |
| Version 1 | Frise seule, sans carte |
| Quota du socle | **60 par catégorie et par siècle** |
| Correction du biais | **Option 1** : quota par siècle seul, déséquilibre rendu visible (§ 8) |
| Branche | `main` |

## 3. Ce qui a été mesuré

Obtenu en interrogeant réellement le service Wikidata le 2026-09-18. **Ce ne
sont pas des suppositions.** Tout le reste du plan en découle.

### 3.1 Wikidata autorise les appels depuis n'importe quel site

En-tête `access-control-allow-origin: *`. Une page servie par GitHub Pages peut
l'interroger directement.

### 3.2 Ce qui échoue

| Requête | Résultat |
|---|---|
| Tous les vivants en 1800, triés par notoriété | **502 après 58 s** |
| *Compter* tous les humains ayant vécu au XVIIIe siècle | **504 après 72 s** |
| Compter cinq métiers groupés sur ce siècle | **504 après 65 s** |
| Une catégorie + notoriété, sur une année | **66 s** — au-delà du budget |

**Le service coupe à 60 secondes.** « Tout le monde » n'est pas une requête,
même pour un simple comptage, même sur une machine qui a la nuit devant elle.

### 3.3 Ce qui marche, et à quel prix

| Requête | Temps | Volume |
|---|---|---|
| Philosophes vivants une année donnée | **5,7 s** | 400 (limite atteinte) |
| *Compter* les philosophes d'un siècle | **3,3 s** | **2 856** |
| Souverains dont un règne débute au XVIIIe | **11 s** | 712 |
| Événements du XVIIIe (4 classes) | **12 s** | 357 |
| Notoriété d'un lot de 400 identifiants | **0,76 s** | 400 |
| Les mêmes philosophes **avec la précision des dates** | **3,1 s** | 400 lignes |
| Les mêmes, avec le filtre `BestRank` | **11,1 s** | 400 lignes |

**Attention, cette règle a été corrigée le 2026-09-18 — voir § 3.3 quater.**
Un siècle tient pour un *comptage*, pas pour une requête qui ramène des
lignes.

### 3.3 bis — 400 lignes ne font pas 400 personnes

Mesuré le 2026-09-18 : **400 lignes renvoyées, 227 personnes seulement**, dont
80 en double. Wikidata porte plusieurs dates concurrentes pour la même
personne — une naissance à l'année et une au jour, deux morts à un jour
d'écart — et la requête multiplie les combinaisons. Une personne avec deux
naissances et deux morts occupe quatre lignes.

Le filtre `BestRank` réduit les doublons (364 personnes sur 400 lignes) mais
coûte **11,1 s au lieu de 3,1 s** et en laisse encore passer 32. Les doublons
sont donc résolus dans le code, gratuitement et complètement : on garde la
date la plus précise, et à précision égale la plus ancienne, pour que deux
exécutions donnent le même résultat.

**Conséquence pour les volumes :** toute estimation tirée d'un nombre de
lignes est fausse d'environ 40 %. Compter les personnes, jamais les lignes.

### 3.3 ter — La précision des dates ne coûte rien

Demander `wikibase:timePrecision` en même temps que la date : **3,1 s**, contre
5,7 s pour la même requête sans elle. Elle est donc demandée systématiquement.
Les codes rencontrés : 9 (année), 10 (mois), 11 (jour). Sur 400 lignes de
philosophes, 90 sont à l'année seulement.

Une date moins précise que l'année est écartée : une barre placée à partir
d'une décennie ne veut rien dire.

### 3.3 quater — Un siècle est trop large dès qu'on ramène des lignes

La même requête, celle que produit le code :

| Fenêtre | Résultat |
|---|---|
| 1700 – 1800 | **502 au premier essai**, 19,6 s au second |
| 1780 – 1800 | **4,9 s**, stable |

Le comptage du § 3.3 ne ramenait qu'un nombre ; une requête qui ramène 400
lignes avec leurs libellés coûte bien plus cher. **Toute fenêtre est donc
découpée en tranches d'au plus 25 ans**, envoyées l'une après l'autre : le
temps total est le même, mais aucune requête ne frôle le plafond.

### 3.3 quinquies — Le pays coûte cher dans la requête, rien à côté

| Façon de demander le pays | Temps | Personnes |
|---|---|---|
| Dans la requête principale | **13,2 s** | 173 sur 400 lignes |
| À part, sur une liste fermée | **1,1 s** | 222 sur 228 |

Couverture : **97 % des personnes** portent un pays, mais **46 % seulement des
événements**. D'où la bande « indéterminé », qui n'est pas un ornement.

Le pays d'un souverain ne vient pas de sa nationalité mais de la fonction
qu'il occupe : `P1001` (juridiction), `P17` à défaut. Vérifié — « roi de
France et de Navarre » pointe vers le royaume de France *et* celui de
Basse-Navarre, et apparaît donc dans les deux bandes.

**La fragmentation est mesurée : 62 pays pour 228 personnes, dont 40 pays
n'en comptent qu'une ou deux.** Les bandes les plus fournies sont gardées, le
reste va sous « autres ».

### 3.4 Les deux ingrédients qui font passer une requête de 58 s à 5,7 s

```sparql
PREFIX hint: <http://www.bigdata.com/queryHints#>
?p wdt:P569 ?birth . hint:Prior hint:rangeSafe true .
FILTER(?birth <= "1800-01-01T00:00:00Z"^^xsd:dateTime)
```

- `hint:Prior hint:rangeSafe true` autorise le moteur à utiliser son index.
- La date doit être comparée comme une date typée. `YEAR(?birth) <= 1800` force
  la lecture de toutes les lignes et ruine la requête.

### 3.5 La notoriété se demande à part

Demandée dans la requête principale : 66 s. Demandée ensuite sur une liste
fermée d'identifiants : **0,76 s pour 400**. Motif à appliquer partout.

### 3.6 Deux requêtes en parallèle sont refusées

Erreur 429 dès deux appels simultanés. **Les requêtes partent une par une**,
côté navigateur comme côté fabrique.

### 3.7 Les dates manquent souvent

Sur 83 « rois des Francs » remontés, le premier de la liste n'a ni naissance ni
mort. **Sans date, pas de place sur une frise.** Ces entrées sont écartées et
comptées (§ 8).

### 3.8 « Sous-classe de monarque » ramène un corpus inattendu

La requête des souverains passe par les fonctions qui descendent de
« monarque ». Sur le XVIIIe siècle, les huit premiers résultats sont des
évêques-princes et des abbés. Ce n'est pas une erreur du moteur : ces charges
*sont* des souverainetés dans l'arbre de Wikidata.

**Conséquence : la liste des fonctions retenues doit être écrite à la main**,
explicitement, dans le dépôt. Le périmètre est un choix qu'on assume et qu'on
peut discuter ; il ne doit pas être le sous-produit accidentel d'un arbre de
classes.

### 3.9 Un identifiant sans libellé, et un concept qui n'est pas une personne

Dans un échantillon de test, `Q7325` — « Juifs », qui n'est pas une personne —
obtient un score de notoriété de 181. Et trois identifiants sont revenus sans
aucun nom.

Deux règles :
- le filtre « est un être humain » s'applique **avant** toute mesure ;
- **on n'affiche jamais un nom qu'on n'a pas reçu de la source.** Une entrée
  sans nom est écartée et comptée, comme une entrée sans date.

### 3.10 Un lien vers un fichier HTML dans GitHub n'affiche pas la page

GitHub sert les fichiers bruts comme du texte. On voit le code source. **Pages
est obligatoire**, en mode « GitHub Actions » (§ 9).

## 4. Architecture

### 4.1 Les deux moitiés

**La fabrique** tourne dans GitHub Actions, une fois par jour. Elle interroge
Wikidata sans se presser, écrit des fichiers JSON, et les publie.

**La page** lit ces fichiers. Elle n'interroge Wikidata que pour ce que le
socle ne contient pas (§ 6.3).

Toutes les contraintes du § 3 cessent d'être subies par le visiteur : elles
deviennent le problème d'une machine qui travaille la nuit.

### 4.2 Les fichiers

```
index.html
css/coeval.css
js/config.js          catégories, quotas, adresses
js/socle.js           chargement des fichiers du socle, par siècle
js/sparql.js          file d'attente série, envoi, erreurs, mémoire de visite
js/queries.js         les requêtes en direct
js/model.js           normalisation, filtres de qualité, comptage des écartés
js/timeline.js        la frise en SVG                       (lot L2)
js/filters.js         les deux filtres                      (lot L4)
js/contemporains.js   calcul des recouvrements              (lot L3)
js/coverage.js        encart de densité                     (lot L6)
js/app.js             assemblage

socle/construire.py   la fabrique
socle/requetes/       les requêtes SPARQL, un fichier par usage, versionnées
socle/perimetre.json  la liste explicite des fonctions souveraines (§ 3.8)
socle/test_*.py       tests de la fabrique
socle/public/         ce qui est publié — produit, jamais commité
.github/workflows/socle.yml
```

**Le socle n'est pas commité.** Il est fabriqué à chaque exécution et publié
directement. Le dépôt ne contient que du code et des critères.

### 4.3 Un fichier par siècle

```
data/index.json     les siècles disponibles, leurs comptes, la date de fabrication
data/1700.json      le XVIIIe siècle
data/1800.json      le XIXe
```

La page ne charge que ce qu'elle affiche. **L'unité de fabrication mesurée au
§ 3.3 — une catégorie × un siècle — est aussi l'unité de fichier.**

## 5. Le modèle de données

Deux types, un seul format commun : tout ce qui s'affiche est **une entrée avec
un début et une fin**.

```js
{
  id: "Q517",
  type: "personne",              // ou "evenement"
  nom: "Napoléon Ier",           // jamais inventé — § 3.9
  debut: { annee: 1769, precision: "jour", brut: "1769-08-15" },
  fin:   { annee: 1821, precision: "jour", brut: "1821-05-05" },
  instantane: false,             // true pour un événement ponctuel
  categories: ["souverain"],
  notoriete: 287,
  sourceUrl: "https://www.wikidata.org/wiki/Q517"
}
```

Règles :

1. **L'identifiant Wikidata est la clé.** Jamais le nom.
2. **Une date porte toujours sa précision.** Une frise qui affiche « 1450 »
   pour un « vers 1450 » ment. La barre a des bords estompés.
3. **Un événement ponctuel a `debut == fin` et `instantane: true`.** La frise
   le dessine comme un repère, pas comme une barre d'un jour invisible.
4. **`sourceUrl` n'est pas décoratif.** Toute affirmation remonte à sa source
   en un clic.

## 6. La sélection : ce que contient le socle

**On ne choisit pas des personnes, on écrit une règle.** Chaque règle vit dans
`socle/requetes/`, versionnée, rejouable par quiconque.

### 6.1 Les trois familles

**Souverains — exhaustif sur un périmètre écrit à la main.** La liste des
fonctions retenues est dans `socle/perimetre.json` (§ 3.8). Une fois la
fonction retenue, *tous* ses détenteurs entrent, le célèbre comme l'obscur.
Le périmètre est arbitraire et assumé ; le contenu ne l'est pas.

**Philosophes, scientifiques, artistes — les 60 plus notoires par siècle.**
2 856 philosophes pour le seul XVIIIe siècle : tout prendre est impossible.

**Événements — les 60 plus notoires par siècle.** Classes retenues : événement
historique, guerre, révolution, traité. Les batailles sont volontairement
exclues du socle en version 1 : elles sont des milliers et noieraient le reste.
Elles restent accessibles en direct (§ 6.3).

**Filtre de qualité partout** : être un humain pour les personnes (§ 3.9),
avoir un nom, avoir des dates connues à l'année au moins.

### 6.2 Comment « les plus notoires » est défini

**Le nombre de Wikipédias qui ont un article sur l'entité.** Wikidata publie ce
compte ; il coûte 0,76 s pour 400 entités (§ 3.5).

Mesuré le 2026-09-18 :

| Liens | Personne |
|---:|---|
| 313 | Confucius |
| 287 | Napoléon Ier |
| 253 | Emmanuel Kant |
| 161 | Robin Williams |
| 161 | Murasaki Shikibu |
| 132 | Ada Lovelace |
| 26 | Paul Wittgenstein |

**Le biais tient dans deux lignes de ce tableau : Robin Williams et Murasaki
Shikibu sont à égalité.** Un acteur mort en 2014 pèse autant que la femme qui a
écrit le premier roman de l'histoire. Cette mesure ne dit pas qui compte dans
l'histoire ; elle dit qui intéresse les gens qui écrivent Wikipédia aujourd'hui.
Elle penche vers le récent, vers l'Occident, vers les hommes.

**Elle est conservée malgré cela**, pour une raison : elle est reproductible et
auditable. On peut discuter du résultat parce que la règle est écrite. Une
sélection « au jugé » ne s'audite pas.

Écartées, et pourquoi :
- *le nombre de déclarations sur la fiche* — mesure la richesse de la fiche, pas
  la renommée : Napoléon 614 contre Confucius 379, ce qui inverse le classement.
  Gardé seulement pour départager deux égalités ;
- *les consultations Wikipédia* — changent chaque mois, le socle cesserait d'être
  reproductible ;
- *un jugement d'IA* — invérifiable, et contraire au principe « le jeu de
  données est une requête ».

**Correction du biais : option 1.** Le quota par siècle corrige le penchant vers
le récent. Le penchant vers l'Occident n'est pas corrigé — il est **rendu
visible** (§ 8). Corriger un biais mesuré est plus simple que corriger un biais
supposé.

### 6.3 Ce qui déclenche une requête en direct

Trois cas, et trois seulement :

1. **une entité absente du socle** — une requête sur un identifiant, instantanée ;
2. **« montre-moi tout le monde »** sur une période — au-delà des 60 ;
3. **une catégorie non fabriquée** — médecins, explorateurs, batailles.

## 7. Tenir face aux limites

| Limite mesurée | Réponse |
|---|---|
| Une requête à la fois (§ 3.6) | File d'attente série, dans la page comme dans la fabrique |
| 60 secondes maximum (§ 3.2) | Aucune requête sans catégorie **et** sans fenêtre de temps |
| Le service tombe | La page marche quand même : le socle est déjà publié |
| Latence 1 à 12 s | Ne concerne plus que la fabrique, la nuit |
| Rien n'est stocké chez le visiteur | Mémoire de visite seulement : ce qui a été chargé n'est pas rechargé tant que l'onglet est ouvert |

**Repris d'AN-API — le refus de publier des données vides.** Avant publication,
la fabrique vérifie ses propres comptes et **s'arrête** s'ils sont
invraisemblables. Sans ce garde-fou, une panne de Wikidata remplacerait un site
correct par un site vide sans que personne s'en aperçoive.

**Repris d'AN-API — l'empreinte des règles dans la clé du cache.** Le cache de
GitHub Actions porte dans sa clé une empreinte des fichiers de requêtes.
Modifier une requête refait le calcul complet tout seul, sans que personne ait
à y penser.

## 8. L'encart de densité

Une frise qui montre 40 souverains européens et 3 africains pour le XVIIIe
siècle ne dit rien sur l'histoire : elle dit quelque chose sur Wikidata.

L'encart affiche, pour ce qui est à l'écran :
- le nombre d'entrées par siècle et par catégorie ;
- **le nombre d'entrées écartées**, avec leur motif : pas de date (§ 3.7), pas
  de nom (§ 3.9), hors quota.

C'est la contrepartie de l'option 1 retenue au § 6.2. Sans cet encart, le choix
de ne pas corriger le biais deviendrait un mensonge par omission.

## 9. Hébergement

Mode **GitHub Actions**, comme le dépôt AN-API du même compte. Les deux
réglages manuels (*Actions → autoriser les workflows*, *Pages → Source :
GitHub Actions*) ont été faits par l'utilisateur le 2026-09-18.

`.github/workflows/pages.yml` publie la page à chaque poussée sur `main`, et
**refuse de publier** si un fichier du site manque ou est vide. Le lot L5 y
ajoutera la fabrique du socle.

Adresse : `https://yesno584.github.io/Coeval/`.

## 10. Découpage en lots

### L0 — Remettre le vérificateur de code en état ✅ fait le 2026-09-18
**Avant la première ligne de code produit.** Aujourd'hui `code_rules.json` est
réglé pour le C# et `discover_units.py` ne trouve aucune unité : le
vérificateur passe au vert sans rien lire.

**Fini quand :** il trouve au moins une unité et signale une vraie violation sur
un fichier volontairement fautif.

### L1 — Le squelette qui affiche quelque chose ✅ fait le 2026-09-18
`index.html`, `config.js`, `sparql.js` (file série), `queries.js`, `model.js`.
Pas de frise : une liste de noms et de dates, obtenue en direct.

**Fini quand :** la page affiche les philosophes vivants en 1800 avec leurs
dates, sans erreur dans la console, et n'envoie jamais deux requêtes en même
temps.

### L2 — La frise ✅ fait le 2026-09-18
Axe des années, une barre par entrée rangée en couloirs, zoom, défilement.
Barres pâles à bord tireté pour les dates connues à l'année seulement.

**Mesuré dans Chromium :** 60 barres, 60 couloirs, aucun recouvrement dans un
couloir ; le grossissement porte la largeur de 702 à 1 123 pixels et le
défilement s'active ; un clic estompe les 59 autres barres ; une date floue
s'affiche à 0,4 d'opacité contre 0,85, bord tireté 3/2 ; aucune erreur en
console.

**Ce que la mesure a révélé :** sans quota, 227 vies qui se chevauchent
occupent 227 couloirs, soit une frise de 5 036 pixels de haut — illisible. Le
quota du § 6.1 est donc appliqué à l'affichage, et ce qui passe au-dessus est
compté à l'écran.

**Repères des événements ponctuels :** reportés au lot qui introduit les
événements, faute d'événements à dessiner aujourd'hui.

### L3 — Les contemporains
**Fini quand :** cliquer sur Napoléon allume Goethe, Beethoven et la Révolution
française, et n'allume pas Descartes.

### L4 — Les filtres et le regroupement ✅ fait le 2026-09-18
Absorbe le lot L3. Deux sortes de filtres : ceux qui changent ce qu'il faut
demander (période, catégories) et ceux qui ne font que trier ce qui est déjà
là (pays, regroupement, entrée servant de centre). Les seconds ne coûtent
aucune requête. Les événements entrent dans l'application. La colonne de
gauche porte une bande par valeur, avec « autres » et « indéterminé ».

**Mesuré dans Chromium :** 918 entrées en 3 bandes de catégorie dont 169
événements ponctuels dessinés en losange ; 13 bandes au regroupement par pays,
obtenues **sans aucune requête supplémentaire** ; la somme des hauteurs de la
colonne (5 788 px) correspond à celle de la frise moins l'axe (5 822 px) ;
10 requêtes au total, **jamais deux en même temps** ; aucune erreur en console.

**Trois défauts trouvés par la mesure, et corrigés :**

- **Un règne sans date de fin passait tous les filtres.** Écrite avec
  `!BOUND(?fin)`, la condition laissait entrer un règne commencé en 2599 av.
  J.-C. dans une fenêtre 1780-1805, étirant la frise sur 4 500 ans. Remplacé
  par `COALESCE(?fin, ?debut)` : une fin inconnue est traitée comme égale au
  début, la lecture prudente.
- **Le quota effaçait une catégorie entière.** Appliqué globalement, il
  supprimait *tous* les événements, dont la notoriété est bien plus basse que
  celle des personnes. Le plan disait « par catégorie » ; le code ne le
  faisait pas. Corrigé — et c'est exactement le genre d'écart qu'un chiffre
  affiché à l'écran ne suffit pas à révéler.
- **Le code plantait sur une ligne incomplète** au lieu de l'écarter et de la
  compter, ce qui rendait la page entièrement blanche. Toutes les lectures de
  réponse passent maintenant par une aide qui ne lève jamais d'erreur.

### L5 — La fabrique
`socle/construire.py`, `socle/requetes/`, `socle/perimetre.json`, le workflow,
le refus de publier des données vides, l'empreinte des règles.

**Fini quand :** une exécution complète produit `data/index.json` et au moins
trois fichiers de siècle, et qu'une exécution avec une requête volontairement
cassée **refuse de publier**.

### L6 — Socle et direct ensemble
`socle.js`, et les trois cas de bascule vers le direct (§ 6.3). Encart de
densité.

**Fini quand :** la page s'ouvre sans attendre sur le socle, et qu'une personne
absente du socle s'affiche quand même après une requête en direct.

### L7 — Finition et mise en ligne
Téléphone, mode sombre, `README.md` disant d'où viennent les données.

**Fini quand :** l'adresse publique fonctionne depuis un autre appareil.

## 11. Ce qu'il faut préserver pour un portage Flutter

- **`socle/requetes/` et `js/model.js` sont le cœur transférable.** Les requêtes
  sont du texte : elles se recopient dans n'importe quel langage.
- **Le socle publié est une API.** Une application Flutter lira les mêmes
  fichiers JSON, sans rien réécrire.
- **Aucune fonction de requête ne touche au HTML.**
- **Chaque requête est documentée par son critère**, pas seulement par son code.
- Les constats du § 3 sont des propriétés du service Wikidata, pas du
  navigateur : ils valent pour Flutter aussi.

## 12. Ce qui reste incertain

- **Le quota de 60 est un point de départ**, à regarder à l'écran.
- **Le nombre d'entrées affichables sans ralentir** n'est toujours pas mesuré :
  le quota ramène l'affichage à 60 barres, bien en deçà de la limite. La
  question se reposera quand les filtres permettront de tout demander.
- **Le périmètre des fonctions souveraines** (§ 3.8) est à écrire à la main,
  monarchie par monarchie. Décision de contenu, et elle presse : au
  regroupement par pays, des bandes comme « Hochstift » ou « diocèse de
  Spire » se hissent parmi les plus fournies, parce que l'arbre des classes
  de Wikidata range les évêques-princes parmi les souverains.
- **Des pays font double emploi** : « Hongrie » et « royaume de Hongrie »
  forment deux bandes distinctes. Les rapprocher demanderait de suivre les
  liens entre un État historique et son successeur moderne — un chantier à
  part, non mesuré.
- **Le volume total du socle** n'est pas connu : il dépend du périmètre
  ci-dessus. Mesurable dès le L5.
