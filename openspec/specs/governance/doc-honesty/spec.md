# governance/doc-honesty Specification

## Purpose

This capability governs the checks that keep the repository's own words honest: citations in tracked documents and project skills must resolve, generated evidence must carry a revision line, and every gate must have a mutation family that shows it failing on a planted bad input, or be listed as owing one. These checks prove that a cited thing exists and that a gate can go red; they do not prove that a claim is true or that a named revision is real.

## Requirements

### Requirement: A backticked repository path in a tracked document resolves to a file

`site/scripts/docs-gate.mjs` SHALL read every Markdown file that `git ls-files` lists, except under audits, node_modules, dist, .astro and site/src/data, and SHALL fail when a backticked path with a slash and a two- to four-letter lower-case extension resolves to no file next to the citing document, at the repository root, or under `site/`. Placeholders and other tools' folders are skipped, and build output is checked only when a build exists. Guard: npm run gate:docs.

#### Scenario: A document cites a file that is not there

- **WHEN** a tracked document cites a backticked path that none of the three places holds
- **THEN** npm run gate:docs exits 1, printing `dead-path <doc>: <path>` after the summary `docs: <n> files checked, <m> findings`

### Requirement: Every npm script a document names is defined

`site/scripts/run-docs-gate.mjs` SHALL fail when a document it reads names an `npm run` script, backticked or not, that `site/package.json` does not define. `site/scripts/check-skills.mjs` SHALL fail the same way for each line of the first fenced block after the `## Commands` heading of the root `AGENTS.md`. Guards: npm run gate:docs and npm run gate:skills.

#### Scenario: A document names a script that does not exist

- **WHEN** a tracked document names an `npm run` script that `site/package.json` lacks
- **THEN** npm run gate:docs exits 1 with `dead-command <doc>: npm run <name>`

#### Scenario: The AGENTS.md command list names a script that does not exist

- **WHEN** a line in the Commands block of `AGENTS.md` names a script that `site/package.json` lacks
- **THEN** npm run gate:skills exits 1 with `AGENTS.md missing-npm-script ["npm run <name>" has no matching script in package.json]`

### Requirement: A citation that only a git-ignored file satisfies fails

When every file a citation resolves to is matched by `git check-ignore`, `site/scripts/run-docs-gate.mjs` SHALL report the citation although the file is on disk, because a clean checkout lacks it. A negated pattern or a force-added file does not count, build output is exempt, and when git cannot answer, the summary says `ignored-path check skipped (git could not answer)` instead of failing. Guard: npm run gate:docs, with the specimen docsIgnoredPath.

#### Scenario: A document cites a file that only exists locally

- **WHEN** a tracked document cites a backticked path whose only copy on disk is ignored by a rule in a `.gitignore`
- **THEN** npm run gate:docs exits 1 with `ignored-path <doc>: <path> exists on disk, but <source>:<line> (<pattern>) ignores it, so a clean checkout does not hold it`

### Requirement: A row-range claim names the highest locked-decision row

`site/scripts/docs-gate.mjs` SHALL fail a document that claims the locked rows run from the first row to a last row, each written as the letter L and its number and joined by a hyphen or an en dash, when that last row is not the highest row in `docs/plan/reference/locked-decisions.md`. Files ending `.done.md` or `.dropped.md`, that reference itself, and everything under `openspec/changes/archive/` skip this rule. Guard: npm run gate:docs.

#### Scenario: A document quotes an old row range

- **WHEN** a live document claims the rows end below the highest row in the reference
- **THEN** npm run gate:docs exits 1 with a `stale-row-range <doc>` finding that names the claimed range and the range the reference holds

### Requirement: Only a marked record in the investigation folder skips the docs gate

`site/scripts/docs-gate.mjs` SHALL skip a file for every rule only when it lies under `investigation/`, is not `investigation/00-INDEX.md`, and opens with exactly the lines `---`, `record: true` and `---`, and the summary SHALL count each such file as a record exempt. The marker anywhere else, in any other form, or below the first line exempts nothing. Guard: npm run gate:docs, with the specimens docsRecord, docsIndexMarked and docsRecordOutsideCorpus.

