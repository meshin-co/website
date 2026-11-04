# Tasks

## 1. Configuration and schedule

- [x] 1.1 `loop.writeTimesUtc` (shipped `03:17` and `15:17`) and `loop.categoryRotation` (shipped the four
      categories) are in `site/engine.config.json`, its schema and `seed/site/engine.config.json.seed`
      (`03:17` and an empty list)
- [x] 1.2 The load refuses a `writeTimesUtc` that is not a list, is empty, repeats a time or holds a value that is
      not `HH:MM` (`3:17`, `24:00`, `12:60`, `noon`, `317`, `null`, `"03:17 "`), naming the value and its
      position; an empty `categoryRotation` is legal
- [x] 1.3 `scripts/schedule-workflow.mjs` and `scripts/generate-schedule.mjs` (`npm run assets:schedule`) write the
      `schedule:` block of `.github/workflows/write-daily.yml` from the list, one cron entry per time
- [x] 1.4 `scripts/schedule-gate.mjs` (`npm run gate:schedule`, in the `types-and-units` job of
      `.github/workflows/ci.yml`) fails on a cron line edited, added, missing or out of order, a block missing or
      doubled, an edited comment, a missing workflow and an invalid `loop` section; an edited minute prints
      `SCHEDULE cron-differs` and exits 1
- [x] 1.5 `scripts/schedule-specimens.mjs` plants the edited minute, and the mutation row
      `write-schedule-hand-edited` names it; `proveWithSpecimen` on a copy of the tree: red with the specimen,
      green without it
- [x] 1.6 `scripts/write-times-readers.test.mjs` fails when a script other than the schedule modules and the
      configuration check names `writeTimesUtc`, so no logic keys off a slot
- [x] 1.7 Question S30 of the interview bank asks for the times and the categories, and both keys are rows of its
      value table (`npm run gate:engine`: 0 findings)

## 2. Overlap

- [x] 2.1 `write-daily.yml` keeps `concurrency: group: write-daily, cancel-in-progress: false`, and a test pins
      both keys
- [x] 2.2 The `write` job checks out `ref: main`, and a test pins it, so a run that queued behind another starts
      from the tip that holds the first run's claim
- [x] 2.3 `scripts/claim-overlap.test.mjs` runs real git with a bare origin and two clones (7 tests): a second run
      from a stale tree that picks the same topic is refused at the claim commit, nothing is pushed, and origin
      keeps one claim; a run from the current tip refuses that topic and picks the next; a claim filed on 31
      October still blocks the topic on 1 November, and a ledger from September holds its slug

## 3. The ladder

- [x] 3.1 `scripts/topic-repeat.mjs` reduces a title and a query to word stems and refuses `same-subject` at a
      containment of 0.5 against every published article and every article claim that holds; on the real 10
      posts, distinct pairs reach 0.20 at most, 17 hand-made rewordings reach 0.60 to 1.00 and 10 fresh topics
      reach 0.40 at most (`scripts/topic-repeat.site.test.mjs`)
- [x] 3.2 `scripts/topic-categories.mjs` orders `loop.categoryRotation` from the corpus, with no stored counter:
      fewest articles first, claims in flight counted, then the oldest newest article, then the configured
      order; an id that is not a category is refused at load
- [x] 3.3 `weakCandidates` (`scripts/topic-demand.mjs`), `walkWeak` and `examineQuery` (`scripts/topic-walk.mjs`)
      find the measured query with the most impressions that no prompt names and no page answers, and
      `selectTopic` descends from an unproven prompt to that query and otherwise returns the rotation order as
      the fallback; every decision has the same keys
- [x] 3.4 The reasons a query is weak (`no-buyer-prompt`, `impressions-at-floor`,
      `position-beyond-strengthen-band`) are computed from its row and the configuration, and a glossary term
      beside a post with no buyer prompt is written only with a prompt of its own, else it is named with
      `why: 'no-prompt'`
- [x] 3.5 `scripts/topic-proposal.mjs` makes at most two calls of role `topic` for each category in rotation
      order, feeds the refusal of the first back to the second, counts a `vendor` or `output` failure as a
      failed attempt, and puts each query through the register, the claim store and the repeat guard
- [x] 3.6 `scripts/pick-a-topic.mjs` is async: `--write` makes the proposal calls when no earlier rung gave a
      topic, a preview calls no model and prints the rotation order, and a `credential`, `config`, `model` or
      `price` failure exits 1 with the last stdout line `{"ok":false,"kind":...}` that the workflow escalates
- [x] 3.7 `scripts/topic-entries.mjs` writes the origin fields of each claim and the proposal calls of a category
      entry into the ledger and the decision file

## 4. Provenance and spend

