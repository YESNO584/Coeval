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

### Le vidage du registre après chaque enregistrement
*2026-10-02 · `js/edition.js`, `js/contributions.js`*

`contributions.vider()` n'est plus appelé après un enregistrement, et la
fonction elle-même devient `abandonner()`, qui ne retire que ce qui n'est
pas enregistré.

**Pourquoi :** c'est ce geste qui empêchait le fichier de cumuler. Le
registre **est** le contenu du fichier ; le vider faisait que
l'enregistrement suivant n'écrivait que les opérations postérieures, et
effaçait les précédentes. Le « fichier cumulatif » demandé au lot L6 ne
cumulait rien.

**Avant de le remettre :** il faudrait que le fichier ne soit plus réécrit
entier. Tant qu'il l'est, vider le registre perd des données.

### La reconstruction du bandeau à chaque modification
*2026-10-02 · `js/vues.js`, `barrerLeRetour`*

Le `zone.replaceChildren()` en tête de fonction est retiré : quand le
bandeau est déjà là, seul son texte change et les boutons restent les mêmes
objets.

**Pourquoi :** le bouton « Enregistrer » ne répondait qu'au deuxième clic.
Cliquer dessus après avoir tapé dans un champ fait d'abord quitter ce champ,
ce qui compte une modification, ce qui reconstruisait le bandeau — le bouton
disparaissait entre l'appui et le relâchement, et le clic n'arrivait nulle
part. Invisible à la lecture du code ; trouvé par l'essai en navigateur.

**Avant de le remettre :** il faudrait que le bandeau n'ait pas de bouton,
ou que son contenu change vraiment selon l'état. Ce n'est pas le cas :
seul le compte varie.

### La double définition de la lecture d'un champ
*2026-10-02 · `js/detail.js`*

La fonction `lire(entree, cle)` est retirée de `detail.js` ; elle vient
maintenant de `js/base.js`, où elle fait paire avec son inverse.

**Pourquoi :** lire un champ en texte et le réécrire depuis un texte sont
une seule règle vue des deux côtés. Séparées, elles auraient fini par ne
plus s'accorder — et un désaccord entre les deux se traduit par une
correction qui ne s'applique pas, ou qui s'applique de travers.

---

### Les messages d'état qui n'alertaient de rien
*2026-10-02 · `js/app.js` → `js/etat.js`*

Le cadre d'état ne s'affiche plus que pendant une attente ou sur un
problème. « 5 entrées entre -63 et 80 », « Posez vos filtres, puis cliquez
sur Charger », « Reparti de zéro », « Modifications enregistrées dans X » ne
l'ouvrent plus — les messages existent toujours dans le code, ils ne sont
simplement plus montrés quand rien ne presse.

**Pourquoi :** un cadre toujours présent finit par ne plus être lu, y
compris le jour où il porte une vraie alerte. Ce qu'il disait est déjà
visible ailleurs : le compte d'entrées dans l'encart de densité, le fichier
en cours dans le repère en haut à droite, le résultat sur la frise
elle-même.

**Ce qui reste, et qu'il ne faut pas retirer :** la roue de chargement, les
messages d'erreur, et l'explication quand une recherche ne trouve rien. Ce
dernier point est une règle du plan (§ 8 bis) : une frise vide sans
explication ressemble à une panne.

### « interrogées en direct depuis votre navigateur », au pied de page
*2026-10-02 · `index.html`*

Remplacé par « préparées chaque nuit et publiées avec la page ».

**Pourquoi :** c'était faux depuis que le mode direct est éteint
(2026-09-19). La page ne parle plus à Wikidata ; elle lit le socle.

**Avant de le remettre :** il faudrait rallumer `DIRECT_AUTORISE`. La phrase
et le réglage vont ensemble.

---

### Une opération par champ, dans le fichier de contributions
*2026-10-02 · `socle/contributions.md` (version 2), `js/contributions.js`,
`js/base.js`, `socle/fusionner.py`*