#### Scenario: The investigation index carries the marker

- **WHEN** `investigation/00-INDEX.md` opens with the marker and cites a missing path
- **THEN** npm run gate:docs still exits 1 with `dead-path investigation/00-INDEX.md: <path>`

#### Scenario: The marker sits outside the investigation folder or is malformed

- **WHEN** a document outside the investigation folder carries the marker, or a file under `investigation/` says `record: false` in its front matter
- **THEN** the document is checked like any other, and a missing path fails with `dead-path <doc>: <path>`

### Requirement: An archived change skips the row-range rule and nothing else

A Markdown file under `openspec/changes/archive/` SHALL skip only the row-range rule, and `site/scripts/run-docs-gate.mjs` SHALL still fail it on a missing path, an ignored path or an undefined `npm run` script. Guard: npm run gate:docs, proven by the specimen docsArchiveDeadPath in `site/scripts/mutation-specimens.mjs`.

#### Scenario: An archived change cites a missing file

- **WHEN** a file in an archived change cites a backticked path that resolves to nothing
- **THEN** npm run gate:docs exits 1 with `dead-path openspec/changes/archive/<change>/<file>: <path>`

### Requirement: The docs gate fails when it finds no document to check

`site/scripts/run-docs-gate.mjs` SHALL report a finding, not pass, when it discovers no Markdown file to check. It discovers files with `git ls-files` and falls back to walking the folder tree when git fails, so it also runs outside a repository. Guard: npm run gate:docs.

#### Scenario: Discovery returns nothing

- **WHEN** discovery returns no Markdown file
- **THEN** npm run gate:docs exits 1 with `no-docs-discovered (discovery): discovered 0 markdown files to check`

### Requirement: Every path a project skill cites resolves

For each Markdown file under `site/.agents/skills/`, `site/scripts/check-skills.mjs` SHALL fail when a backticked or bare token with a slash, whose first folder is site, docs, audits, openspec, src, scripts, tests, public or .github and which is not build output, resolves under neither the repository root nor `site/`. A missing tail below an existing folder passes only when it holds a template character or a segment made of `phase-` and letters. Guard: npm run gate:skills.

#### Scenario: A skill cites a script that does not exist

- **WHEN** a skill cites a script path that resolves nowhere
- **THEN** npm run gate:skills exits 1 with `<skill> missing-path [<path> does not resolve against the repo]` and `skills: <n> findings`

#### Scenario: The planted specimen proves the check

- **WHEN** npm run test:smoke adds a skill to a disposable copy that cites a missing script
- **THEN** gate:skills must fail there naming `scripts/zz-specimen-missing.mjs does not resolve`, or the family `skill-names-a-missing-script` prints FAIL

### Requirement: A project skill stays within 80 lines and repeats no false claim

`site/scripts/check-skills.mjs` SHALL fail a skill file longer than 80 lines, where a final newline is not a line, and a skill that mentions Pagefind, Decap, a contact form or a repo-side `.perfect-coder/` path, four claims that are false of this repository. Guard: npm run gate:skills.

#### Scenario: A skill grows past the cap

- **WHEN** a skill file reaches 81 lines
- **THEN** npm run gate:skills exits 1 with `<skill> max-lines [81 lines (cap 80)]`

#### Scenario: A skill names a CMS the site never had

- **WHEN** a skill mentions Decap
- **THEN** npm run gate:skills exits 1 with `<skill> forbidden-claim [Decap CMS claim (this repo never had a CMS)]`

### Requirement: Every gate script, test script and harness script is named by a skill

`site/scripts/check-skills.mjs` SHALL fail when a `gate:` or `test:` script in `site/package.json` is named in no skill, and when a non-test `.mjs` or `.cjs` file in `site/scripts/` is named in no skill, is run by no npm script that a skill names, and is not on that script's own one-off list. A name counts when it appears anywhere in the text of any skill. Guard: npm run gate:skills.