- [x] 4.1 A claim carries `origin` (`demand`, `weak-demand` or `category`) with `category` or `weakness`; `prompt`
      is required only for `demand`; a claim with no `origin` reads as `demand`; `originProblems` ties the
      fields to the origin
- [x] 4.2 The claim block of a generation record follows the same rules, `demand.row` and `demand.report.table`
      may be null, and the call roles gain `topic` (`TOPIC_ROLES`)
- [x] 4.3 `writingTotals`, `scripts/spend-sum.mjs` and `scripts/spend-report-model.mjs` count a `topic` call
      (`ENTRY_COST_ROLES`), so the monthly ceiling and the spend report include it; in the test a proposal of
      0.0021 and a draft of 0.0015 give a ledger generation and a record total of 0.0036
- [x] 4.4 `scripts/write-open.mjs` refuses a proposal that is not `{calls: [...]}` before anything is spent;
      `scripts/write-run.mjs` opens the calls of the entry with it, and a failed draft keeps the proposal spend
      in the stopped ledger
- [x] 4.5 `npm run gate:autowriter` reports a claim or a record whose origin contradicts its fields, and every
      committed claim and record still validates (0 findings)
- [x] 4.6 The specimens `autowriterClaimOriginMismatch` and `autowriterGenerationOriginMismatch` and the mutation
      rows `autowriter-claim-origin-contradicts-its-fields` and
      `autowriter-generation-record-origin-contradicts-its-claim` are in the registry; each specimen is red with
      its token and green without it in `scripts/autowriter-specimens.test.mjs`
- [x] 4.7 `npm run measure:origins` (`scripts/measure-origins.mjs`) prints entries, calls, tokens and cost by
      origin, the weak-demand reasons and the category counts, lists the entries written without a buyer prompt
      oldest first and writes nothing (12 tests)
- [x] 4.8 The pick step of `write-daily.yml` has the five writer variables, keeps its last output line in
      `PICK_RESULT_FILE`, and a step `escalate a pick that failed` maps `credential`, `config`, `model` and
      `price` to a credential escalation and every other result to a hard stop
      (`scripts/write-daily-pick.test.mjs`)
- [x] 4.9 `validateClaim` and `validateRecord` refuse a `weak-demand` or a `category` claim whose format is not
      `article`, because only an article takes those rungs; the gate reports it under `claim-schema`

## 5. The writer without a buyer prompt

- [x] 5.1 `promptSourcesFor` (`scripts/writer-prompt.mjs`) leaves the buyer-prompt block out for a claim with no
      prompt, and the user prompt holds an `Origin:` line where the `Buyer prompt` line stood; the length,
      passage and heading rules name the query, and the wording for a demand entry is byte-identical
- [x] 5.2 `scripts/route-assembly.mjs` plans no passage for such an entry, so the buyer prompts section of
      `docs/SEMANTIC-CORE.md` is byte-identical after assembly, and the target-query row, the register row, the
      disposition files and the six gates still come through
- [x] 5.3 The commit message says `Origin: <origin>` with `Category:` or `Weak query:` where it says
      `Serves buyer prompt N` for a demand entry
- [x] 5.4 `scripts/entries-in-build.mjs` and `scripts/live-slack.mjs` leave the buyer prompt out for such an entry
- [x] 5.5 `scripts/repair-open.mjs` refuses an entry with no buyer prompt, because it has no registered passage to
      keep word for word: the outcome is `failed`, escalated as a hard stop, and a person repairs it
- [x] 5.6 A draft for a `category` claim must set the claim's category: the preflight refuses another one as
      `category-mismatch` through the ordinary correction round, and the user prompt names the category to set,
      so the rotation counts stay true

## 6. Documents and skills

- [x] 6.1 `site/scripts/README.md` has a row for each new script and the importers of the modules that gained one
      (`node --test scripts/scripts-index.test.mjs`)
- [x] 6.2 The skills `schedule-the-unattended-writer.md` and `write-on-a-category.md` are new, and the picker,
      article-choice, writer, guard, spend, repair, adaptation, interview and harness skills say what changed
      (`npm run gate:skills`)
- [x] 6.3 Locked row L61 is amended in place with the date 2026-11-04 and L64 names the two configuration keys; no
      row is added, so the row range that documents cite stays true
- [x] 6.4 The interview bank describes S30 and the prompt-less claim and passage, and its `write-daily.yml` and
      `ci.yml` line citations name the lines of the workflows as they stand
- [x] 6.5 The three spec deltas state the built behaviour, and `npm run gate:spec` reports no finding except the
      second active change