Les clés `champ`, `avant` et `apres` à la racine d'une opération sont
remplacées par un dictionnaire `champs`, qui groupe tous les champs touchés
d'une même entité.

**Pourquoi :** corriger quatre champs d'une personne produisait quatre
lignes répétant la même cible. Même information, fichier deux fois plus
long, et illisible à l'œil.

**La version 1 reste lue**, par la page comme par le script de fusion
(`champsDe` en JavaScript, `champs_de` en Python). Un fichier enregistré
avant ce changement porte du travail que personne ne refera. Ne pas retirer
ces deux fonctions tant que des fichiers version 1 peuvent circuler.

**Ce qui n'a pas changé, et ne doit pas :** `avant` reste, par champ. C'est
le seul moyen de savoir si une correction vise une valeur toujours
d'actualité ou une valeur qu'une nuit de fabrique a déjà remplacée.

**Un piège du groupement, évité :** faire porter le verdict par l'opération
rejetait trois corrections justes parce que la quatrième était périmée. Le
verdict est donc par champ, et le script n'écrit que les champs acceptables.

### Le compteur de modifications par geste
*2026-10-02 · `js/contributions.js`, `nombre()`*

Le compteur `depuisEnregistrement`, incrémenté à chaque appel, est remplacé
par une comparaison entre le registre et son état au dernier
enregistrement.

**Pourquoi :** il comptait les gestes, pas ce qui restait à écrire. Le
bandeau annonçait « 3 modifications non enregistrées » pour un seul champ
changé trois fois, et continuait à compter un champ reposé à sa valeur
d'origine. Mesuré dans le navigateur, pas trouvé à la lecture.

---

### Le métier des souverains, perdu sans que personne le voie
*2026-10-05 · `socle/modele.py` — remise, pas un retrait*

Le champ `detail` d'un souverain devait porter « empereur de Russie ». Il
était vide sur **113 souverains sur 113** au XIXe siècle, et partout
ailleurs.

**Ce qui s'était passé :** le 2026-09-19, `SERVICE wikibase:label` est sorti
des requêtes principales pour qu'elles cessent d'échouer. Les noms des
personnes ont été redemandés à part. **Ceux des fonctions ne l'ont pas
été**, et `convertir_souverains` lisait toujours `fonctionLabel`, qui
n'existait plus. Deux semaines sans que rien ne le signale : un champ vide
ne casse rien, il appauvrit.

**La leçon, inscrite aussi dans LEARNINGS :** quand on sort une donnée d'une
requête pour la demander ailleurs, il faut lister **tous** les usages de
cette donnée, pas seulement celui qu'on avait en tête.

### Les pays en double
*2026-10-05 · `socle/modele.py`, `attacher`*

« Empire russe, Empire russe » sur 76 souverains sur 113. Une même fonction
occupée deux fois rapportait deux fois le même pays. Dédoublonné en gardant
l'ordre, qui porte une information : le premier pays est le principal.

### Le socle publié pouvait rétrécir
*2026-10-05 · `socle/reprendre_en_ligne.py`, `.github/workflows/pages.yml`*

Un socle fraîchement fabriqué ne remplace plus un socle en ligne plus
fourni.

**Pourquoi :** l'empreinte des règles vide le cache dès qu'un fichier de la
fabrique change. La première nuit après le correctif ci-dessus aurait
remplacé 5 626 entrées par les quelques centaines refaites en deux heures —
des semaines de fabrique perdues pour une correction de libellé. Le socle en
ligne garde sa place tant qu'il est le plus fourni, et cède dès que la
reconstruction le dépasse.

**Deux trous comblés au passage**, tous deux signalés le 2026-09-21 et
restés ouverts : le téléchargement du socle en ligne se fait maintenant dans
un dossier provisoire mis en place d'un seul coup — un réseau coupé en route
ne peut plus publier un socle mutilé ; et `verifier_site.py` vérifie que
chaque siècle annoncé par l'index a bien son fichier, au lieu de croire
l'index sur parole.

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
