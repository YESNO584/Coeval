# Session learnings

Append-only log of things learned while working on this project that aren't
derivable from the code, and that would otherwise be rediscovered at cost.
Loaded every session via the root `CLAUDE.md`.

## How to use this file

- **Newest entries at the top**, under a dated `##` heading.
- One bullet per lesson. State the fact, then *why it matters*. Name the file,
  class or flag so it can be verified later.
- If a lesson belongs to one subsystem, put it in that subsystem's own
  `CLAUDE.md` instead and only cross-reference here. This file is for
  cross-cutting or process lessons.
- If a lesson turns out to be wrong, **delete or correct it** — a stale
  learning is worse than none.
- Durable facts about *the user's* preferences go in the auto-memory, not
  here.

---

<!-- À REMPLIR — les entrées datées de ce projet viennent ici, la plus
     récente en haut. Ce qui suit n'appartient à aucun projet : ce sont des
     leçons sur l'outil lui-même, vraies partout, conservées telles quelles. -->

## 2026-09-18 — Lots L0 et L1 de Coeval

- **Le vérificateur coupait toute ligne contenant une adresse web.**
  `_strip_line_comments` faisait `line.split("//")` : le `//` de `https://`
  était lu comme le début d'un commentaire, et tout ce qui suivait devenait
  invisible à chaque règle. Découvert parce qu'une règle qui devait signaler
  l'adresse de Wikidata ne signalait rien — *l'adresse contenait la séquence
  qui la cachait*. Corrigé par un découpage qui tient compte des chaînes de
  caractères. *Le motif à retenir :* une règle muette n'est pas une règle
  respectée ; chercher pourquoi elle se tait.
- **`top_level_directories` laissait `index.html` hors de toute unité.** Les
  fichiers à la racine n'appartiennent à aucun dossier de premier niveau, donc
  le vérificateur ne les lisait jamais — sur un projet dont la page est
  justement à la racine. Basculé sur `single_unit`. *À vérifier sur tout
  projet :* comparer le nombre de fichiers vérifiés au nombre de fichiers du
  dépôt, pas seulement le nombre de constats.
- **Le navigateur de ce conteneur n'atteint pas Wikidata.** Chromium charge
  bien une page servie en local, mais un `fetch` vers l'extérieur échoue, et
  la requête n'apparaît même pas dans `recentRelayFailures` du proxy : elle
  n'arrive pas jusqu'à lui. Ni `--proxy-server`, ni l'option `proxy` de
  Playwright, ni les variables d'environnement n'y changent quelque chose.
  **Conséquence pratique :** une page qui interroge un service distant se
  vérifie ici avec `page.route()` et une réponse enregistrée. L'autorisation
  du service (en-tête `access-control-allow-origin`) se vérifie séparément,
  en `curl`. Ne pas repasser une heure là-dessus.
- **Attention au sens de `<-loopback>`** dans une liste de contournement de
  proxy Chromium : il force le trafic local *à passer* par le proxy, ce qui
  est l'inverse de ce que son nom suggère. Chromium contourne déjà le local
  par défaut ; ne rien préciser est le bon réglage.
- **Wikidata : trois faits mesurés qui commandent toute requête.** L'indice
  `hint:rangeSafe` avec des dates typées fait passer une requête de 58 s
  (échec) à 5,7 s ; demander la notoriété dans la même requête la remonte à
  66 s, alors qu'elle coûte 0,76 s demandée à part sur une liste fermée ; et
  deux requêtes simultanées suffisent à déclencher une limitation de débit.
  Détail et tableau complet dans `.claude/plan/coeval.md` § 3.

---



---

## Ce qui est encore vide dans cette configuration

Vrai au moment de l'installation ; à supprimer une fois réglé.

- **`.claude/code_rules.json` est le modèle générique C#**, avec
  `include_globs` à `**/*.cs` et tous les champs `evidence` vides. Le
  vérificateur tourne sans erreur et annonce « 0 problème » — sur un dépôt qui
  ne contient aucun fichier `.cs`. **Un rapport propre ne prouve donc rien
  aujourd'hui.** À régénérer avec l'agent `code-convention-miner` dans la
  session qui écrira le premier code.
- **Une règle déclarée n'est pas une règle appliquée.** Dans la version
  d'origine de ce vérificateur, `scope.include_globs` était documenté, lu par
  personne, et le parcours de fichiers était figé sur `**/*.cs` : changer le
  JSON en `**/*.py` ne changeait rien, et le rapport restait vert. Corrigé ici
  (`code_rule_checker.py`, `_analyze_one`), et vérifié dans les deux sens — un
  fichier `.cs` trouvé avec les globs par défaut, un fichier `.py` trouvé après
  bascule. *Le motif à retenir :* quand un fichier de configuration promet un
  réglage, chercher qui le lit avant de croire qu'il agit.
- **`discover_units.py` renvoie 0 unité** tant que le dépôt n'a pas de dossier
  de code à la racine : sa stratégie par défaut, `top_level_directories`,
  ignore les dossiers commençant par un point, donc `.claude/`. Ce n'est pas
  une panne. Le réglage vit dans `code_rules.json`, sous
  `scope.unit_discovery`.
