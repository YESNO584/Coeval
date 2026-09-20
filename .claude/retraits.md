# Ce qui a été retiré, et pourquoi

Registre des suppressions. **Tenu à jour à chaque retrait**, conformément à la
règle « Ce qui est retiré s'écrit » du `CLAUDE.md`.

Trois colonnes, et la troisième est la seule qui compte dans six mois :
*pourquoi*. L'historique Git dit toujours **quoi** ; il ne dit jamais
**pourquoi**, ni **ce qu'il faudrait savoir avant de le remettre**.

Deux registres séparés, parce qu'ils ne se lisent pas pareil : ce qui est
**parti**, et ce qui est **éteint mais toujours là**.

---

## Retiré

### `css/coeval.css` → `base.css` + `frise.css` + `filtres.css`
*2026-09-18, lot L4*

La feuille unique avait atteint 369 lignes, au-delà du seuil de 250 fixé par
les règles de code au lot L0. **Découpée plutôt que le seuil relevé** : elle
couvrait trois sujets distincts, ce que le seuil signalait justement.

**Avant de revenir en arrière :** il faudrait relever le seuil, et se demander
ce qu'on perd à ne plus être averti.

### Les 21 règles de code C#
*2026-09-18, lot L0*

Le `code_rules.json` d'origine venait d'un autre projet : `include_globs` à
`**/*.cs`, sur un dépôt sans un seul fichier C#. Il annonçait « zéro
problème » sans rien lire. Remplacé par 15 règles écrites pour JavaScript,
CSS et HTML, dont quatre découlent de mesures.

**Ce qui a été perdu, et assumé :** les règles de nommage et de structure
propres à C# (préfixe de classe, un type public par fichier, espace de noms
reflétant le dossier). Elles n'avaient aucun sens ici.

**À savoir :** les trois seules règles réellement portables d'un langage à
l'autre sont l'indentation, la longueur de ligne et la longueur de fichier.
Les autres se réécrivent.

### Le regroupement « fourchette » et son réglage de largeur
*2026-09-18, à la demande de l'utilisateur*

Le menu « largeur » n'était pas clair, et la fourchette faisait double emploi
avec le regroupement par siècle. Les bornes viennent désormais des dates
saisies. Restent quatre regroupements : aucun, catégorie, pays, siècle.

**Avant de le remettre :** il faudra répondre à la question qui l'a fait
retirer — en quoi « fourchette de 50 ans » se distingue-t-il de « siècle »
pour quelqu'un qui découvre l'écran ?

### Le chargement automatique à l'ouverture
*2026-09-19, à la demande de l'utilisateur*

La page cherchait d'office les philosophes de 1780-1805. Elle travaillait pour
une question que personne n'avait posée. Elle lit maintenant le seul index du
socle et attend un clic.

**Ce qui l'a remplacé :** un message d'accueil qui annonce ce que le socle
contient — plus utile qu'une frise que personne n'a demandée.

### Quatre copies de la fabrique d'éléments HTML
*2026-09-19, lot d'édition*

La même fonction `creer(balise, classe, texte)` existait dans `app.js`,
`detail.js` et `vues.js`, plus une quatrième variante `creerHtml` dans
`timeline.js`. Réunies dans `js/html.js`.

**Pourquoi ça comptait :** c'est la fonction qui décide comment un texte entre
dans la page — par `textContent`, jamais par `innerHTML`, puisque les noms
viennent d'une source que n'importe qui peut modifier. Quatre copies d'une
règle de sécurité finissent par diverger.

### Le service de libellés dans les trois requêtes principales
*2026-09-19 · `socle/requetes.py`*

`SERVICE wikibase:label` retiré de `personnes_vivantes`, `souverains_regnants`
et `evenements`. Les noms viennent maintenant de `libelles()`, sur une liste
fermée d'identifiants.

**Pourquoi :** il faisait échouer les requêtes des catégories à gros
effectifs. Zéro artiste et un seul siècle de philosophes après deux heures de
fabrique. Sans lui, la même case rend 340 entrées nommées.

**Avant de le remettre :** il faudrait expliquer comment « philosophes sur un
siècle dense » tiendrait dans le budget du service, ce qu'aucune mesure ne
permet aujourd'hui.

**Reste en place**, volontairement, dans `js/queries.js` : ce code est éteint
(voir plus bas) et ses requêtes n'ont jamais dépassé une fenêtre de vingt-cinq
ans, où le service de libellés tenait.

---

### La boucle « un métier à la fois »
*2026-09-20 · `socle/construire.py`*

La boucle `for metier in categorie["metiers"]` est retirée : les métiers
d'une catégorie repartent dans une seule requête, comme avant le
2026-09-19.

