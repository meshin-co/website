# Investigation records

This directory holds dated records. A record is an account of one piece of work on one day: what was
examined, what was found, what was decided. It is evidence, not instruction. It never tells an agent
how to work in this repository; `AGENTS.md` and the skills under `site/.agents/skills/` do that.

There are six records.

| #   | Date       | File                                                                                               | What it answers                                                                                                                                                                                 |
| --- | ---------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | 2026-10-01 | [`investigation/01-absorption-from-donor-harness.md`](01-absorption-from-donor-harness.md)         | What this site took from a donor repository's v2 harness, what it refused and why, and the nine defects its review found in this site                                                           |
| 02  | 2026-10-02 | [`investigation/02-mcp-security-research.md`](02-mcp-security-research.md)                         | What the Model Context Protocol specification does and does not enforce, what the published attacks and incidents are, and where this site's own MCP claim may outrun the specification         |
| 03  | 2026-10-02 | [`investigation/03-ai-operating-model-research.md`](03-ai-operating-model-research.md)             | What an "AI operating model" means in 2026 sources, which structures are required by law and which are only popular, and what the EU AI Act timeline became after the July 2026 Digital Omnibus |
| 04  | 2026-10-02 | [`investigation/04-multi-agent-architecture-research.md`](04-multi-agent-architecture-research.md) | What published guidance, studies and standards say a production multi-agent system needs, what `/approach` actually shows today, and which widely repeated claims no source supports            |
| 05  | 2026-10-02 | [`investigation/05-handover-playbook-research.md`](05-handover-playbook-research.md)               | What a defensible handover of an AI system involves, what the sources support about sequence and sign-off, and what only the owner can supply about this practice's own exit                    |
| 06  | 2026-10-02 | [`investigation/06-adoption-telemetry-research.md`](06-adoption-telemetry-research.md)             | What can honestly be measured about AI adoption, and the measured evidence that self-reported adoption and perceived speed-up both run against the trial data                                   |

If you read only one: **02**. It is the shortest, and it is the one that found a claim on the live
site that its own cited specification may not support.

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
