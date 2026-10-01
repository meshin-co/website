# Investigation records

This directory holds dated records. A record is an account of one piece of work on one day: what was
examined, what was found, what was decided. It is evidence, not instruction. It never tells an agent
how to work in this repository; `AGENTS.md` and the skills under `site/.agents/skills/` do that.

There is one record so far.

| #   | Date       | File                                                                                         | What it answers                                                                                                             |
| --- | ---------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 01  | 2026-10-01 | [`investigation/01-absorption-from-smarter-day-v2.md`](01-absorption-from-smarter-day-v2.md) | What this site took from the smarter.day v2 fork, what it refused and why, and the nine defects the fork found in this site |

If you read only one: **01**. It is the only record, so it is also the whole directory.

## What the marker means

A record describes what was true on its date. It may name another repository, a path that has since
moved, a command that has since been removed, or a locked-row range that has since grown. Resolving
those against today's tree would make the record wrong about its own day. So a record opens with
these three lines, as the first bytes of the file:

    ---
    record: true
    ---

`npm run gate:docs` does not resolve the paths, commands or locked-row ranges in a record. The rule
is `mayBeRecord` and `isRecord` in `site/scripts/docs-gate.mjs`. It honours the marker only on a
file in this directory, and never on this index; a marker anywhere else is ignored and the file is
checked as usual. The gate also counts the records it skipped on its summary line.

Everything else is checked, and that includes this index. It tells a reader where to look, so every
path it names has to resolve.

## Where a second record goes

1. Write `NN-short-name.md` here, with `NN` the next number.
2. Open it with the marker, put the date in the title and in the first line, and say what was
   examined and at which commit.
3. Add one row to the table above, naming the question the record answers.

A document that tells the reader what to do is not a record. Put it in `docs/` or in a skill, where
`gate:docs` checks it.
