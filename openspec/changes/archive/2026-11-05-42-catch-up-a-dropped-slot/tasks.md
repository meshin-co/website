# Tasks

## 1. Choose the mechanism

- [x] 1.1 Read the run history of the workflow with `gh run list` and record in the proposal that GitHub started two
      scheduled runs in its life and none on 2026-11-05
- [x] 1.2 Weigh extra cron entries that end at once against a reconciliation workflow and an outside pinger, and
      record why the first was chosen

## 2. The spec moves first

- [x] 2.1 The delta under `specs/` modifies the schedule requirement to cover the catch-up delays and adds the
      requirement that a dropped slot is run late and a filled slot is never run twice
- [x] 2.2 The main spec of unattended-publishing says the same, and `openspec/INDEX.md` and `openspec/CENSUS.json`
      are regenerated

## 3. The configuration and the cron block

- [x] 3.1 `loop.catchUpAfterMinutes` in `site/engine.config.json`, its schema entry, the seed and the load-time checks
      for a delay past midnight, on a write time or on another delay's minute
- [x] 3.2 `npm run assets:schedule` writes one cron entry for each time and for each time and delay, and
      `npm run gate:schedule` names a catch-up cron written by hand as `cron-extra` and a deleted one as `cron-missing`

## 4. The slot decision

- [x] 4.1 `site/scripts/slot-standing.mjs` counts the article claims of a UTC day against the write times that have passed
- [x] 4.2 `site/scripts/slot-due.mjs` and a `due` job at the head of `write-daily.yml`, which `ceiling` and `write`
      wait for, end a satisfied scheduled run before any model and always let a manual run write

## 5. The record

- [x] 5.1 `catchUp` on the claim schema and the generation record schema, on `newClaim` and on `buildRun`, stamped by
      the picker from the claims it already reads
- [x] 5.2 `npm run measure:origins` prints entries on time against caught up and lists each catch-up

## 6. Proof

- [x] 6.1 Tests first, each red before the code: a missed slot is picked up, a satisfied slot is not run twice,
      the claim and record carry `catchUp`, the picker stamps it, the workflow waits for `due`, the configuration
      refuses a clashing delay, and the schedule gate names a catch-up cron edited by hand
- [x] 6.2 Two `gate:schedule` specimens, a catch-up cron written by hand and one removed, and the smoke rows
      `write-schedule-catch-up-hand-written` and `write-schedule-catch-up-removed`

## 7. The readers

- [x] 7.1 The skill `schedule-the-unattended-writer.md`, the scripts README, the engine adaptation skill and the
      new-site interview say what the catch-up is and which key sets it

## 8. Calibration Gate

- [x] 8.1 `npm run test:smoke`, every family, including the two new schedule rows. Owner-run: it needs a full build and
      three browsers
- [x] 8.2 Record that no route changed, so Lighthouse, `gate:visual` and the Playwright suite measure nothing this
      change moved. Owner-run
- [x] 8.3 (moved to gap row G68, not done) After 14 live UTC days, run the three measurements of the proposal and read them against the pre-registered
      bar: no day with three claims, each served slot with its claim, the catch-up share reported with its denominator
      of 28. Owner-run
- [x] 8.4 Run the Calibration Gate and commit the report it generates for this change, as change 26 owes, at
      `audits/phase-42-catchup/REPORT.md`. Owner-run

## What the Calibration Gate measured

- `npm run test:smoke`: 175 families, every one proven, with
  `write-schedule-catch-up-hand-written` and `write-schedule-catch-up-removed` among them.
- Lighthouse: 8 shards, 0 failures, recorded as `d763b1f03c97`, report in
  `audits/phase-42-catchup/REPORT.md`. No route changed: the change touches the workflow, the
  schedule modules and `slot-due.mjs`, and `gate:routes` reported `+0 -0`.
- The guard proved itself on the real corpus rather than a fixture: with today's two claims
  present, `slot-due.mjs` refuses to write at 13:30, 15:20 and 23:00 UTC, each time naming
  2 claims against the slots passed, and stops before any model call.

Task 8.3 needs 14 live UTC days and is in gap row G68.
