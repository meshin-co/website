# Tasks

## 1. The layout names the state

- [ ] 1.1 `scripts/record-layout.mjs` exports `STATE_BRANCH` (`autowriter-state`), `STATE_DIRECTORY` (`state`) and
      the state file paths; the `ledger` and `claim` families live under `state/ledger` and `state/claims`, and
      `recordFiles` throws `StateMissingError` for either family when `state/` is not a directory
- [ ] 1.2 `.gitignore` names `/state/`, and `scripts/docs-gate.mjs` treats `state/` as a root a document may cite
      without the gate resolving it

## 2. The one writer of the state

- [ ] 2.1 `scripts/commit-state.mjs` commits paths under `state/` to `autowriter-state` and refuses any other ref and
      any other path, by name; it refuses a `state/` that is not a checkout sharing history with the remote branch
- [ ] 2.2 `scripts/commit-to-main.mjs` is deleted, `runGit` lives in `scripts/run-git.mjs`, and the link repair
      commits its branch through `scripts/commit-branch.mjs`, which refuses `main` and `master` by name
- [ ] 2.3 `scripts/main-write-scan.mjs` finds a push to `main`, a ref named `main`, a push of `HEAD` with no
      destination and the removed script's name in any workflow or script, and `gate:autowriter` reports each as
      `write-to-main`

## 3. The writer's own run

- [ ] 3.1 The pick, the claim, the write, the stopped run and the demand refresh write their records under `state/` and
      commit them with `commit-state.mjs`; the pull request commit holds the entry, its generation record and the
      registers it rewrites, and nothing from `state/`
- [ ] 3.2 `scripts/spend-sources.mjs` reads ledgers from `state/` and generation records from the tree and from every
      autowriter branch, so a record in flight is paired with its ledger

## 4. The watcher and the repair

- [ ] 4.1 `scripts/pr-github.mjs` reads and writes a ledger on the state branch through the contents API; the
      repair job checks `state/` out, writes the ledger and the report there and pushes the state before the pull
      request branch
- [ ] 4.2 `scripts/catch-up.mjs` finds the claims of a branch in `state/`, and the spend report leaves
      `SHARED_DERIVED`

## 5. The gates

- [ ] 5.1 `gate:autowriter` fails with `state-missing` when `state/` is absent, with `legacy-layout-present` when a
      ledger, a claim or the spend report is filed in the old layout, and with `spend-report-missing`,
      `spend-report-differs` or `spend-report-understated` for the report
- [ ] 5.2 `gate:demand` and `gate:keywords` read their reports from `state/` and fail with `state-missing`
- [ ] 5.3 The history rules keep judging the pipeline commits that predate the move by the old layout and refuse
      any `state/` path in a pipeline commit

## 6. The workflows

- [ ] 6.1 `ci.yml`, `write-daily.yml`, `watch-pr.yml`, `publish-live.yml` and `measure-keywords.yml` check the state
      branch out at `state/` before every step that reads it, and the jobs that write it carry the bot token
- [ ] 6.2 `write-daily.yml` and `measure-keywords.yml` contain no push to `main` and no `commit-to-main.mjs`

## 7. The records move

- [ ] 7.1 The orphan branch `autowriter-state` holds the 30 ledgers (17 escalations), the 30 claims, the spend
      report and the two demand reports of 5771c87, and `main` holds none of them
- [ ] 7.2 `node scripts/spend-report.mjs` against that state reads 1.395913 USD, 16 entries and 6 warnings for
      2026-11

## 8. Guards proven able to fail

- [ ] 8.1 Planted specimens for `write-to-main` and `state-missing`, each named in `npm run test:smoke`, each failing
      with its own message when its guard is removed
- [ ] 8.2 Planted specimens for `legacy-layout-present` and `spend-report-understated`

## 9. The words that cite the old paths

- [ ] 9.1 Every skill, document and script map that named a moved path or `commit-to-main.mjs` names the state
      branch, and `site/.agents/skills/report-what-the-writer-spends.md` says how a person runs the report locally
- [ ] 9.2 `npm run gate:docs`, `npm run gate:skills` and `npm run gate:plan` read green
- [ ] 9.3 The deltas of this change modify every requirement of `governance/unattended-publishing`,
      `governance/spend-reporting` and `discovery/search-demand` that names a moved path, a commit to `main` or a
      byte-for-byte regeneration of the spend report; only the new requirements are written so far

## 10. Calibration Gate

- [ ] 10.1 `npm run build`, then `GATE_PHASE=49-move-the-records-off-main npm run gate:lh` reading 100 on both form
      factors for every audited route, then `npm run lh:record`
- [ ] 10.2 `node scripts/report.mjs 49-move-the-records-off-main ../audits/phase-49-move-the-records-off-main`
      generates the report, and it reads `Result: PASS`
