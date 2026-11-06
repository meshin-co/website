# Tasks

## 1. Find the two causes

- [x] 1.1 Read run 42206394607, escalation issue #98 and the committed claim, and record in the proposal that the run
      stopped after one correction with `paragraph-words`, `sentence-not-in-entry` and `fact-unbound` open, and that the
      13:00 UTC catch-up counted the claim as the slot's entry
- [x] 1.2 Weigh leaving the rule, deleting the claim of a stopped run, and an abandoned status with a bounded forgiveness,
      and record why the first two lost

## 2. The spec moves first

- [x] 2.1 The delta under `specs/` adds the requirement that a stopped run releases its slot within a daily bound and
      modifies the slot requirement of unattended-publishing and the floor requirement of generated-articles
- [ ] 2.2 When the change is archived, the main specs say the same, and `openspec/INDEX.md` and `openspec/CENSUS.json`
      are regenerated

## 3. The configuration

- [x] 3.1 `loop.correctionRounds` (2) and `loop.stoppedRunRetriesPerDay` (1) in `site/engine.config.json`, both required
      and described in `site/scripts/engine-config.schema.json`
- [x] 3.2 `site/scripts/write-draft.mjs` reads the correction budget from the configuration, and the writer and the repair
      rewrite name the number of corrections they made

## 4. The claim

- [x] 4.1 `abandoned` as a third claim status in `site/scripts/autowriter-claim.schema.json`, which still holds the
      claim's slug and title until it expires
- [x] 4.2 `site/scripts/release-claim.mjs` flips the claims named by a decision file from `claimed` to `abandoned`, leaves
      any other status alone and prints `path=` for each claim it changed

## 5. The slot decision

- [x] 5.1 `site/scripts/slot-standing.mjs` forgives up to `loop.stoppedRunRetriesPerDay` abandoned article claims of a
      day and reports `forgiven`, and `site/scripts/slot-due.mjs` and `site/scripts/pick-a-topic.mjs` pass the bound in
- [x] 5.2 `.github/workflows/write-daily.yml` runs `release-claim.mjs` on the failed-write path and commits the released
      claims next to the ledger

## 6. Proof

- [x] 6.1 Tests first, each red before the code: a stopped claim is forgiven once and leaves its slot owed, a second is
      not forgiven, the afternoon slot is still owed, a forgiveness of 0 keeps the old rule, a written claim is never
      forgiven, `release-claim.mjs` releases only a `claimed` claim, and the correction budget comes from the configuration
- [x] 6.2 Prove the tests are the thing holding the change up: with `site/scripts/release-claim.mjs` moved aside its test
      fails to import it, with the forgiveness in `site/scripts/slot-standing.mjs` replaced by 0 four forgiveness tests
      fail, and with the configured budget replaced by a literal 1 the default-budget test fails

## 7. The readers

- [x] 7.1 `site/scripts/README.md` has a row for `release-claim.mjs`
- [x] 7.2 The skill `schedule-the-unattended-writer.md` and the engine adaptation skill name the two keys and the
      abandoned claim

## 8. Calibration Gate

- [x] 8.1 `npm test` and `npm run check` pass on the tree
- [x] 8.2 `npm run test:smoke`, 176 of 176 families proven in 465 s
- [x] 8.3 No route changed: the diff touches `site/scripts/`, `.github/workflows/`, documents and the openspec tree, and
      nothing under `site/src/` or `site/public/`, so Lighthouse, `gate:visual` and the Playwright suite measure nothing
      this change moved. `npm run lh:check` reads `lighthouse evidence covers this tree (3e140e90a8fd)`
- [ ] 8.4 After 14 live UTC days, run the measurements of the proposal and read them against the pre-registered bar: no
      day above 3 article claims, every stopped run's claim abandoned, the stops reported with their denominator.
      Owner-run
- [ ] 8.5 Run the Calibration Gate and commit the report it generates for this change at
      `audits/phase-44-retry-a-stopped-write/REPORT.md`. Owner-run
