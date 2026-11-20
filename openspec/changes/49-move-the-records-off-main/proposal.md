# Move the records off main

## Why

The unattended writer opens one pull request per article, and any two open pull requests collide. Three were
landed by hand on 2026-11-17 at a cost of about five hours, and six were open again that evening.

The cause is not the articles. It is where the writer keeps its own records. Measured at `5771c87` with
`git log main --author=autowriter-bot`:

- 86 bot commits are reachable from `main`, and 81 of them are first-parent commits, pushed straight to `main`:
  36 refreshes of the Search Console demand report, 30 `claim:` commits, 7 `record the stopped run` commits, 6
  `record the measurement debt` commits and 2 refreshes of the Bing keyword report.
- 25 of the 86 touch a file that every run rewrites whole (`audits/routes.json`,
  `audits/phase-4.7/dispositions/routes.json`, `audits/spend-report.md`, `docs/SEMANTIC-CORE.md`,
  `site/content-facts.json`), and 16 of those 25 are the claim commit, made before any money is spent.
- One autowriter pull request carries 12 to 16 files, 5 or 6 of them shared.

Every run commits its claim, its ledger and the regenerated spend report to `main` first. That moves `main` under
every pull request already in flight, on a file both sides rewrite whole. Change 43 taught the watcher to catch a
pull request up after the fact. It did not stop `main` moving.

`~/work/projects/TradingTune` runs the same engine and has 0 bot commits on `main`. Its mutable records live on an
orphan branch, `autowriter-state`, that shares no history with `main`, and its pull requests carry 2 files, both
named after the article.

### The objection this answers

Change 43 (`archive/2026-11-06-43-two-writers-one-day`) rejected this design in one sentence: the gates that judge a
pull request read the committed files, so a pull request without them is either red or judged by a gate that read
nothing, which is a fake green.

TradingTune answered it, and change 43 did not consider how. The gate reads the state through a side checkout and
refuses to run without it. This change takes that answer and makes the refusal the default, not an option: a gate
that finds no state folder fails with its own rule, `state-missing`, and a planted specimen proves it fires.

## What changes

**The mutable records leave `main` for the orphan branch `autowriter-state`, checked out at `state/`.**

| Moves to the state branch                                                     | Stays in `main` and in the pull request                                                |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| the attempt ledger, `state/ledger/<year>/<month>/<slug>.json`                 | the article and its generation record, `audits/autowriter/generations/...`             |
| the topic claims, `state/claims/<year>/<month>/<slug>.json`                   | `audits/routes.json` and everything under `audits/phase-4.7/dispositions/`             |
| the escalations, which the ledger carries                                     | `site/content-facts.json`                                                              |
| the spend report, `state/spend-report.md`                                     | `docs/SEMANTIC-CORE.md`                                                                |
| the demand reports, `state/search-demand.md` and `state/keyword-demand.md`    |                                                                                        |

The owner fixed the first four rows and the right-hand column. The demand reports are the one row he did not name,
and they move for a reason that is evidence and not taste: `write-daily.yml` pushes the Search Console report to
`main` on every run (36 of the 81 first-parent bot commits) and `measure-keywords.yml` pushes the Bing report
weekly (2). The writer cannot be refused `main` by name while its own workflow still pushes there, and TradingTune's
state branch holds the same two files. Neither report is in any pull request, so neither ever collided.

The generation record stays in `main`. It is per article and keyed by slug, no two pull requests write the same
one, and TradingTune keeps it there too. Nothing found while writing this change is evidence against that.

### The writer can no longer write to main

- `site/scripts/commit-to-main.mjs` is deleted. `site/scripts/commit-state.mjs` replaces it and refuses, by name,
  any ref but `autowriter-state` and any path outside `state/`.
- `site/scripts/main-write-scan.mjs` reads every workflow and every script and reports each line that pushes to
  `main`, names `main` as a ref, pushes `HEAD` with no destination, or names the removed script. `gate:autowriter`
  fails with `write-to-main` on each.
- `site/scripts/commit-branch.mjs` keeps the one thing the old script did that was never about `main`: committing
  the link repair to its own branch. It refuses `main` and `master` by name.

### No gate judges nothing

`recordFiles` refuses to list the ledger or the claims, and every reader of a moved record refuses to read it, when
`state/` is absent. `gate:autowriter` reports `state-missing`, `gate:demand` and `gate:keywords` report
`state-missing`, and `slot-due`, `pick:topic`, `audit:spend`, `release-claim` and the deploy scripts stop with a
message that names the folder and the branch. `ci.yml`, `write-daily.yml`, `watch-pr.yml`, `publish-live.yml` and
`measure-keywords.yml` check the branch out at `state/` before any step that reads it.

### The spend report after the split

The report used to be a file of the pull request, so a gate could regenerate it from the same tree and demand byte
equality. It is now written by the runs, in the state branch, while generation records reach `main` when pull
requests merge. A tree and a state checkout taken at one moment disagree whenever a record is in flight, and a
whole-file comparison would turn that into a red build with no fault in it. `gate:autowriter` instead refuses a
report that is missing, a report with no `Generated-at` instant, and a report whose month figure is lower than the
sum its own ledgers record (`spend-report-understated`). The ceiling job already counts the ledgers directly. No
ordering of runs can leave the figure lower than the sum its own ledgers record, so a lower figure means the file
was edited or left behind. This is a design decision of this change, written before the gate that implements it.

### The records that exist today

Thirty ledgers (17 escalations inside them), thirty claims and the spend report move in one commit that creates
`autowriter-state`. The spend report regenerated from the moved records reads the same November figure as before,
1.395913 USD, 16 entries and 6 warnings. A ledger that an open pull request carries with more spend than `main`
holds is taken in its larger version, as `chooseVersions` always chose it.

## Why this change is parked

`openspec/changes/44-retry-a-stopped-write` is in flight with 23 of 25 tasks ticked, and its task 8.4 reads 14 live
UTC days of the retry it introduced, so it cannot archive before 2026-11-21. A change with ticked boxes cannot be
parked, so this one is. The code it describes ships ahead of its own spec delta, and row G106 of
`docs/plan/reference/known-gaps.md` records that window and what reads wrong inside it. G80 records the hold-up
behind 44 that this change shares with 45 to 48.
