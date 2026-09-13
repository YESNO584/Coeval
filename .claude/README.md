# Claude Code configuration

Everything in this folder works in **any** project. Nothing here knows what
codebase it was extracted from — no product names, no folder layout, no
absolute paths. It was copied out of another repository, which still runs on
its own `.claude/`, untouched.

That is the folder's one hard invariant, and il se revérifie après toute
modification. Le contrôle qui attrape le plus de choses : aucun chemin absolu
de machine ne doit apparaître.

```bash
grep -rnE '/[U]sers/|/[h]ome/[a-z]' . && echo "NOT CLEAN" || echo "clean"
```

(Les crochets ne changent rien à ce qui est cherché — ils empêchent seulement
la ligne ci-dessus de se trouver elle-même.)

Le reste de l'invariant — aucun nom de produit, aucun dossier propre à un
autre projet — ne se teste pas par `grep` sans connaître le mot à chercher :
il se tient en relecture, et l'agent `config-portability-auditor` est là pour
ça.

## Ce qu'il reste à faire pour que la configuration dise quelque chose

Dans cet ordre. Sauter le premier point est la seule façon de se retrouver
avec un harnais qui *a l'air* configuré et ne l'est pas.

1. **Remplir `CLAUDE.md`.** Chaque bloc `<!-- À REMPLIR -->`. Les règles
   autour d'eux fonctionnent telles quelles ; ces blocs sont le seul endroit
   où la connaissance du projet a sa place.
2. **Miner les vraies conventions.** Lancer l'agent `code-convention-miner`
   sur le code et le laisser réécrire `code_rules.json`. Ce qui est livré ici
   est une base générique C# avec tous les champs `evidence` vides : utile au
   premier jour, mais ce n'est pas encore le contrat de *ce* projet. Voir
   « Code rules » plus bas.
3. **Si le projet est en Unity**, ajouter à `settings.json` des entrées `deny`
   qui tiennent Claude à l'écart des caches régénérés par Unity et des
   fichiers `.meta`. Elles ne sont pas livrées ici.
4. **Vérifier que les hooks se déclenchent.** Démarrer une session et
   confirmer que le rappel de reformulation apparaît et que la ligne d'état
   s'affiche. Un hook qui échoue en silence est indiscernable d'un hook qui
   n'est pas configuré.

## Ce qu'il y a ici

### `hooks/`
| Fichier | Ce qu'il fait |
|---|---|
| `enforce-scope.sh` | PreToolUse sur Edit/Write. Résout le chemin visé (liens symboliques et `..` compris) et bloque tout ce qui sort du dossier du projet. Filet de sécurité derrière les motifs `permissions.deny`, que des motifs seuls ne peuvent pas couvrir entièrement. |
| `inject-rules.sh` | UserPromptSubmit. Réinjecte à chaque message la règle « reformuler d'abord, puis attendre confirmation », pour qu'elle survive au résumé du contexte. |
| `statusline.sh` | Modèle, projet, branche git, et coût/contexte sur les versions de Claude Code qui les exposent. |

`enforce-scope.sh` et `statusline.sh` ont besoin de `jq` sur le `PATH` ;
`inject-rules.sh` n'a besoin de rien. Les trois ont été vérifiés dans ce
dépôt, un par un, en leur envoyant une charge JSON sur l'entrée standard —
y compris les cas limites : chemin hors du projet, traversée par `..`,
fichier pas encore créé, charge vide, et absence de `CLAUDE_PROJECT_DIR`.

