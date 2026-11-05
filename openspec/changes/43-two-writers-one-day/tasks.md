# Tasks

## 1. Choose the mechanism

- [x] 1.1 List every file the writer commits from the pipeline commits in the history and record in the proposal, file by
      file, whether two runs in flight can collide on it
- [x] 1.2 Weigh not committing derived files, catching the branch up in the watcher, and giving the files a form that
      merges, and record why the last two lost

## 2. The spec moves first

- [x] 2.1 The delta under `specs/` adds the requirement that a pull request main has moved under is caught up and its
      derived files are regenerated, never merged
- [x] 2.2 The main spec of unattended-publishing says the same, and `openspec/INDEX.md` and `openspec/CENSUS.json` are
      regenerated

## 3. The catch-up

- [x] 3.1 `site/scripts/derived-files.mjs` registers the five shared derived files and classifies a path as own, shared,
      restated or foreign
- [x] 3.2 `route-assembly.mjs` has `regenerate` shared by `assembleRoute` and the new `healRoute`
- [x] 3.3 `site/scripts/catch-up.mjs` merges, takes `main`'s side of the derived set, replays the branch's rows,
      regenerates, checks the fixed point and the rows, and commits one merge commit of the bot, or stops with the branch
      as it was
- [x] 3.4 `site/scripts/catch-up-entry.mjs` and `npm run catch-up:entry` print one JSON outcome line for the workflow

## 4. The watcher

- [x] 4.1 `readDrift` and the `drift` of the snapshot, the `catch-up` verdict, `CATCH_UP_CAP` and the `catch-up-cap`
      escalation, the `kind` output, and the `conflict` and `unconverged` outcomes
- [x] 4.2 `watch-pr.yml`: the `catchup` step, secret-free, after the install and before the one push step

## 5. The guard

- [x] 5.1 `gate:autowriter` refuses a pipeline commit that changes a path that is neither own, registered nor a restated
      disposition (`unregistered-path-committed`), with the one legacy commit allowed by its sha and path prefix
- [x] 5.2 The specimen `autowriterCommitAnUnregisteredPath` and the smoke row `autowriter-commit-an-unregistered-path`

## 6. Proof

- [x] 6.1 Tests first, each red before the code: two writer runs branch from one base and collide on exactly the shared
      set, the second merges after a catch-up, a regeneration afterwards changes no byte and loses no row, a branch
      that holds `main` is left alone, a conflict outside the derived set leaves the branch as it was
- [x] 6.2 Watcher tests: the verdict and its quarantine, the unmoved branch, the list GitHub cut short, the cap, the
      drift read, the `kind` output, the outcomes, and the workflow keys and shell of the `catchup` step

## 7. The readers

- [x] 7.1 The skill `watch-an-unattended-pull-request.md` and the scripts README name the catch-up and its scripts

## 8. Calibration Gate

- [ ] 8.1 `npm run test:smoke`, every family, including the new row `autowriter-commit-an-unregistered-path`. Owner-run: it
      needs a full build and three browsers
- [ ] 8.2 Record that no route changed, so Lighthouse, `gate:visual` and the Playwright suite measure nothing this
      change moved. Owner-run
- [ ] 8.3 After 14 live UTC days, run the measurements of the proposal and read them against the pre-registered bar:
      every writer pull request merged with no commit by a person, the five derived files equal to a regeneration on
      the tip of `main`, the catch-ups per pull request reported with a denominator of 28. Owner-run
- [ ] 8.4 Run the Calibration Gate and commit the report it generates for this change under `audits/`. Owner-run