- [x] 6.6 `npm test`, `npm run check` and the gates (`gate:spec`, `gate:docs`, `gate:plan`, `gate:skills`,
      `gate:schedule`, `gate:engine`, `gate:autowriter`, `gate:partition`) pass on the formatted tree that is committed

## 7. Calibration Gate

- [x] 7.1 `npm run test:smoke` proves the three new mutation rows (`write-schedule-hand-edited`,
      `autowriter-claim-origin-contradicts-its-fields` and
      `autowriter-generation-record-origin-contradicts-its-claim`) in a standalone clone. Not run here: the proof
      so far is `proveWithSpecimen` on a copy of the tree for the schedule specimen and the specimen tests for
      the two origin rows
- [x] 7.2 (moved to gap row G64, not done) After 14 days of live runs (28 slots) run `npm run measure:origins`, record the counts and the costs by
      origin and the share of category proposals that were refused, and decide whether the 0.5 repeat threshold
      needs tuning. The refused share is the `topic` calls of the category records, less one surviving call per
      entry, over all of them; a run that ended with no entry leaves only its step summary
- [x] 7.3 (moved to gap row G64, not done) Read the first category entry of each configured category against the entries already in the category,
      and mark any that repeat an entry or define a concept twice
- [x] 7.4 (measurement recorded, report artifacts lost) Run the Calibration Gate and commit the report it generates for this change, as change 26 owes

## 8. Found while building, not fixed

- [x] 8.1 (moved to gap row G64, not done) A run whose every proposal is refused or failed has no slug, so no ledger and no record holds its calls:
      the figure is in the step summary of the pick only, outside `audits/spend-report.md` and the monthly
      ceiling. The bound is two calls per category, eight with the shipped list, under three cents at the
      shipped rates of 1 and 5 USD per million tokens
- [x] 8.2 (moved to gap row G64, not done) When such a run holds a `strengthen` decision, the Slack message quotes the choice and not the
      categories that were tried (`pickEnding` in `scripts/spend-ended.mjs`); only a `none` decision carries
      its reason into the message
- [x] 8.3 (moved to gap row G64, not done) The watcher cannot repair an entry written without a buyer prompt (`scripts/repair-open.mjs` refuses it
      as `failed`), so a person repairs every such entry that fails a gate
- [x] 8.4 (moved to gap row G64, not done) Two runs that pick one topic from a stale tree on either side of a month boundary push two claims and
      git sees no conflict, because the claim path holds the month; `scripts/claim-overlap.test.mjs` pins that
      both land. Only `ref: main` and the concurrency queue stop it, and no test runs GitHub's queue (one
      waiting run per group, replaced by a third arrival)
- [x] 8.5 (moved to gap row G64, not done) `scripts/claim-overlap.test.mjs` picks from a two-prompt demand fixture, so the category rung is not
      exercised across a stale tree: two stale category runs ask a model for a query each and would usually file
      different slugs, which git cannot see; the rotation counting claims in flight is what separates them
- [x] 8.6 (moved to gap row G64, not done) The repeat guard passes a paraphrase that shares no topical stem (0.00 against the pilot article), and
      refuses a fresh topic that shares generic words (0.57 against the operating-model article for a question
      on pricing an agent pilot); the concept register and the model's sight of the titles are the other two
      layers
- [x] 8.7 (moved to gap row G64, not done) `gate:schedule` is not in the unwaivable set of `scripts/plan-gate.mjs`, so a `localOnlyGates` entry with
      a reason could take it out of CI
- [x] 8.8 (moved to gap row G64, not done) Test files over the size the hook flagged: `scripts/write-run.test.mjs` grew from 444 to about 561
      lines against a ceiling of 400, `scripts/route-assembly-entries.test.mjs` from 322 to about 385, and
      `scripts/topic-selection-weak.test.mjs` is 319 against a soft cap of 300. A split of the first moves its
      shared harness (`scene`, `drive`, `adapterWith`, `answer`) into a fixture and needs the owner's
      confirmation

## Why this change closes with items moved out

Task 7.1 is done: `npm run test:smoke` proved 161 of 161 families, the three new rows among them.

Task 7.4 is half true and the half that is missing is my doing. The tree was measured green and the
measurement is recorded in `audits/lighthouse-green.json` as fingerprint `e13687035319`, phase
`38-two-a-day`. The per-route reports under `audits/phase-38-two-a-day/` are not there, because a
re-run I started and then cancelled cleared the directory before writing its own. The reports are
gitignored and reproducible, but they were never generated for this change and no report was
committed for it.

Tasks 7.2 and 7.3 cannot be done by working harder: they ask for 28 live slots, which is fourteen
days. Tasks 8.1 to 8.8 are follow-ups written down during review and not started. All ten are
in gap row G64.
