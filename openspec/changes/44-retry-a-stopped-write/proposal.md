# Retry a stopped write

## Why

The unattended writer stopped on one scheduled run and then wrote nothing for the rest of the day.

The scheduled run https://github.com/meshin-co/website/actions/runs/42206394607 ran `npm run write:entry`, which gave up
after one correction round with three findings still open: `paragraph-words`, `sentence-not-in-entry` and `fact-unbound`.
The run opened escalation issue #98 and left its topic claim,
`audits/autowriter/claims/2026/11/agentic-automation-consultant-for-b2b.json`, committed with `status: "claimed"`. No
entry existed for the claim.

The catch-up run at 13:00 UTC that day then printed this line and ended before any model was called:

```
1 article claimed today for 1 slot passed, so nothing is owed
```

No article was written that day. The slot the stopped run held was never tried again.

There are two causes, and each alone would have been survivable.

1. **The correction budget was a constant, and it was 1.** `CORRECTION_ROUNDS` in `site/scripts/write-draft.mjs` was
   hardcoded to 1, so a draft that broke three rules after its first draft had exactly one chance to be repaired.
   Nothing in `site/engine.config.json` could raise it, though every other bound of the loop lives there.
2. **A stopped run's claim counted as the slot's entry.** `site/scripts/slot-standing.mjs` counts every article claim of
   the UTC day as an entry, whatever its status. The change that added the catch-up crons (42) recorded this on purpose:
   money was spent and a blind retry would spend again, so a claim whose write failed still filled its slot. That rule is
   right for a retry that repeats the same failure and wrong for the first stop of the day: the slot stays empty, and the
   crons that exist to fill it have been told it is full.

## What changes

**A write gets a configured number of corrections, and a run that stops anyway releases its slot, a bounded number of times a day.**

- `site/engine.config.json` gains `loop.correctionRounds`, shipped `2`, and `loop.stoppedRunRetriesPerDay`, shipped `1`.
  Both are required and documented in `site/scripts/engine-config.schema.json`. `correctionRounds` is an integer from 1 to
  3, so a budget of 2 costs at most three model calls for one entry (the first draft and two corrections).
  `stoppedRunRetriesPerDay` is an integer from 0 to 5; 0 keeps the old behaviour, where one stopped run ends the day.
- `site/scripts/write-draft.mjs` takes `CORRECTION_ROUNDS` from the configuration instead of a constant of 1, and exports
  `countedCorrections`, so the output error of the writer and of the repair rewrite names the number of corrections the
  run actually made.
- `site/scripts/autowriter-claim.schema.json` gains a third claim status, `abandoned`: the run that held the claim stopped
  without an entry. An abandoned claim still holds its slug and its title until `expiresAt`, because
  `isHolding` in `site/scripts/autowriter-claims.mjs` keeps every unexpired claim that is not written, so the next run
  cannot pick the same topic again. It no longer tells the slot check that the day produced an article.
- `site/scripts/release-claim.mjs` reads the run's decision file and flips every claim it names from `claimed` to
  `abandoned`. A claim that is already `written` or `abandoned` is left alone. It prints one `path=<claim path>` line for
  each claim it changed, for the commit step.
- `site/scripts/slot-standing.mjs` forgives up to `loop.stoppedRunRetriesPerDay` abandoned article claims of a UTC day
  and reports `forgiven` next to `entries`. The slot stays owed, so the next catch-up cron writes. A claim beyond the
  bound counts as an entry again, so the day stops. `site/scripts/slot-due.mjs` says how many stopped runs it forgave in
  its step summary.
- `.github/workflows/write-daily.yml` runs `release-claim.mjs` on the failed-write path and commits the released claims
  next to the ledger.

### The bound

| bound                          | where it is set                      | what it limits                                                        |
| ------------------------------ | ------------------------------------ | --------------------------------------------------------------------- |
| `loop.correctionRounds`        | `site/engine.config.json`, 2 shipped | corrections one entry gets before its run stops                       |
| `loop.stoppedRunRetriesPerDay` | `site/engine.config.json`, 1 shipped | stopped runs a UTC day forgives, so the slot of each is written again |

On the shipped configuration a UTC day holds at most as many article claims as it has write times plus the forgiven
ones: two write times and one forgiven run make three. That is derived from `slotStanding`, not measured: an entry that is
written is never forgiven, and the second stopped run of a day is not forgiven, so a model that keeps failing stops the
day after its second stop and cannot spend all day.

### Mechanisms weighed

| mechanism                                                                            | the day after one stopped run       | a model that keeps failing         | the spend that was made           | verdict |
| ------------------------------------------------------------------------------------ | ----------------------------------- | ---------------------------------- | --------------------------------- | ------- |
| 1. Leave the rule: any claim fills its slot                                          | no article, the case of this change | stops at once                      | recorded in the claim             | lost    |
| 2. Delete the claim of a stopped run                                                 | the slot is owed                    | unbounded, one write for each cron | the claim that records it is gone | lost    |
| 3. Mark the claim `abandoned` and forgive a configured number of them a day (chosen) | the slot is owed once               | stops at the second stop           | kept in the claim                 | chosen  |

