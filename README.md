# Coeval

**Qui vivait en même temps que qui.**

Une frise chronologique qui montre, pour une période donnée, les personnes et
les événements qui s'y recouvrent. On clique sur Napoléon : tout ce qui
traverse sa vie s'allume — les souverains qui régnaient, les philosophes qui
écrivaient, les guerres en cours.

**En ligne : <https://yesno584.github.io/Coeval/>**

## Ce qu'on peut faire

- Choisir une **période**, de -300000 à 3000. Le signe moins vaut « avant J.-C. ».
- Filtrer par **catégorie** : souverains, philosophes, scientifiques, artistes,
  événements.
- Filtrer par **pays**, ou se **centrer sur une personne** pour ne garder que
  ses contemporains.
- **Regrouper** en bandes : par catégorie, par pays, par siècle.
- Cliquer une barre pour voir tout ce qui recouvre sa période, et **ouvrir sa
  fiche** : chaque information y est modifiable, et l'on peut créer ou
  supprimer une entrée.

Les corrections ne partent nulle part : elles s'enregistrent dans un fichier
sur votre machine, que vous envoyez si vous le voulez. Tant qu'une
modification n'est pas enregistrée, le retour à la frise est barré — mieux
vaut un geste de plus qu'une soirée de travail perdue. Le format du fichier
est décrit dans `socle/contributions.md`, et `socle/fusionner.py` le relit en
produisant un rapport, sans jamais rien modifier de lui-même.

Rien ne se met à jour tant qu'on n'a pas cliqué sur **Charger** — y compris à
l'ouverture : la page ne cherche rien tant que personne n'a rien demandé.

## D'où viennent les données

De **[Wikidata](https://www.wikidata.org)**, sous licence CC0. Chaque nom
affiché renvoie à sa fiche source, d'un clic.

Elles arrivent par **le socle** : un extrait fabriqué chaque nuit par GitHub
Actions et publié à côté de la page. L'affichage est donc immédiat, et la page
n'interroge jamais Wikidata elle-même.

**Le socle se construit sur plusieurs nuits**, parce que Wikidata limite le
débit d'un client persévérant. Une période qui n'y est pas encore n'affiche
rien — et la page le dit, en nommant les siècles déjà disponibles. Elle
annonce d'ailleurs cet état dès l'ouverture, avant toute recherche.

Le code capable d'interroger Wikidata depuis le navigateur existe toujours,
désactivé par le réglage `DIRECT_AUTORISE` de `js/config.js`. Le remettre à
`true` rend ce mode à la page.

## Ce que l'application vous dit, et que d'autres taisent

Une frise qui montre 40 souverains européens et 3 africains pour le XVIII<sup>e</sup>
siècle ne dit rien sur l'histoire : elle dit quelque chose sur Wikidata. Le
bandeau sous les filtres affiche donc, à chaque affichage :

- combien d'entrées sont écartées **faute de date précise** ou **faute de nom** ;
- combien de **dates concurrentes** ont été arbitrées — Wikidata en porte
  souvent plusieurs pour la même personne ;
- combien passent **au-delà du quota** ;
- combien n'ont **aucun pays connu** — 46 % des événements sont dans ce cas.

Une barre **pâle au bord tireté** signale une date connue à l'année seulement.
Afficher « 1746 » comme une certitude quand la source dit « quelque part en
1746 » serait un mensonge d'affichage.

## Le choix des entrées

On ne choisit pas des personnes, on écrit une règle — et la règle est dans le
dépôt, rejouable par quiconque.

- **Souverains** : exhaustif sur un périmètre écrit à la main
  (`socle/perimetre.json`), 58 fonctions de « roi de France » à « Sapa Inca ».
- **Les autres catégories** : les plus notoires par siècle, la notoriété étant
  le nombre de Wikipédias qui ont un article sur la personne.

**Cette mesure est biaisée**, et nous le disons plutôt que de le cacher : elle
penche vers le récent, vers l'Occident et vers les hommes. Robin Williams et
Murasaki Shikibu y sont à égalité. Elle est conservée parce qu'elle est
reproductible et auditable — on peut discuter du résultat parce que la règle
est écrite.

## Faire tourner la fabrique soi-même

```sh
cd socle
python3 test_socle.py                      # les tests, sans réseau
python3 construire.py --siecles 1700 --quota 5   # un essai court
python3 construire.py --budget-minutes 120       # la fabrique complète
python3 construire.py --sans-reseau              # assembler sans interroger
```

Aucune dépendance à installer : Python 3.12 et sa bibliothèque standard.

**Wikidata limite le débit d'un client persévérant** — erreur 429 après une
heure d'interrogations soutenues. La fabrique s'arrête alors proprement et
reprend là où elle en était à l'exécution suivante.

## Le code

```
index.html          la page
css/                mise en forme : fond commun, frise, filtres
js/                 modules : requêtes, file d'attente, modèle, frise, filtres
socle/              la fabrique : requêtes, conversion, périmètre, tests
.claude/plan/       le plan de développement et le modèle de données
```

Pas de cadre logiciel, pas d'étape de compilation, aucune dépendance
téléchargée. Des modules JavaScript standard, que tout navigateur récent
charge directement.

## Licence

Les données viennent de Wikidata, en CC0. Le code est publié tel quel.
