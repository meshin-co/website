# Set the Cron Lead

GitHub starts this repository's scheduled runs hours late. The repository is public and on the free plan, the lag is
GitHub's queue, and no setting here removes it: nothing in this skill fixes GitHub. The engine keeps `loop.writeTimesUtc`
as the time an article is wanted and sets each cron `loop.cronLeadMinutes` (shipped `440`) earlier, so a run delayed by
about that long lands near the wanted time. The arrival becomes predictable, not instant.

## What was measured

From `gh run list --workflow write-daily.yml` and the writer's own slot line, for the 03:17 slot:

| Date       | Cron UTC | Run started UTC | Late by |
| ---------- | -------- | --------------- | ------- |
| 2026-11-03 | 03:17    | 10:55:18        | 458 min |
| 2026-11-04 | 03:17    | 10:58:08        | 461 min |
| 2026-11-05 | 03:17    | 10:58:26        | 461 min |
| 2026-11-07 | 03:17    | 10:14:23        | 417 min |

On 2026-11-03 and 2026-11-04 the workflow carried exactly one cron entry, `17 3 * * *`, and produced exactly one run, so
those rows are certain. On 2026-11-05 it carried that entry and `17 15 * * *` until the catch-up entries were merged that
evening, so the run at 10:58 is the 03:17 entry's. The last row is the lateness the slot line printed,
`the 03:17 slot is 417 minutes late`. All four are for the 03:17 cron. The shifted crons fire at other times of day, where
the delay has not been measured, so the band below is a model of the lag and the first runs after a change are its test.

## What the lead changes

`cronPlan` in `scripts/schedule-workflow.mjs` subtracts the lead from the time of every cron entry, the catch-up entries
included, wrapping across midnight. It leaves each entry's `time`, `slot` and `delay` as they were, because the gate's
findings quote them and `scripts/slot-due.mjs` measures lateness against them, never against the cron;
`scripts/write-times-readers.test.mjs` fails when a script outside the schedule modules reads the lead. With the shipped
06:00 and 440, the first entry is 06:00 minus 7 hours 20 minutes, which is 22:40 on the evening before: `40 22 * * *`.
15:00 gives `40 7 * * *`. Every generated cron falls on minute 40, away from the top of the hour, where scheduled runs
queue worst. A lead of 0 sets each cron at its wanted time, which is right for any runner that starts on time.

## The arrival band

417 minus 440 to 461 minus 440: 23 minutes early to 21 minutes late. It reads the four measurements as one band and
assumes the delay stays the same when the cron moves.

A run that starts before its slot owes nothing. The `due` job (`scripts/slot-due.mjs`) ends it green before any model is
called, with a line such as
`slot: 0 articles claimed today for 0 slots passed, so nothing is owed; the run stops before any model is called`. The
first catch-up entry then writes the slot, 97 minutes after it when every run starts 417 minutes after its cron
(`scripts/schedule-workflow.test.mjs`).

A run that starts exactly at its cron minute, with no delay at all, lands on the evening before the slot's own UTC day for
the first slot (22:40 for 06:00) and must not write an extra article. The day's slot quota (`scripts/slot-standing.mjs`)
decides it: that evening belongs to the previous day, whose claims are matched against its slots, so a day holding both
entries owes nothing and a day missing one owes that one and no other. `scripts/slot-standing.test.mjs` fixes both cases.

## Change the lead

1. Measure the delay: a scheduled run's start in `gh run list --workflow write-daily.yml` minus the time of the cron
   entry that fired it.
2. Choose a lead from the shortest delay (no run starts before its slot) up to the middle of them (the arrival centres on
   the slot, and a run that comes early waits for its retry). The key is an integer from 0 to 1439; a new site starts at 0.
3. `cd site && npm run assets:schedule`, then `npm run gate:schedule`.