1 lost because it is the defect. 2 lost because a deleted claim frees its slug and its title at once, so the run that
follows may choose the topic that just failed, and because nothing would count the stops, so a failing model would write
once for every cron time the workflow has. 3 keeps the record of what was spent and holds the failed topic until it
expires, and the count that stops the day is a function of the claims on `main`, in the way the day's slot count already is:
no flag, no counter.

## Behaviour changes

1. A draft that fails its checks is corrected up to two times, not once, before the run stops. A run that stops reads
   `after 2 corrections`, not `after 1 correction`.
2. A scheduled run that finds an abandoned claim on its day writes, and its step summary says how many stopped runs were
   forgiven.
3. A day that holds a second abandoned article claim is not retried: the claims beyond the bound count as entries.
4. A claim file may now read `"status": "abandoned"`, and a reader of claim files must expect it.
5. The scenario of change 42, "A write fails after its claim", no longer says the claim counts as the slot's entry. It
   says the slot is owed again until the day's forgiven runs are spent.

## Cost

A correction round costs about one draft's tokens, which is why the schema caps the budget at 3. Raising the budget from
1 to 2 adds one model call to every run whose draft fails twice, and nothing to a run whose first draft passes. A forgiven
stop adds one more paid write to the day, at most `loop.stoppedRunRetriesPerDay` of them. No dollar figure is stated: it
was not measured, and `npm run gate:autowriter` and the monthly ceiling of `loop.monthlySpendCeilingUsd` still judge the
spend that was made.

## Limits of what was done

- The correction budget of 2 is a bound, not a measurement. Whether a second correction repairs a draft that one did
  not was not measured on live runs, so the first stop that carries `after 2 corrections` is the evidence that matters.
- No GitHub Actions run has executed the new `release-claim.mjs` step. The tests pin the keys and the script's own output;
  the workflow itself was not run.
- The forgiveness is by count, not by cause. A stopped run that failed for a reason a person must fix, such as a revoked
  key, is forgiven once like any other, so the day spends one more attempt on it.
- The rule reads a day in UTC and gives no carry-over: a slot a stopped run held on one day is not owed on the next.
- A claim whose run is killed (a cancelled job, a runner lost) never reaches the failed-write path, so it is not released
  and still fills its slot. That case was not changed.

## Not in scope

The repair loop's own attempt cap (`loop.attemptCap`), the quarantine, the escalation issue of a stopped run, the topic
ladder and the search of topics. No change to what an entry must pass, only to how many times a draft may be corrected.

## Calibration Gate

The built-byte surface changes (`site/scripts`), so the tasks carry a Calibration Gate group. The procedure is
`docs/plan/reference/calibration-gate.md`, which has no waiver path, and the owner runs the measurement below.

### Constants and what they were chosen from

| constant                       | value | chosen from                                                                                                                                                                                                                |
| ------------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loop.correctionRounds`        | 2     | One observation, not a measurement: run 42206394607 stopped with three findings open after one correction. The schema caps it at 3 because each round costs about one draft.                                               |
| `loop.stoppedRunRetriesPerDay` | 1     | A bound, not a measurement. One retry gives the slot of a stopped run a second try on a different topic, and a second stop in the same day ends the day, so the paid writes of a day are at most the write times plus one. |

### Pre-registered acceptance bar

Fixed before the measurement, to be read after 14 live UTC days with the writer configured and funded and the monthly
ceiling not reached:

1. No UTC day holds more article claims than the write times plus `loop.stoppedRunRetriesPerDay`, which is 3 on the
   shipped configuration.
2. Every claim whose run stopped without an entry reads `abandoned`, and none reads `claimed` on a day later than its own.
3. The stops are reported with their denominator, the number of article claims of the window, and the share of stops that
   the second correction repaired is reported and not rounded into a verdict. If the window holds no stop, the mechanism
   is untested, not proven.

### The measurements the owner runs

From the repository root, after 14 days:

```sh
grep -l '"format": "article"' audits/autowriter/claims/2026/*/*.json \
  | xargs grep -h '"claimedAt"' | cut -d'"' -f4 | cut -c1-10 | sort | uniq -c
```

No day may read more than 3.

```sh
grep -l '"status": "claimed"' audits/autowriter/claims/2026/*/*.json
```

Every file listed must belong to a run that is still in flight or is dated the day of the reading.

```sh
grep -l '"status": "abandoned"' audits/autowriter/claims/2026/*/*.json | wc -l
```

The count of stops, against the article claims of the window counted by the first command.

### Pending, owed by the owner before this change is archived

None of these has been run on this tree. Each is an unticked task.

- `npm test`, `npm run check` and `npm run test:smoke`, which needs a full build and three browsers.
- Lighthouse and the visual suite are not owed: no route changes. The Calibration Gate step list still applies, so the
  owner records that.
- The first live day with a stopped run, read with the commands above.
- The Calibration Gate report for this change, committed as `audits/phase-44-retry-a-stopped-write/REPORT.md` once the
  owner has run the gate (the file does not exist before then).
