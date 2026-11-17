## ADDED Requirements

### Requirement: The writer's mutable records live on an orphan state branch, never in main

The unattended writer SHALL keep its attempt ledger, its topic claims, its escalations, the spend report and the two
demand reports on the orphan branch `autowriter-state`, checked out at the git-ignored folder `state/`. `main` and
every pull request SHALL carry the entry, its generation record and the registers the entry rewrites, and no file of
the state branch.

#### Scenario: The state branch has a fixed layout

- **WHEN** the branch `autowriter-state` is read
- **THEN** it holds `ledger/<year>/<month>/<slug>.json`, `claims/<year>/<month>/<slug>.json`, `spend-report.md`,
  `search-demand.md` and `keyword-demand.md`, the escalations sit inside the ledger they belong to, and the branch
  shares no history with `main`

#### Scenario: A pull request carries no record of the state

- **WHEN** a run writes an entry and opens its pull request
- **THEN** the pull request changes the entry, its generation record and the registers the entry rewrites
  (`audits/routes.json`, the dispositions, `site/content-facts.json`, `docs/SEMANTIC-CORE.md`), and no path under
  `state/` and no path of the old layout

#### Scenario: The claim reaches the state before the model is called

- **WHEN** the picker decides to write
- **THEN** the claims, the ledger and the regenerated spend report are pushed to `autowriter-state` before any
  model is called, and a run whose push did not succeed stops

#### Scenario: Two runs in flight do not touch the same file

- **WHEN** two pull requests are open, each from its own run
- **THEN** no file is changed by both, because the files a run shares with the others live on the state branch

### Requirement: Only commit-state.mjs writes the state branch, and nothing writes main

`site/scripts/commit-state.mjs` SHALL commit paths under `state/` to `autowriter-state` and SHALL refuse any other ref
and any other path, by name. `site/scripts/commit-to-main.mjs` SHALL not exist, and `npm run gate:autowriter` SHALL
fail with `write-to-main` for every workflow or script line that pushes to `main` or names the removed script.

#### Scenario: The ref is refused by name

- **WHEN** `commitState` is called with `ref: 'main'`
- **THEN** it throws and names `autowriter-state` and the ref it was given, and runs no git command

#### Scenario: A path outside the state is refused

- **WHEN** `commitState` is called with a path under `audits/`
- **THEN** it throws and names the folder `state/` and the path

#### Scenario: A state folder that is not a checkout is refused

- **WHEN** `state/` is not a git checkout, or its history shares no commit with the remote branch
- **THEN** `commitState` throws and nothing is committed or pushed

#### Scenario: A workflow that pushes to main fails the gate

- **WHEN** a workflow carries a push of `HEAD` to `main`, or `commit-state.mjs --ref main`, or a step that runs the
  removed script
- **THEN** `npm run gate:autowriter` exits non-zero with `write-to-main`, the file and the line

#### Scenario: The scan reads the forms a push can take

- **WHEN** a line pushes with no refspec, pushes `HEAD` or `@` with no destination, names `master`, or updates
  `refs/heads/main` through the API
- **THEN** `main-write-scan.mjs` reports it with the rule that matched

### Requirement: A gate that reads the state refuses when the state is absent

`recordFiles` SHALL throw `StateMissingError`, which names `state/` and `autowriter-state`, when asked for the ledger
or the claims and `state/` is not a directory, and `npm run gate:autowriter`, `npm run gate:demand` and
`npm run gate:keywords` SHALL fail with the rule `state-missing` in that case.

#### Scenario: The gate runs without a state checkout

- **WHEN** `npm run gate:autowriter` runs in a tree with no `state/` folder
- **THEN** it exits non-zero with `state-missing`, and it prints no count of ledgers or claims as if it had read them

#### Scenario: No flag turns the refusal into a note

- **WHEN** the gate is run with any argument and `state/` is absent
- **THEN** it still fails with `state-missing`, because an absent state is never read as an empty one

#### Scenario: A reader stops

- **WHEN** `slot-due`, `pick:topic`, `audit:spend`, `release-claim` or a deploy script needs a ledger or a claim and
  `state/` is absent
- **THEN** it exits non-zero with a message that names `state/` and `autowriter-state`, and spends nothing

#### Scenario: An empty state is not a missing one

- **WHEN** `state/` exists and holds no ledger yet
- **THEN** the readers read zero records and the gate reports none missing

### Requirement: A record filed in the old layout is refused in the tree

`npm run gate:autowriter` SHALL fail with `legacy-layout-present` for a ledger, a claim, the spend report or a demand
report filed in the layout that predates the state branch, because those records live on the state branch.

#### Scenario: An old pull request merges its ledger back

- **WHEN** a pull request opened before the move changes `audits/autowriter/2026/11/<slug>.json`
- **THEN** `npm run gate:autowriter` fails on its merge tree with `legacy-layout-present` and names the file

#### Scenario: History keeps its own layout

- **WHEN** the history rules judge a pipeline commit that predates the move
- **THEN** they judge it by the layout it used, and they refuse any path under `state/` in a pipeline commit
