# Schedule the Unattended Writer

`.github/workflows/write-daily.yml` starts the writer at the UTC times in `site/engine.config.json`, key
`loop.writeTimesUtc` (shipped `["03:17", "15:17"]`). A run writes one article unless no rung of the topic ladder gives
it a topic (`write-on-a-category.md`), so two times mean up to two articles a day. Change `30-write-twice-a-day` made
the times configuration: nobody types a cron line.

## Change the times

1. Edit the list. Each time is `HH:MM` in 24 hours, two digits each, UTC; at least one; none twice. Keep the minute off
   `00`, where scheduled runs queue. A non-list, a time that is not `HH:MM` and a repeat are refused at load, naming
   the value and its place, for example `"3:17" is not a time of day` at `$.loop.writeTimesUtc[0]`.
2. `cd site && npm run assets:schedule` (`scripts/generate-schedule.mjs`) rewrites the `schedule:` block under `on:`
   of the workflow: one comment line and one `- cron: 'M H * * *'` per time, ascending. It touches nothing else and
   prints either what it wrote or that nothing changed.
3. `npm run gate:schedule` (`scripts/schedule-gate.mjs`, in the `types-and-units` job of `ci.yml`) regenerates the
   block in memory and fails when the committed file differs. It prints
   `SCHEDULE <rule> .github/workflows/write-daily.yml: <detail>` with `cron-differs`, `cron-extra`, `cron-missing`,
   `cron-order`, `schedule-missing`, `schedule-twice`, `schedule-block-differs` or `workflow-missing`; the detail names
   the line and `npm run assets:schedule`. An invalid `loop` section reads `config-invalid`.

The rules live in `scripts/schedule-workflow.mjs`. Its specimens, `scripts/schedule-specimens.mjs`, move a cron minute,
write a catch-up cron and remove one (rows `write-schedule-hand-edited`, `write-schedule-catch-up-hand-written`,
`write-schedule-catch-up-removed`); `extend-mutation-smoke.md` says how they run.

## Pause the writer, never empty the list

An empty list is refused (`ENGINE config-invalid loop.writeTimesUtc`, a message that says how to pause). A config that
dropped the cron block would stop the writer and tell nobody. To pause it, disable the Write daily workflow in the
Actions tab, or leave one secret or variable of its `configured` job unset (`AUTOWRITER_PAT`,
`AUTOWRITER_OPENAI_API_KEY`, `GSC_SERVICE_ACCOUNT_JSON`, `SLACK_WEBHOOK_URL` and the four writer variables): the run ends
green and its summary names what is missing.

## A slot GitHub never starts is run late

GitHub documents that a scheduled run can be delayed under load and that queued runs may be dropped; on 2026-11-05 the
03:17 slot never fired. `loop.catchUpAfterMinutes` (shipped `[120, 240]`) adds a cron entry for each time and delay,
written by `npm run assets:schedule` and held by `gate:schedule` like the first two. A delay that passes midnight or
shares a minute is refused at load. The `due` job (`scripts/slot-due.mjs`, over `scripts/slot-standing.mjs`) runs first
and ends a scheduled run green, before any model, when the UTC day holds as many article claims (by `claimedAt`) as
slots have passed; a manual run always writes. A slot that has its entry is never run twice. A run that failed before
its claim is retried. A claim whose write stopped is stamped `abandoned` by `scripts/release-claim.mjs`, and
`loop.stoppedRunRetriesPerDay` (shipped `1`) of those a day do not count, so the next catch-up writes a different
topic; the ones beyond it count again and the day stops (2026-11-06: one stop, issue #98, and nothing published).
A run filling a slot at least the first delay late stamps its claims `catchUp: {slot, lateMinutes}`, never `origin`;
`npm run measure:origins` counts them. The pick still reads the corpus and the demand report, never the clock.
`scripts/write-times-readers.test.mjs` fails when a script outside the schedule modules names `writeTimesUtc`.

## Two runs in flight

The workflow holds `concurrency: group: write-daily, cancel-in-progress: false`: a run that arrives while another runs
waits and never cancels it. GitHub keeps one waiting run per group, so a third arrival replaces the waiting one (its
documented rule). The `write` job checks out `ref: main`, so a waiting run starts from the tip of `main` at the moment
it starts. The default checkout pins the commit GitHub recorded for the run, which predates the claim of the run ahead
of it. `scripts/commit-to-main.mjs` pulls only after a push is rejected, and the demand report is stamped by day, so a
second run of a day often has nothing to commit and never pulls: no other step brings a stale tree forward.

## What `scripts/claim-overlap.test.mjs` proves

It uses real git: a bare origin, two clones and `commitAndPush` of `scripts/commit-to-main.mjs`. Seven tests.

- Two runs that pick one demand topic from one stale tree: the second claim commit conflicts on the claim path, the
  rebase is aborted, the error says nothing was pushed or forced, origin keeps one claim (the first run's) and no
  rebase is left half done.
- A run that starts from the current tip refuses that topic (`title-collision`; `slug-held` when only the title was
  reworded) and takes the next prompt, and its claim lands.
- A claim filed on 31 October still blocks the topic on 1 November: the path holds the month, the reader lists every
  month. A ledger from September holds its slug for ever.
- The workflow keys above: the concurrency group, and one checkout in the `write` job with `ref: main`.

## What it does not prove

- A stale tree and a run in the next month file the claim at two different paths, which git cannot see. The test pins
  that both land. Only the checkout of `main` and the queue stop it, and a stale tree that bypasses the queue across a
  month boundary could double-claim.
- It runs no GitHub: the queue is a pin on two YAML keys, so a third run replacing the waiting one is untested.
- It picks from a two-prompt fixture. Only the demand rung is exercised. Two stale category runs each ask a model for a
  query, so they would usually file different slugs and git would see no conflict; the fresh tip, where the rotation
  counts claims in flight, and the queue are what stop them.
- It calls `commitAndPush`, not the workflow steps that read its outcome.