- La section « Architecture » du `CLAUDE.md` et la définition trop large de
  « produit source » sont à remplacer dans la session qui crée le premier
  dossier de code.

---

## Permission rules cannot contain a literal `*`

True of Claude Code itself, not of any one codebase.

- **In a `Bash(...)` allow rule, `*` always means "anything from here on" —
  there is no escape.** So a rule recording a command that genuinely contains
  an asterisk (`--include="*.cs"`, or a regex piece like `\s*` or `.*`) does
  not approve that one command: it approves everything matching up to the
  asterisk, including extra options slipped in at that spot, with no prompt.
- **A rule like this can only be deleted, never fixed.** The safe form is a
  wildcard at the very end (`Bash(/usr/bin/grep *)`), which usually already
  covers the command that was being approved, so nothing is lost by deleting
  the over-broad one.
- **`Read(...)` rules are different.** `Read(/tmp/**)` and friends are
  ordinary path globs and are fine; don't sweep them up in the same pass.
- Cheapest way to find these: for each `Bash(...)` rule, check whether the
  first `*` in the body is the last character. If not, the rule is broader
  than it looks.

Worth re-running that check on `.claude/settings.local.json` every few weeks —
these accumulate one one-off search at a time.

---

## Tester un hook : vérifier la charge d'entrée, pas seulement le code de sortie

- `statusline.sh` a affiché `.` comme nom de projet pendant un test. Réflexe
  possible : corriger le script. En réalité **le script lit le champ `.cwd` et
  le test lui envoyait `.workspace.current_dir`** — le script était bon, le
  test était faux. *Pourquoi ça compte :* c'est exactement le troisième
  échec-type listé dans `CLAUDE.md` (« quand un outil et le code ne sont pas
  d'accord, chercher lequel des deux a tort »), rencontré en vrai.
- Les trois hooks se vérifient un par un, en leur envoyant une charge JSON sur
  l'entrée standard : rappel de reformulation, ligne d'état, et blocage
  d'écriture hors du dossier (sortie 2). `jq` est leur seule dépendance.

---

## Un `git status` vide ne veut pas dire « rien n'a été fait »

- Après une reprise de session (contexte résumé), `git status --short` n'a
  rien renvoyé. Interprétation naturelle : les fichiers n'ont pas été créés.
  Interprétation correcte : **tout était déjà commité et poussé** par la
  partie résumée de la session. `git log --oneline` l'a montré en une seconde.
  *La règle du `CLAUDE.md` s'applique exactement ici :* la sortie d'un outil
  est une piste, pas un fait. Avant de conclure qu'un travail n'a pas eu lieu,
  regarder `git log` et `git ls-files`, pas seulement l'état de la copie de
  travail.

---

## Quand une opération réseau ou Git échoue, lire l'état du proxy avant de conclure

- **Une commande :** `curl -sS "$HTTPS_PROXY/__agentproxy/status"`. Le champ
  `recentRelayFailures` nomme chaque hôte refusé. Plus fiable que
  d'interpréter un code d'erreur `curl`.
- Un `recentRelayFailures` **vide** écarte le réseau et ne laisse qu'une
  explication : les droits de la session. Ne pas faire chercher une panne de
  connexion à l'utilisateur pour un refus de droits.
- Le niveau d'accès réseau d'une session se règle à la création de
  l'environnement (`Custom` avec une liste de domaines). À faire une fois, pas
  à rediagnostiquer à chaque session.

---

## Une page statique se vérifie dans un vrai navigateur, sans réseau

Connaissance de l'environnement de session, pas du projet. C'est le mode
d'emploi de l'agent `static-page-layout-verifier`, qui serait inutilisable
sans lui. Vérifié dans ce conteneur le 2026-09-13.

- **Chromium et Playwright sont déjà installés.** Les navigateurs sont dans
  `/opt/pw-browsers` (`PLAYWRIGHT_BROWSERS_PATH` le désigne déjà), et
  `playwright` est un module global dans `/opt/node22/lib/node_modules`.
  **`NODE_PATH` est vide par défaut** : il faut le pointer sur ce dossier pour
  que `require('playwright')` aboutisse. Ne pas lancer `playwright install`.
  *Pourquoi ça compte :* une modification d'affichage peut être **mesurée**
  (largeurs, positions, défilement, erreurs JS) au lieu d'être supposée
  d'après le diff.
- **Deux pièges de cette mise en place**, l'un et l'autre rencontrés : les
  variables de proxy doivent être vidées pour que `127.0.0.1` soit joignable ;
  et `page.setContent()` ne suffit pas — sans adresse de base, les `fetch`
  relatifs de la page ne mènent nulle part. Il faut vraiment servir la page
  (`python3 -m http.server`, puis `page.goto`).

---

## Les tarifs de l'API Claude se vérifient, ils ne se recopient pas

- Ces prix changent, et les recopier de mémoire d'une version d'un document à
  la suivante est le moyen le plus simple d'y laisser un chiffre faux pendant
  des mois. La compétence `claude-api` les donne à jour ; c'est elle qui fait
  foi, pas un document interne.
