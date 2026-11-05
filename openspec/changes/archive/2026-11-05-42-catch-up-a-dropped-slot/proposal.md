# Catch up a dropped slot

## Why

On 2026-11-05 the owner woke to no article. The schedule on `main` was right (`17 3 * * *` and `17 15 * * *`,
generated from `loop.writeTimesUtc`), the workflow was active, and a manual `workflow_dispatch` at 05:54 UTC ran green and
opened PR #92. GitHub had simply never fired the 03:17 slot. `gh run list --workflow write-daily.yml` on that day shows
the whole scheduled history of the workflow: two runs started by the schedule event, 2026-11-03T10:55:18Z (success)
and 2026-11-04T10:58:08Z (failure), neither at a time `loop.writeTimesUtc` names today. Everything else was started by hand. GitHub documents that a scheduled run can be delayed
under load and can be dropped, so the loop must not depend on GitHub being punctual.

The skill `schedule-the-unattended-writer.md` said so in one sentence, "Nothing detects a slot GitHub never starts", and
nothing did.

## What changes

**A slot is tried again, by cron, and the extra attempts end at once when the day is already served.**

- `site/engine.config.json` gains `loop.catchUpAfterMinutes`, shipped `[120, 240]`. `npm run assets:schedule` writes one
  cron entry for each write time and for each write time plus each delay: six entries a day, `17 3`, `17 5`, `17 7`,
  `17 15`, `17 17` and `17 19`. `npm run gate:schedule` regenerates the block in memory and refuses any other, so a
  hand-written catch-up cron is `cron-extra` and a deleted one is `cron-missing`. A delay that carries a slot past
  midnight, or lands on a write time or on another delay's minute, is refused at load. An empty list turns the retries
  off.
- A new `due` job at the head of `write-daily.yml` runs `site/scripts/slot-due.mjs` on the tip of `main`. For a scheduled
  run it counts the article claims whose `claimedAt` is on the run's UTC day and compares the count with the write times
  that have passed. Fewer claims than slots: the slot is owed and the run goes on. Otherwise the run ends green, before
  the spend ceiling check, the demand refresh and any model, with the sentence that says why in its summary. A manual
  run is always due. `ceiling` and `write` both wait for `due` and run only when it says `true`.
- Nothing is stored. The count is a function of the claims on `main`, in the way the category rotation is a function of
  the entries and claims on `main` (`site/scripts/topic-categories.mjs`): no flag, no counter, nothing that can drift
  when a run fails.
- A run that fills a slot at least `min(catchUpAfterMinutes)` late stamps its claims with
  `catchUp: {slot, lateMinutes}`. The picker computes it from the same claims at the instant it claims, so the field
  needs no hand-over from the `due` job. The generation record copies the claim, so
  `catchUp` reaches it; `origin` still says where the topic came from and is untouched. `npm run measure:origins` prints
  an arrival section: entries on time, entries caught up, and each catch-up with its slot, its minutes late and its date.

### Mechanisms weighed

| mechanism                                                                                                      | new files                                                     | new credential                                                             | what runs when nothing is owed         | verdict |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------- | ------- |
| A. Extra cron entries that end at once when the day is served (chosen)                                         | one script, one module                                        | none                                                                       | `configured` and `due`, two short jobs | chosen  |
| B. A separate reconciliation workflow on its own cron that dispatches `write-daily.yml` when a slot is missing | one workflow, one more `schedule:` block to generate and gate | a token that may dispatch workflows, so the bot PAT read in a second place | one short job per tick, every tick     | lost    |
| C. A pinger outside GitHub                                                                                     | none in the repository                                        | an account and a secret on a third party                                   | the pinger's own                       | lost    |

B lost because it depends on the same scheduler it is meant to back up, in a second file, and adds a second schedule to
generate, gate and keep honest, plus the dispatch permission. A depends on that scheduler too: an attempt can itself be
dropped. What A buys is that the attempts are spread two and four hours after the slot, away from the queue at the
top of the hour, and that it adds no file the harness must learn. C breaks the rule that every service the site
depends on carries a permanent free tier (L58). A weighed against B on the one thing the owner asked to be cheap.

### What a failed run does

A claim is filed before the model is called, so a run that fails after its claim leaves the claim and counts as the
slot's entry: money was spent, an escalation was raised, and a blind retry would spend again. A run that fails before it
claims anything (the demand refresh, the pick) leaves nothing and is retried at the next attempt. The cost bound is
therefore the same as before: at most one paid write for each slot.

## Behaviour changes

1. A scheduled run can now end green with no entry. Its step summary says `slot: 1 article claimed today for 1 slot
passed, so nothing is owed; the run stops before any model is called`.
2. A manual run always writes, and counts toward the day: dispatching twice in a day before 15:17 leaves nothing for
   the 15:17 slot, because the day already holds two.
3. A hand-written article never counts: only claims do.
4. The day is UTC. A slot never carries over midnight: a slot dropped and not caught up is lost, and the next day starts
   from its own first slot.
5. The test `site/scripts/write-times-readers.test.mjs` still allows only the schedule modules to name the key.
   `site/scripts/slot-due.mjs` and `site/scripts/pick-a-topic.mjs` take the times from the constants of
   `schedule-workflow.mjs`.