#### Scenario: A new gate ships undocumented

- **WHEN** a new `gate:` script is added and no skill names it
- **THEN** npm run gate:skills exits 1 with `package.json undocumented-npm-script ["<key>" is named by no skill]`

#### Scenario: A new harness script ships undocumented

- **WHEN** a new script file in `site/scripts/` is reached by no skill and no documented npm script
- **THEN** npm run gate:skills exits 1 with `site/scripts undocumented-script [<file> is named by no skill, no documented npm script invokes it, and it carries no one-off declaration]`

### Requirement: Every markdown file under audits names a commit that exists

`site/scripts/evidence-gate.mjs` SHALL select every Markdown file under `audits/` and SHALL fail one that carries no line starting `Generated-from: `, or whose first word after it does not match `^[0-9a-f]{7,40}$`, or names an object that `git cat-file -t` does not call `commit`. Guard: npm run gate:evidence.

#### Scenario: A legacy report keeps its prose

- **WHEN** one of the eight paths in `LEGACY_PROSE_PROVENANCE` carries prose in place of a hash
- **THEN** npm run gate:evidence exits 0 and prints the eight allowed paths, while a missing line or a hash naming no commit still fails on those same paths

#### Scenario: An honest old hash is not rejected for its age

- **WHEN** an artefact names a commit that is not an ancestor of HEAD, as the 2026-09-15 history rewrite left behind
- **THEN** npm run gate:evidence exits 0, because ancestry is not checked

#### Scenario: An artefact names no revision

- **WHEN** a Markdown file under `audits/` has no `Generated-from:` line
- **THEN** npm run gate:evidence exits 1 with `EVIDENCE no-provenance <path>: needs a "Generated-from:" line naming the commit it was generated from: every markdown file under audits/ does`

#### Scenario: An artefact names something that is not a commit

- **WHEN** a Markdown file under `audits/` outside the allow-list carries `Generated-from: the current main branch`
- **THEN** npm run gate:evidence exits 1 naming `provenance-not-a-hash <path>`

#### Scenario: The planted specimens prove the check

- **WHEN** npm run test:smoke plants a report whose provenance hash names no object, and one outside the allow-list whose provenance is prose
- **THEN** gate:evidence must fail naming `provenance-not-a-commit audits/phase-zz/REPORT.md` and `provenance-not-a-hash audits/zz-specimen.md`

### Requirement: Every gate script is proven by a mutation family or listed as owed

`site/scripts/mutation-smoke.test.mjs` SHALL fail when a `gate:` script in `site/package.json` is proven by no family in `site/scripts/mutation-smoke.mjs`, where a specimen family proves its specimen's gate, and is not listed in `site/scripts/mutation-pending.mjs`. It SHALL also fail on a pending entry whose gate has a family or no script, and on a specimen that no family runs. One family proves a whole gate, not each of its rules. Guard: these unit tests, run by `npm test`.

#### Scenario: A new gate ships with no specimen

- **WHEN** a new `gate:` script is added with no family and no pending entry
- **THEN** `npm test` fails the test `every gate:* script is proven by a family or named as pending with the change that owes it`, and its diff lists the gate

#### Scenario: A paid debt stays listed

- **WHEN** a pending entry stays after its gate gains a family
- **THEN** `npm test` fails the test `the real pending list owes only gates that exist and still have no family`

### Requirement: An owed specimen names an open change and a reason

Each entry in `site/scripts/mutation-pending.mjs` SHALL name a change directory under `openspec/changes/` that exists and is not archived, and SHALL give a non-blank reason. `site/scripts/plan-gate.mjs` fails otherwise, both in npm run gate:plan and in `site/scripts/mutation-pending.test.mjs`. The specimens pendingUnknownChange and pendingChangeArchived prove the first two checks.

#### Scenario: The owing change does not exist

