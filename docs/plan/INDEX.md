# Plan index

Read this file first, and only this file, unless you need a specific phase or reference. Nothing
in here duplicates a phase file; it points at them.

## Phases

| Phase | Name                                              | Status    | File                                                                                                                                          | Goal                                                                                                                                      |
| ----- | ------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Initialization                                    | `done`    | [phase-0-initialization.done.md](phases/phase-0-initialization.done.md)                                                                       | a scaffolded, committed repo whose template builds untouched, with a recorded baseline                                                    |
| 1     | Skeleton and infrastructure                       | `done`    | [phase-1-skeleton-and-infrastructure.done.md](phases/phase-1-skeleton-and-infrastructure.done.md)                                             | an empty site at 100×4 with strict CSP, real budgets, and CI that blocks regressions                                                      |
| 2     | Design system and home page                       | `done`    | [phase-2-design-system-and-home-page.done.md](phases/phase-2-design-system-and-home-page.done.md)                                             | the visual language is fixed in tokens and components; `/` is final                                                                       |
| 3     | Content model, templates, machine interfaces      | `done`    | [phase-3-content-model-templates-machine-interfaces.done.md](phases/phase-3-content-model-templates-machine-interfaces.done.md)               | every page type renders and every machine interface is correct; site is functionally complete                                             |
| 4     | Core content                                      | `done`    | [phase-4-core-content.done.md](phases/phase-4-core-content.done.md)                                                                           | the site is worth indexing                                                                                                                |
| 4.5a  | Machine layer: every surface complete             | `done`    | [phase-4.5a-machine-layer-every-surface-complete.done.md](phases/phase-4.5a-machine-layer-every-surface-complete.done.md)                     | every machine reader — crawler, answer engine, feed subscriber — gets the whole site, whole                                               |
| 4.5b  | Human layer: navigation, standards, semantic core | `done`    | [phase-4.5b-human-layer-navigation-standards-semantic-core.done.md](phases/phase-4.5b-human-layer-navigation-standards-semantic-core.done.md) | a reader — human or crawler following links — can reach everything from everything                                                        |
| 4.6   | Answer-engine hardening                           | `done`    | [phase-4.6-answer-engine-hardening.done.md](phases/phase-4.6-answer-engine-hardening.done.md)                                                 | every route earns its snippet and its citation. Seven read-only audits (head and markup,                                                  |
| 4.7   | Editorial pass over every text                    | `done`    | [phase-4.7-editorial-pass-every-text.done.md](phases/phase-4.7-editorial-pass-every-text.done.md)                                             | every user-facing string reads as one experienced person wrote it, serves a real reader, and sits where the semantic core says it belongs |
| 5     | Launch                                            | `next`    | [phase-5-launch.next.md](phases/phase-5-launch.next.md)                                                                                       | public, indexed, measured                                                                                                                 |
| 6     | Growth (repeating, every two weeks)               | `planned` | [phase-6-growth-repeating-every-two-weeks.planned.md](phases/phase-6-growth-repeating-every-two-weeks.planned.md)                             |                                                                                                                                           |

Status lives in the filename, not in a table someone forgets to update: `.done.md`, `.active.md`,
`.next.md`, `.planned.md`, `.dropped.md`. Exactly one phase may be `.active` at a time, and at
most one may be `.next`. `scripts/plan-gate.mjs` enforces both, plus that every file the index
lists exists and every file on disk is listed here.

Renaming a file is how a phase changes state. Do it in the same commit that finishes the work,
and update the row above.

## Reference

| File                                                                               | What it holds                                                                                                |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [reference/locked-decisions.md](reference/locked-decisions.md)                     | The locked rows L1-L54 that override or extend the PRD. Read before proposing anything that contradicts one. |
| [reference/calibration-gate.md](reference/calibration-gate.md)                     | The eleven-step gate every phase ends with, and the two rules that make a fake-green hard.                   |
| [reference/must-not-do.md](reference/must-not-do.md)                               | What each phase is forbidden from doing.                                                                     |
| [reference/test-strategy.md](reference/test-strategy.md)                           | What is unit-tested, what is snapshotted, what is gated.                                                     |
| [reference/risk-register.md](reference/risk-register.md)                           | Known risks and their mitigations.                                                                           |
| [reference/bigpowers-mapping.md](reference/bigpowers-mapping.md)                   | Which bigpowers skills were adopted, which map onto what already exists, and which are skipped and why.      |
| [reference/history-rewrite-2026-09-15.md](reference/history-rewrite-2026-09-15.md) | Old commit hash to new, after the 761 MB to 113 MB rewrite.                                                  |
| [briefs/refine-all-texts.md](../briefs/refine-all-texts.md)                        | The owner brief Phase 4.7 executes, stored verbatim.                                                         |

## How to navigate this without reading everything

- Starting work: read this index, then the one `.active` or `.next` phase file.
- Proposing a change that contradicts something: `reference/locked-decisions.md`, and quote the row.
- Finishing a phase: `reference/calibration-gate.md`, then rename the phase file to `.done.md`.
- Looking for how something is actually done: `site/.agents/skills/`, one file per job. The plan
  says what and why; the skills say how.
- Wondering whether a past phase did something: read that phase's file, then verify the claim in
  the built output. A phase file records intent, `dist/` records reality.
