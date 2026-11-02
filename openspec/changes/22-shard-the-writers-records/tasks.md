# Tasks

## 1. One place builds the path

- [x] 1.1 `site/scripts/record-layout.mjs` holds the one function, `recordPath(family, slug, date)`, that
      turns a record family, a slug and a date into the path of a ledger, a claim, a generation record
      or a generated disposition, filed under the UTC month of the date; it refuses a date that is not
      a UTC instant, a slug that is not a slug and an unknown family
- [x] 1.2 `LEDGER_DIR`, `CLAIM_DIR`, `GENERATION_DIR`, both `DISPOSITION_DIRECTORY` constants,
      `ledgerFile`, `claimFile`, `generationFile` and `dispositionFile` are gone, and every caller
      builds its path through `recordPath` from the claim's own `claimedAt`
- [x] 1.3 The reason texts a writer puts in a disposition take the paths they name, so no text builder
      knows the layout
- [x] 1.4 The workflow that commits the ledger of a stopped run names the ledger by the path the
      decision file carries, not by a path it assembles

## 2. Every reader finds a record at any depth and says how many

- [x] 2.1 `recordFiles(repoRoot, family)` lists one family recursively; the gate, the spend reader, the
      topic picker, the editorial reader, the stale-disposition list, the repair and the pull-request
      watcher read through it or through `findRecordPath`, and each has a test with a record flat, in
      its month and deeper
- [x] 2.2 The summary of the gate, the editorial gate and the spend reader states how many files or
      rows it read; the spend reader's JSON line gains `ledgers` and `records`
- [x] 2.3 The generation record schema accepts the flat and the month form of the `ledger` field, so
      the spend reader still counts the records on branches written before the layout changed; the
      proposal says when that tolerance ends
- [x] 2.4 The same readers report the same counts before and after the move (real stdout recorded in
      the commit that moved the files)

## 3. A stray flat record fails

- [x] 3.1 `gate:autowriter` reports `record-layout` for a record not filed under `<year>/<month>` and
      for one filed under a month other than the month of its claim, naming where it belongs; the
      hand-written dispositions stay flat
- [x] 3.2 A planted specimen, `autowriterRecordMisfiled`, proves the finding, its `plant` returns the
      restore, and `mutation-smoke.mjs` has a row for it

## 4. What exists is moved

- [x] 4.1 The ledger and the claim of the entry on `main` move into `2026/11` with `git mv`, and
      `git log --follow` on a moved file still shows its earlier commits
- [x] 4.2 Pull request 78 was closed unmerged and its branch deleted, so its generation record and its
      disposition never reach `main` and need no move; its ledger and claim are already filed in `2026/11`

## 5. Two files stay two files

- [x] 5.1 The ledger and the generation record are not merged: `spendWarnings` in `spend-sum.mjs` still
      compares the cost each records, and its tests are unchanged

## 6. Documents

- [x] 6.1 `site/scripts/README.md` has a row for `record-layout.mjs`
- [x] 6.2 The skills that name a record path name the month path, and one of them names
      `record-layout.mjs`

## 7. Calibration Gate

- [x] 7.1 `npm run test:smoke` proves every guard family can still fail, the new one included
- [ ] 7.2 Run the Calibration Gate and commit the report it generates for this change; it needs a fresh
      local Lighthouse measurement, which is taken when the change is pushed
