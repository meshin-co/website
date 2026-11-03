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
- [x] 2.5 The two readers that change 23 adds find a generation record at any depth: the removal
      refusal (`isGenerationRecord` in `autowriter-refusals.mjs`, through `familyOf`) and the list of
      entries the sentence band and the entry length record leave out (`generatedSlugs`, through
      `recordFiles`); each is tested with a record flat, in its month and deeper, and a pipeline
      commit that removes a record filed in its month is refused at the sink and found in history
- [x] 2.6 A claim looked up by slug when the slug was claimed in two months is the newest one
      (`findRecordPath`, the claim family only), and a claim filed outside its month directory beside
      another is still refused as ambiguous; the repair opens from the live claim

## 3. A stray flat record fails

- [x] 3.1 `gate:autowriter` reports `record-layout` for a record not filed under `<year>/<month>` and
      for one filed under a month other than the month of its claim, naming where it belongs; the
      hand-written dispositions stay flat
- [x] 3.2 A planted specimen, `autowriterRecordMisfiled`, proves the finding, its `plant` returns the
      restore, and `mutation-smoke.mjs` has a row for it
- [x] 3.3 A slug claimed again in a later month, after its first claim lapsed, leaves two claim files
      and no `record-layout` finding: each claim is filed under its own month, and any other record
      of the slug is filed under the month of any of its claims

## 4. What exists is moved

- [x] 4.1 The ledger and the claim of the entry on `main` move into `2026/11` with `git mv`, and
      `git log --follow` on a moved file still shows its earlier commits
- [x] 4.2 Pull request 78 was closed unmerged and its branch deleted, so its generation record and its
      disposition never reach `main` and need no move; its ledger and claim are already filed in `2026/11`

## 5. Two files stay two files

- [x] 5.1 The ledger and the generation record are not merged: `spendWarnings` in `spend-sum.mjs` still
      compares the cost each records and keeps its writing-spend sentence
- [x] 5.2 `spendItemsOf` in `spend-sum.mjs` pairs each generation record with the ledger it names, so a
      glossary term joins the run that wrote it, and the month's spend (`monthlyBreakdown`) is the
      sum of the writing calls, the repair calls and the spend of a ledger no record names, each dated
      by its own instant, the last returned as `endedMicro` and `unmatchedMicro` by the verdict of the
      ledger (`hasEnded`); `spend-sources.mjs` reads the records into the same items, so a record whose
      ledger is gone is counted from the record alone, with a sentence that names the slug
- [x] 5.3 A repair that made a model call and ended in any error makes one ledger-only commit
      (`recordFailedSpend` in `site/scripts/repair-finish.mjs`) that the workflow pushes, and a test over
      a real git repository shows `historyReport` accepts it
- [x] 5.4 The refusal of a slug that already has a ledger (`site/scripts/topic-claims.mjs`) names no
      remedy that erases the ledger, and a test says so

## 6. Documents

- [x] 6.1 `site/scripts/README.md` has a row for `record-layout.mjs`
- [x] 6.2 The skills that name a record path name the month path, and one of them names
      `record-layout.mjs`

## 7. Calibration Gate

- [x] 7.1 `npm run test:smoke` proves every guard family can still fail, the new one included
- [x] 7.2 Run the Calibration Gate and commit the report it generates for this change; it needs a fresh
      local Lighthouse measurement, which is taken when the change is pushed