**Pourquoi :** elle avait été écrite en croyant qu'un gros métier coûtait
trop cher demandé avec les autres. La mesure dit l'inverse. Le peintre seul
met 65 secondes et échoue (504, deux fois de suite) ; les cinq métiers
d'« artistes » réunis répondent en 20 secondes et rendent 202 personnes. Un
`VALUES` à plusieurs entrées laisse le planificateur passer par les dates ;
avec une seule valeur il parcourt tous les peintres. La boucle coûtait donc
cinq requêtes au lieu d'une, et chacune trois fois plus cher.

**Avant de la remettre :** il faudrait une mesure montrant un métier qui
passe seul et pas en groupe. Aucune ne l'a jamais montré ; celle qui a servi
à écrire la boucle était une erreur 504 attribuée à la taille du métier
sans avoir comparé au groupe.

### Le découpage d'une fenêtre simplement lente
*2026-09-20 · `socle/wikidata.py`, `par_tranches`*

Le délai court qui déclenchait la coupe (`DELAI_DECOUPE_S`, 30 s) devient un
réglage passé par l'appelant. Les catégories de métier passent
`DELAI_MAX_S` : elles ne sont plus coupées pour cause de lenteur, seulement
sur refus du service ou sur réponse pleine.

**Pourquoi :** rétrécir la fenêtre ralentit ces requêtes. Mesuré le
2026-09-19 : cinq ans dépassent 90 secondes là où un siècle entier en met
20. Comme ces requêtes répondent entre 20 et 68 secondes, le seuil de 30 s
les déclarait toutes trop larges, et la case dépensait ses cinq minutes en
découpages sans qu'une seule requête aboutisse. C'est la cause de zéro
artiste dans le socle.

**Toujours en place pour les événements**, où le coût suit vraiment la
période : le § 3.3 quater du plan porte la mesure qui le justifie.

**Ajouté au passage**, et c'est un manque comblé, pas un retrait : une
réponse qui atteint le plafond de la requête est désormais découpée. Elle a
perdu des lignes en silence — les artistes de 1500 à 1600 rendent exactement
400 lignes, le plafond. Sans cela, relever le seuil aurait fait publier des
cases incomplètes comme si elles étaient complètes.

---

### La vérification en shell des trois fichiers indispensables
*2026-09-20 · `.github/workflows/pages.yml`*

La boucle `for fichier in site/index.html …` est retirée de l'atelier. La
même règle vit maintenant dans `socle/verifier_site.py`, qui vérifie aussi
le socle.

**Pourquoi :** elle ne regardait que le code de la page, jamais les données.
Un socle vide passait, et remplaçait 1 155 entrées par rien. Deux endroits
pour une même règle finissent toujours par diverger — c'est la leçon des
quatre copies de la fabrique d'éléments HTML, plus haut dans ce registre.

**Avant de la remettre :** il faudrait une raison de vérifier le code de la
page sans vérifier ses données. Il n'y en a pas tant que le mode direct est
éteint : une page sans socle est une page morte.

---

## Éteint, mais toujours là

Ces éléments **n'ont pas été supprimés**. Ils sont dans le code, derrière un
réglage. Les supprimer ferait perdre le travail de mise au point ; les laisser
actifs ferait autre chose que ce qui est voulu.

### Interroger Wikidata depuis la page — « le direct »
*2026-09-19 · réglage `DIRECT_AUTORISE` de `js/config.js`, à `false`*

Le socle est devenu la seule source, sur décision de l'utilisateur.

**Ce qui vit encore :** `js/sparql.js` (file d'attente série, reprises,
limitation de débit), `js/queries.js` (les quatre requêtes), et la branche
correspondante de `js/chargement.js`.

**Pourquoi ne pas l'avoir supprimé :** ce code a coûté plusieurs lots de mise
au point, et ses mesures sont inscrites au § 3 du plan. Un `git revert`
rendrait le code, mais pas l'intention — personne ne relit l'historique pour
retrouver une capacité qu'il ignore avoir eue.

**Ce que le rallumer change :** une période absente du socle serait complétée
en direct au lieu d'être signalée comme absente. Et l'ouverture de la page
redeviendrait lente.

### Trois fonctions souveraines génériques
*2026-09-19 · groupe `generique` de `socle/perimetre.json`, `actif: false`*

`Q12097` roi, `Q116` monarque, `Q39018` empereur — **1 496 détenteurs à elles
trois**, soit plus du tiers du périmètre actif.

**Pourquoi éteintes :** elles ne portent aucun État. Tous leurs détenteurs
atterriraient dans la bande « indéterminé » du regroupement par pays.

**Ce que les rallumer change :** beaucoup plus de monde sur la frise, et une
bande « indéterminé » qui écrase les autres. C'est un arbitrage entre
couverture et sens géographique, pas une erreur à corriger.

---

## Jamais entré dans le dépôt

Pour mémoire, et pour qu'on ne les cherche pas : `js/_faute_volontaire.js`
(fichier volontairement fautif, écrit au lot L0 pour prouver que le
vérificateur voyait quelque chose — 16 constats sur 9 règles) et un lien
`data` vers `socle/public/data` (pour éprouver la lecture du socle en local).
Les deux ont été retirés avant d'être commités.
