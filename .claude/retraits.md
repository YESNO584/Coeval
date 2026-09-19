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
