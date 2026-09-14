# Navigate the Plan Without Reading It All

The plan used to be one 457-line file every session read in full. It is now a tree under
`docs/plan/`, and the point of the tree is that you read a few hundred words instead of the whole
history of the project.

## What to read, in order

1. `docs/plan/INDEX.md`. Always. It is a pointer file: the phase table, the status of each phase,
   and where the reference material lives. It never duplicates a phase's content.
2. The one phase file whose status is `.active` or `.next`. That is the work in flight.
3. Only then, and only if you need it: a reference file, or a past phase you have a specific
   question about.

Reading a `.done` phase to learn how something works is usually the wrong move. The plan records
intent; `site/.agents/skills/` records procedure and `dist/` records reality.

## Status lives in the filename

`phase-5-launch.next.md` is the phase 5 file and its status is `next`. The five words are `done`,
`active`, `next`, `planned`, `dropped`. Nothing else is accepted.

Filenames carry status because a status column in a table is something a tired agent forgets to
update, while renaming the file is the same action as finishing the work. `ls docs/plan/phases`
is then an honest board.

Changing a phase's state is two edits in one commit: rename the file, update its row in
`INDEX.md`.

## What the gate proves

`npm run gate:plan` (`site/scripts/plan-gate.mjs`) fails when:

- a filename carries a status word outside the five,
- two phases claim `active`, or two claim `next` — only one thing is in flight at a time,
- a phase file exists that `INDEX.md` never lists,
- `INDEX.md` lists a phase file that does not exist.

It runs in the `cheap-gates` CI job, so a half-renamed phase cannot merge.

## Adding a phase

Write `docs/plan/phases/phase-N-<slug>.planned.md` with a `# Phase N · Name` heading, a one-line
`Goal:` (the index reads that line), the numbered work, and the phase's own gate additions. Add
the row to `INDEX.md`. Run `npm run gate:plan`.

## Where the old sections went

| Was                                   | Is                                           |
| ------------------------------------- | -------------------------------------------- |
| `PLAN.md` §1 locked decisions         | `docs/plan/reference/locked-decisions.md`           |
| `PLAN.md` §2 what a phase must not do | `docs/plan/reference/must-not-do.md`         |
| `PLAN.md` §3 the Calibration Gate     | `docs/plan/reference/calibration-gate.md`    |
| `PLAN.md` §4 the phases               | one file per phase under `docs/plan/phases/` |
| `PLAN.md` §5 test strategy            | `docs/plan/reference/test-strategy.md`       |
| `PLAN.md` §6 risk register            | `docs/plan/reference/risk-register.md`       |
