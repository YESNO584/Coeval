# Period — Project Memory

> **Configuration extraite d'un autre projet.** Tout ce qui suit fonctionne
> tel quel. Les seuls endroits à remplir sont marqués `<!-- À REMPLIR -->` :
> ce sont les seuls endroits où la connaissance de *ce* projet a sa place.
> Voir `.claude/README.md` pour la marche à suivre complète.

## Each prompt triggers these rules
- Never edit anything outside of this folder, or nested folders.
- Limit all read operations to the scope of this project, except if explicitly
  required by the prompt. Reading is allowed for any file or internet source
  shared directly in a message.
- Reformulate every prompt to make it optimal for Claude Code, and ask for
  confirmation. Only start responding after the reformulation is confirmed.

## Architecture

<!-- À REMPLIR — ce que fait le projet, en deux ou trois phrases, puis le
     tableau des dossiers. Tant que ce bloc n'est pas rempli, une session
     découvre le dépôt à l'aveugle à chaque fois.

| Dossier | Ce qu'il contient |
|---|---|
| `<dossier>` | <ce qu'il contient, et lequel est le cœur du code> |
| `.claude/` | La configuration Claude Code |

     Puis, sous le tableau, les décisions structurantes du projet : une puce
     par décision, chacune disant *pourquoi*, et datée. Ce sont elles qui
     évitent qu'une session redécouvre — ou défasse — un choix déjà tranché.
-->

## Read these first
- `.claude/LEARNINGS.md` — cross-session lessons. Read at the start of every
  session; append to it at the end of one.
- `.claude/code_rules.json` — the code-quality contract the checker enforces.
  Worth reading before writing code, because it is currently a **generic C#
  template**, not this project's rules: its `scope.include_globs` is `**/*.cs`
  and every `evidence` field is empty. If this project turns out not to be C#,
  that file is wrong and must be re-mined before its report means anything.
- `.claude/reference/store-apis.md` — how to list a publisher's live apps and
  versions from the App Store Connect and Google Play APIs. Only relevant if
  this project ends up talking to the mobile stores; ignore otherwise.

## Checks
| Checker | How to run | Report |
|---|---|---|
| Code rules | `cd .claude/scripts && ./code_rule_report.py` | `.claude/reports/code_rule_audit.html` |
| Code rules, one unit | `cd .claude/scripts && ./code_rule_checker.py <unit_id>` | console |
| Unit discovery | `cd .claude/scripts && ./discover_units.py` | console |

<!-- À REMPLIR — ajouter ici les vérificateurs propres au projet (tests,
     build, lint) à mesure qu'ils existent, avec la commande exacte. -->

**When it MUST be run:** before any commit that adds or changes source files,
and again before opening a pull request. It is not wired into a git hook —
nothing runs it for you.

**Caveat that outranks the table:** a clean run from this checker is not
evidence of clean code today — it is evidence that nothing was checked. Three
reasons, all of them fixable, none of them fixed yet:

- `.claude/code_rules.json` is still the **generic C# template**
  (`include_globs: ["**/*.cs"]`, every `evidence` empty). Re-mine it with the
  `code-convention-miner` agent in the session that writes the first real code.
- `discover_units.py` finds **0 units** on a repo whose only top-level folder
  is `.claude/` — its default strategy skips dot-directories. Empty report,
  for that reason and no other.
- Pointing `include_globs` at another language now really does change which
  files are read (that was broken upstream and is fixed here), but only three
  rules — indentation, line length, file length — are language-neutral. The
  rest are written in C# syntax and stay silent elsewhere. See
  `.claude/README.md`, § `code_rules.json`.

## External / vendored code
- <!-- À REMPLIR — aucun code tiers en arbre pour l'instant. -->
- When vendored code is added, list its folders here and register them in
  `.claude/code_rules.json` under `scope.vendor_detection.path_contains_any`,
  so the checker stops linting code we do not own.
- The standing rule for that code: **wrap, don't patch.** If a bug looks like
  it is in vendor code, check our wrapper first.

# Project Rules

## Scope enforcement (mechanically enforced — see .claude/settings.json)
- Edits/writes are restricted to this folder and its subfolders. This is
  enforced by `permissions.deny` plus the `enforce-scope.sh` PreToolUse hook —
  it is not optional and does not depend on remembering this instruction.
- Reads are limited to this project's scope. This half is **not** mechanically
  enforced: `.claude/settings.json` has no `permissions.ask` section, and the
  `enforce-scope.sh` hook only fires on Edit/Write. Reading outside the project
  falls back on Claude Code's own confirmation prompt and on this instruction
  being followed. Files or internet sources shared directly in a prompt are
  always fine to read.

## Before starting any task
Never begin acting on a prompt directly. First, restate the request in a
clear, optimized form for Claude Code:
- explicit scope (which files/subsystems this touches)
- expected output/deliverable
- constraints or things to avoid