## Cost

Each attempt that finds nothing owed runs two jobs and calls no model: `configured` and `due`. Four such attempts at most a
day, on the shipped lists. GitHub bills a job in whole minutes [INFERENCE: stated from memory of the billing rules, not read
in this session], so about two minutes an attempt and eight a day, 240 a month, against a free allowance that depends on
the plan of the repository. No model call, no spend against the monthly ceiling.

## Limits of what was done

- The catch-up cron entries are as droppable as the first two. Two attempts after each slot make a miss of all three less
  likely only to the degree that GitHub's drops are independent in time, which was not measured. The Calibration Gate
  below is how it gets measured.
- The label cannot tell a run that GitHub started 119 minutes late from one on time, nor one that GitHub started 121 minutes
  late from a catch-up. It says the slot an entry filled was at least the first delay late.
- `catchUp` is stamped on the claims of the run, the glossary terms included, but the arrival count of
  `npm run measure:origins` reads generation records, which hold the claim of each entry that shipped.
- The day count is by claim, so a run whose write failed holds its slot for the day. If an entry never ships for a
  reason a person must fix, the day is one short until the next UTC day.
- When the first slot is missed and the second slot's own cron fires first, that run fills the first slot (the slot it
  fills is the one the count says is next) and the second slot is then tried by its catch-ups. Both entries read as
  catch-ups. That is the shape of a day of two dropped slots, and it is counted that way.
- `gate:schedule` proves the cron block, and the unit tests pin the workflow's `needs` and `if` keys, but no gate runs
  GitHub, so that a satisfied slot ends before the model is a property of those keys and of `slot-due.mjs`, not of a
  run that was watched.

## Not in scope

The search index, the llms files, the press, the link job, and the writer itself. No stored flag, no reconciliation
workflow, no change to what a run does once it is due.

## Calibration Gate

The built-byte surface changes (`site/scripts`), so the tasks carry a Calibration Gate group. The procedure is
`docs/plan/reference/calibration-gate.md`, which has no waiver path, and the owner runs the measurement below.

### Constants and what they were chosen from

| constant                                        | value        | chosen from                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loop.catchUpAfterMinutes`                      | `[120, 240]` | One observation, not a measurement. GitHub documents delays under load in minutes and drops without a figure, and the one dropped slot seen, 2026-11-05T03:17, was not started in the 2 hours 37 minutes before the manual run at 05:54. 120 is long enough that an on-time run that is only delayed by an hour still arrives first and the attempt ends with nothing owed; 240 is a second try before the 15:17 slot, and 15:17 plus 240 is 19:17, inside the same UTC day. The measurement below exists to replace this reasoning with a figure. |
| The label threshold, `min(catchUpAfterMinutes)` | 120          | The first delay, so a run counts as a catch-up exactly when it is as late as the first attempt meant to be.                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### Pre-registered acceptance bar

Fixed before the measurement, to be read after 14 live UTC days, 28 slots, with the writer configured and funded and the
monthly ceiling not reached:

1. No UTC day holds three article claims. Two is the most. One or none is a failure of the loop only when a slot's
   attempts all fired, which the second measure shows.
2. Every day on which at least one of a slot's three cron times produced a run holds the claim for that slot.
3. The share of slots that needed a catch-up is reported with its denominator, 28, and is not rounded into a verdict.
   If it is zero, the mechanism is untested, not proven.

### The measurements the owner runs

From the repository root, after 14 days:

```sh
gh run list --workflow write-daily.yml --event schedule --limit 200 --json createdAt,conclusion \
  --jq '.[] | [.createdAt[0:10], .createdAt[11:16], .conclusion] | @tsv' | sort
```

Count, for each day, how many of `03:17 05:17 07:17 15:17 17:17 19:17` have a run, within the hour GitHub is allowed
to be late. A cron time with no run is a dropped attempt, a figure no repository file holds.

```sh
grep -l '"format": "article"' audits/autowriter/claims/2026/*/*.json \
  | xargs grep -h '"claimedAt"' | cut -d'"' -f4 | cut -c1-10 | sort | uniq -c
```

Every day in the window must read 2, never 3.

```sh
cd site && npm run measure:origins
```

The `arrival` section gives entries on time against caught up, and the list under it gives each catch-up with the slot
it filled and its minutes late. Compare the minutes late with `[120, 240]`: a catch-up that arrives at 121 to 130 minutes
was an on-time run delayed past the label, and says 120 is too short.

### Pending, owed by the owner before this change is archived

None of these has been run on this tree. Each is an unticked task.

- `npm run test:smoke`, including the two new rows `write-schedule-catch-up-hand-written` and
  `write-schedule-catch-up-removed`. It needs a full build and three browsers.
- Lighthouse and the visual suite are not owed: no route changes. The Calibration Gate step list still applies, so the
  owner records that.
- The first live scheduled day on the new cron, read with the three commands above.
- The Calibration Gate report for this change, committed as `audits/phase-42-catchup/REPORT.md` once the owner has run
  the gate (the file does not exist before then).
