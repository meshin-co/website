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
`slot: 0 articles claimed today for 0 slots passed, so nothing is owed; the run stops before any model is called`. That
is why the first delay of `loop.catchUpAfterMinutes` is 30 and not two hours: at the shortest measured delay the slot's
own entry arrives 23 minutes early and writes nothing, and the 30-minute entry then writes it 7 minutes late instead of 97. Across every measured delay the 06:00 slot is written inside the half hour after it
(`scripts/schedule-workflow.test.mjs`). Keep a short first delay whenever the lead can overshoot.

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
4. The times are UTC, and no part of the engine knows a civil time zone. A reader whose country changes its offset
   reads the articles an hour earlier or later from that date on; Israel moves to UTC+3 in late March, so 06:00 UTC
   stops being 08:00 there and becomes 09:00. Move `loop.writeTimesUtc`, not the lead: the lead measures GitHub's
   queue, which no civil clock touches.