Then ask: "Is this correct?" and stop. Do not read (beyond what's needed to
reformulate), edit, or run anything until the user explicitly confirms the
reformulation. This is reinforced on every message via a UserPromptSubmit
hook (`inject-rules.sh`), but the actual "wait for confirmation" behavior
depends on Claude following it — no hook can force a pause mid-turn.

## Branche de travail

**La branche par défaut du dépôt est la branche du projet.** Ici, c'est
`main`. Tout s'y développe et s'y pousse.

- Ne créez **pas** de branche `claude/...` ou de branche de fonctionnalité de
  votre propre initiative. Une autre branche ne se crée que si l'utilisateur
  le demande explicitement dans le prompt.
- Si la configuration de la session vous **assigne** une branche (les sessions
  distantes le font systématiquement, avec un nom de la forme
  `claude/<sujet>-<suffixe>`), cette consigne-ci l'emporte : basculer sur la
  branche du projet (`git checkout main`) avant de commiter, et pousser
  dessus.
- La consigne ne peut pas être imposée mécaniquement : aucun hook ne peut
  changer la branche assignée au démarrage. Elle repose sur le fait de la
  lire — d'où sa place ici.

Deux limites de droits, mesurées sur ce type de session, à connaître avant de
promettre quoi que ce soit sur les branches :

- **Une session ne peut pas supprimer une branche distante.** `git push
  origin --delete` renvoie `403`, de façon reproductible. Ce n'est pas le
  réseau : les droits de la session ne le permettent pas. La suppression se
  fait à la main sur GitHub.
- **Désigner la branche par défaut du dépôt** n'est pas accessible d'ici non
  plus. Ce réglage se fait sur GitHub.

## Self-configuration (standing authorization)
Claude may create, edit and override its own harness configuration in this
project without asking each time: `.claude/agents/**`, `.claude/skills/**`,
`.claude/hooks/**`, `.claude/scripts/**`, `.claude/settings*.json`, this file,
any nested `CLAUDE.md`, `.claude/LEARNINGS.md`, and the auto-memory directory.
The intent is that each session's learnings are written back into config so
the next session starts better informed.

Editing product source is NOT covered by this — source changes are asked for
first, as usual. Adding a `CLAUDE.md` inside a subsystem folder is.

Product source, for this rule, means **every file in the repository that is
not `.claude/**` and not this `CLAUDE.md`.** That deliberately broad wording
is the only safe one while the repository is empty: with no source layout to
name, a narrower glob would silently exempt whatever gets created first.
Replace it with the real glob (e.g. `src/**/*.ts`) in the same session that
creates the source folder.

## Check before you answer

Understand the whole thing before saying anything. Assume nothing. Almost
every answer is already somewhere in the project — read the code, run the
checkers, read the scripts themselves, check git history. Look it up instead
of guessing.

**Say "I'm not sure" only when the information genuinely isn't anywhere.**
Doubt is a last resort, not a shortcut past the checking. And when it is
genuine, say plainly what is unknown and what was already tried.

**A tool's output is a lead, not a fact.** Confirm it against the source
before repeating it or acting on it. Three real failures of this kind, worth
keeping as the shape to watch for:

- A checker script was run from the command line to capture a baseline. It
  had no command-line entry point, so it printed nothing and reported
  success — 18 empty files were written and the mistake only surfaced when a
  later comparison crashed. *Check that a command actually produced output.*
- A count of "7 skipped checks" was repeated from an audit report. Reading
  the file showed 8, and that the damage was wider than the audit could see.
  *Read the file before quoting a number.*
- A test was flagged as broken by a checker. Counting by hand showed the test
  was right and the checker was wrong; the checker got fixed instead of the
  test. *When a tool and the code disagree, find out which one is wrong.*

This does not override the reformulation rule above. The boundary:

- **Before the user confirms** — look only as far as needed to describe the
  job accurately.
- **After the user confirms** — verify everything, and don't guess.

## How to answer

Write for someone who knows nothing about the subject. These rules are about
answers in the chat, not about code comments or the documents under
`.claude/`, which stay precise.

- **Simple words.** Skip a technical term whenever a plain one works. If a
  technical term is unavoidable, say in a few words what it means.
- **Big picture first.** A short overview of what happened and what it means
  beats a long, detailed description. Add detail only where it changes what
  the user would decide or do.
- **One name per thing.** Pick a name and keep it for the whole conversation.
  Never switch between two words for the same thing (e.g. don't alternate
  between "the checker", "the audit" and "the script" — choose one).
- **Problems: the first sentence is the whole problem.** If something is
  wrong, the opening sentence alone must be enough to understand it. Put the
  cause, the consequence and the fix after that, shortest first.
- **Say what it means, not just what was done.** "This test can never pass"
  beats "the declared count differs from the reachable count".

## Token usage visibility
Exact token/cost usage is shown in the status line (see
`.claude/hooks/statusline.sh`) and via the built-in `/cost` command — not
something for Claude to compute or report in its answers, since it has no
reliable access to the exact running total.