- **WHEN** an entry names a change that is no directory under `openspec/changes/`
- **THEN** npm run gate:plan exits 1 with `PLAN pending-specimen-unknown-change mutation-pending.mjs owes <gate> to <change>, which names no change under openspec/changes/`

#### Scenario: The owing change is already archived

- **WHEN** an entry names a change that sits under `openspec/changes/archive/`
- **THEN** npm run gate:plan exits 1 with `PLAN pending-specimen-change-archived mutation-pending.mjs owes <gate> to <change>, which is archived as openspec/changes/archive/<YYYY-MM-DD-change>/, so the specimen is overdue`

#### Scenario: The debt gives no reason

- **WHEN** an entry's reason is missing or blank
- **THEN** npm run gate:plan exits 1 with `PLAN pending-specimen-no-reason mutation-pending.mjs lists <gate> with no reason why its specimen is owed`

### Requirement: A specimen counts only when its gate is green without it and red with it

For each specimen family, `site/scripts/mutation-specimens.mjs` SHALL run the gate's real npm script on a disposable copy of the repository and count the family proven only when the run without the specimen exits 0 and does not print the family's token, and the run with it exits non-zero and prints the token. The specimen is removed in a `finally`. Guard: npm run test:smoke, which exits 1 on any failed family.

#### Scenario: A guard stays green on its specimen

- **WHEN** a gate exits 0 with its specimen planted
- **THEN** npm run test:smoke prints `FAIL <family>: <gate> stayed green on the specimen` and `mutation smoke: <p>/<n> families proven, <f> FAILED in <s>s`, and exits 1

#### Scenario: A guard fails for the wrong reason

- **WHEN** a gate exits non-zero with its specimen planted but does not print the token
- **THEN** npm run test:smoke prints `FAIL <family>: <gate> failed for the wrong reason: <output tail>` and exits 1

#### Scenario: The token proves nothing

- **WHEN** the gate is already red, or already prints the token, on the copy without the specimen
- **THEN** npm run test:smoke prints `<gate> was already red on the pristine copy` or `<gate> already prints "<token>" on the pristine copy, so the token proves nothing` for that family and exits 1

### Requirement: The mutation smoke rejects a family that would prove nothing

`site/scripts/mutation-smoke.mjs` SHALL throw before running any family when one has an unknown kind, lacks a field its kind requires, names an unknown gate, check, scope or specimen, or repeats an id. A family that a `--fast` run skips SHALL be labelled `skip` and never counted as proven. Guards: npm run test:smoke and `site/scripts/mutation-smoke.test.mjs`.

#### Scenario: A family of a kind that runs nothing

- **WHEN** a family declares the kind `unit-covered`
- **THEN** npm run test:smoke prints `FAIL smoke-harness: mutation smoke: family <id> has unknown kind unit-covered` and exits 1

#### Scenario: A fast run skips the slow families

- **WHEN** npm run test:smoke runs with `--fast`
- **THEN** each slow family prints `skip <family>: skipped: --fast (needs a full build or a browser)`, and the tally reads `<p>/<n> families proven, <k> skipped` rather than counting them

### Requirement: Specimens are planted only in a disposable standalone copy

`site/scripts/mutation-smoke.mjs` SHALL copy the repository into a temporary folder without node_modules, .astro, dist, .og-cache and test-results, SHALL require that copy to build green before any family runs, and SHALL refuse to plant when the copy's git folder lies outside the copy, so a specimen staged with git cannot reach the real repository. Guard: npm run test:smoke.

#### Scenario: The smoke runs from a git worktree

- **WHEN** the copy's git folder is a link to another repository
- **THEN** npm run test:smoke prints `FAIL smoke-harness: git directory <dir> lies outside <copy>, so a specimen staged there would reach another repository` and exits 1

#### Scenario: The untouched copy does not build

- **WHEN** the copy fails to build before any specimen is planted
- **THEN** npm run test:smoke prints `FAIL baseline-green-copy: <build output tail>`, runs no family, and exits 1