### `settings.json`
Les règles git allow/deny, les trois hooks, la ligne d'état, `defaultMode:
auto`. Volontairement **absent** : tout ce qui désigne un outil installé sur
une seule machine. Ces règles-là vont dans `settings.local.json`, qui n'est
pas versionné.

Une règle à garder en tête quand ce fichier grossit : dans une règle de
permission `Bash(...)`, `*` veut dire « n'importe quoi à partir d'ici » et ne
peut pas être échappé. Une règle dont le premier `*` n'est pas son dernier
caractère approuve bien plus large qu'elle n'en a l'air. `LEARNINGS.md` porte
l'explication complète.

### `agents/`
| Agent | Réutilisable où |
|---|---|
| `code-convention-miner` | N'importe quel code. Rétro-ingénierie des conventions réelles vers un document de règles. |
| `code-rule-checker-builder` | N'importe quel code. Transforme ce document en vérificateur + rapport qui marchent. |
| `config-portability-auditor` | N'importe quel projet. Trie une configuration `.claude/` entre portable et propre au projet — c'est lui qui a produit ce dossier-ci. |
| `bulk-refactor-verifier` | N'importe quel code, surtout là où le compilateur ne peut pas être lancé depuis la session. |
| `repeated-class-inventory` | N'importe quel code où une classe passe-partout est répétée par module. |
| `runtime-test-log-triager` | N'importe quel projet avec un long journal de tests appareil/CI. |
| `doc-url-reachability-checker` | N'importe quel projet. Dit si les URL citées par la documentation répondent, et si c'est le réseau ou le site qui bloque. |
| `extraction-fidelity-auditor` | N'importe quel extracteur (PDF/HTML/Word/OCR → texte). Mesure la fidélité contre une copie de référence. |
| `rule-change-sample-validator` | N'importe quelle règle d'extraction ou de classement modifiée, validée sur de vrais échantillons. |
| `feature-data-coverage-prober` | N'importe quelle fonctionnalité dont le contenu vient d'un jeu de données externe. Dit si les données la remplissent, chiffres à l'appui. |
| `displayed-figure-discrepancy-tracer` | N'importe quelle interface ou rapport où deux chiffres affichés semblent se contredire. |
| `displayed-text-provenance-auditor` | N'importe quelle interface. Dit, texte par texte, qui l'a écrit : la source, nous, un calcul, ou une IA. |
| `source-grounded-summary-writer` | N'importe quel catalogue ou jeu de données à résumer, avec chaque affirmation traçable. |
| `static-page-layout-verifier` | N'importe quelle page statique HTML/CSS/JS, mesurée dans un vrai navigateur sans réseau. |
| `unity-asset-relocation-planner` | **Projets Unity seulement.** Planifie des déplacements `.asset`/`.meta` sans orpheliner de GUID. |

Les deux dernières lignes valent d'être lues avant de compter dessus :
`static-page-layout-verifier` suppose un navigateur sans tête installé, et
`unity-asset-relocation-planner` ne sert que sur un projet Unity. Ni l'un ni
l'autre ne connaît le projet d'origine ; ils sont gardés parce qu'ils
resserviront tels quels le jour où le contexte s'y prête.

### `scripts/`
| Script | Rôle |
|---|---|
| `discover_units.py` | Découpe le code en unités à reporter. Trois stratégies, choisies dans le fichier de règles. |
| `code_rule_checker.py` | Applique `code_rules.json`. Deux points d'entrée : `check_unit(id)` et `check_all()`. |
| `code_rule_report.py` | Rend le résultat en texte console et en rapport HTML. |
| `audit_report_html.py` | La page HTML elle-même, partagée par tous les vérificateurs. Construire le prochain rapport là-dessus plutôt qu'en faire une cinquième copie du même CSS. |

Aucune dépendance en dehors de la bibliothèque standard de Python 3. Ils se
lancent depuis le dossier `scripts/` (ils s'importent entre voisins) :

```bash
cd .claude/scripts
./discover_units.py                 # ce sur quoi le rapport portera
./code_rule_report.py               # texte + écrit .claude/reports/code_rule_audit.html
./code_rule_report.py --json        # lisible par une machine
./code_rule_checker.py <unit_id>    # une seule unité, pour un garde-fou de pre-commit
```

Sur un dépôt encore vide, `discover_units.py` renvoie **0 unité** et le
rapport est vide : sa stratégie par défaut, `top_level_directories`, ne
compte pas les dossiers commençant par un point, donc pas `.claude/`. Ce
n'est pas une panne, et ce n'est pas non plus un code propre.

### `code_rules.json`
Une base générique C# : 15 règles automatisées plus 3 marquées manuelles, avec
les champs `evidence` volontairement vides.

**Tout, dans une règle, est de la donnée.** Sévérité, expression régulière,
seuils, et chaque exemption (`known_exceptions`, `exempt_name_patterns`,
`exempt_units`, `exempt_type_suffix`) sont lus dans le JSON à l'exécution :
ajuster une règle est une modification de configuration, jamais de code.
Quatre règles sont livrées avec `"enabled": false` parce qu'elles n'ont de
sens que si un projet les demande : `namespace-mirrors-folder`,
`class-naming-prefix`, `unit-manifest-present`,
`public-api-surface-single-entrypoint`.

Deux règles d'honnêteté que le vérificateur s'applique à lui-même :

- Une règle dont le `check.type` vaut `manual`, `manual_or_heuristic` ou
  `manual_diff_review` n'est jamais transformée en constat. Elle est signalée
  à part, comme demandant une relecture humaine.
- Une règle `regex_required` pour laquelle le vérificateur n'a pas de site
  d'extraction est déplacée vers cette même liste manuelle, plutôt que de
  rapporter zéro constat en silence. Une règle qui ne vérifie rien sans le
  dire est pire qu'une règle ouvertement non automatisée.

En ajoutant une exemption, compter d'abord les occurrences réelles et écrire
ce compte dans le champ `evidence` de la règle. Une exemption sans preuve est
indiscernable d'un bug du vérificateur qu'on recouvre.

**Jusqu'où va le changement de langage, exactement.** `scope.include_globs`
choisit bien les fichiers examinés — c'était faux dans la version d'origine,
où le vérificateur ne parcourait que `**/*.cs` quoi qu'en dise le fichier de
règles ; c'est corrigé ici. Mais choisir les fichiers n'est que la moitié du
chemin :

- **Marchent dans n'importe quel langage**, telles quelles :
  `indentation-4-spaces`, `max-line-length`, `max-file-lines`.
- **Restent écrites en syntaxe C#** : toutes les règles `regex_required` /
  `regex_forbidden` / `regex_flagged`, plus
  `one-public-type-per-file-filename-match` et la détection de code tiers par
  préfixe de type. Sur un autre langage elles ne se déclenchent simplement
  pas — c'est-à-dire qu'elles ne signalent rien **sans le dire**.
- Le retrait des commentaires (`_strip_line_comments`) suppose `//`.

Conclusion pratique : pointer `include_globs` sur un autre langage donne trois
règles réelles et une douzaine d'inertes. C'est mieux que zéro, et ce n'est
pas un contrat de qualité. Le vrai geste reste le point 2 de la liste
d'installation — faire miner les règles par `code-convention-miner`, puis
faire réécrire les extracteurs par `code-rule-checker-builder`.

### `reference/store-apis.md`
Comment lister les applications en ligne d'un éditeur et leurs versions depuis
l'API App Store Connect et les deux API Google Play, avec les identifiants que
chacune demande et l'endroit où les raccourcis sans identifiant s'arrêtent.
Utile à n'importe quel projet mobile, propre à aucun.

### `LEARNINGS.md`
Le journal des leçons de session. Il arrive avec les seules entrées qui ne
tiennent à aucun projet — des leçons sur l'outil lui-même. Les entrées datées
de ce projet se rajoutent au-dessus.

## Ce qui n'est délibérément pas ici

- **Tout ce qui tient à une machine** : chemins absolus, outil installé
  localement, liste de permissions accumulée par un utilisateur.
- **Les vérificateurs de domaine** : ils encodent l'architecture du projet
  d'où ils viennent, et une version dé-domainée en serait une réécriture, pas
  une copie. Utiliser `code-rule-checker-builder` pour faire pousser
  l'équivalent ici.
- **`settings.local.json`** : les permissions accumulées au fil d'une session
  ne sont jamais portables. En repartir d'un neuf.
