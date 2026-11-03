# Navigate the Plan Without Reading It All

The plan was one 457-line file every session read in full, then a tree of phase files. It is now
two places: `openspec/`, which holds what the site does, mapped by `openspec/INDEX.md`, and the
work changing it, under `openspec/changes/`; and the reference files below, all but one under
`docs/plan/reference/`. This file maps both, so you read a few hundred words instead of the
history of the project.

What to open first is the read order in `AGENTS.md`. How to open, work and close a change is
`work-a-change-in-the-spec-tree.md`.

Reading a closed change to learn how something works is usually the wrong move. A change records
intent; `site/.agents/skills/` records procedure and `dist/` records reality.

## The reference files

| File                                                | What it holds                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `docs/plan/reference/locked-decisions.md`           | The locked rows that override or extend the PRD. Read before proposing anything that contradicts one, and quote the row. |
| `docs/plan/reference/calibration-gate.md`           | The eleven-step gate, and the two rules that make a fake-green hard.                                                     |
| `docs/plan/reference/known-gaps.md`                 | Real problems found but deliberately not closed in the pass that found them, with the reason why and an owner.           |
| `docs/plan/reference/must-not-do.md`                | What was rejected as overengineering, written down so it does not creep back in.                                         |
| `docs/plan/reference/test-strategy.md`              | What is unit-tested, what is snapshotted, what is gated.                                                                 |
| `docs/plan/reference/risk-register.md`              | Known risks and their mitigations.                                                                                       |
| `docs/plan/reference/bigpowers-mapping.md`          | Which bigpowers skills were adopted, which map onto what already exists, and which are skipped and why.                  |
| `docs/plan/reference/history-rewrite-2026-09-15.md` | Old commit hash to new, after the 761 MB to 113 MB rewrite.                                                              |
| `docs/briefs/refine-all-texts.md`                   | The owner brief Phase 4.7 executed, stored verbatim.                                                                     |

## Where the phases went

Audits, skills and commit messages still name work by phase. Phases 0 to 5.1 are changes now: each
`proposal.md` is the old phase file byte for byte, so its first line is still `# Phase N · Name`.

| Phase | Where it is                                                                                                       |
| ----- | ----------------------------------------------------------------------------------------------------------------- |
| 0     | `openspec/changes/archive/2026-10-13-01-initialization/`                                                          |
| 1     | `openspec/changes/archive/2026-10-13-02-skeleton-and-infrastructure/`                                             |
| 2     | `openspec/changes/archive/2026-10-13-03-design-system-and-home-page/`                                             |
| 3     | `openspec/changes/archive/2026-10-13-04-content-model-templates-machine-interfaces/`                              |
| 4     | `openspec/changes/archive/2026-10-13-05-core-content/`                                                            |
| 4.5a  | `openspec/changes/archive/2026-10-13-06-machine-layer-every-surface-complete/`                                    |
| 4.5b  | `openspec/changes/archive/2026-10-13-07-human-layer-navigation-standards-semantic-core/`                          |
| 4.6   | `openspec/changes/archive/2026-10-13-08-answer-engine-hardening/`                                                 |
| 4.7   | `openspec/changes/archive/2026-10-13-09-editorial-pass-every-text/`                                               |
| 5     | `openspec/changes/archive/2026-10-24-11-launch/`                                                                  |
| 5.1   | `openspec/changes/archive/2026-10-14-10-harness-integrity/`                                                       |
| 6     | No change: growth repeats, so it is the skill `run-the-growth-loop.md`. Its cadence is `docs/PRD.md` §14, Фаза 6. |

## Where the old PLAN.md sections went

| Was                                   | Is                                        |
| ------------------------------------- | ----------------------------------------- |
| `PLAN.md` §1 locked decisions         | `docs/plan/reference/locked-decisions.md` |
| `PLAN.md` §2 what a phase must not do | `docs/plan/reference/must-not-do.md`      |
| `PLAN.md` §3 the Calibration Gate     | `docs/plan/reference/calibration-gate.md` |
| `PLAN.md` §4 the phases               | the changes above                         |
| `PLAN.md` §5 test strategy            | `docs/plan/reference/test-strategy.md`    |
| `PLAN.md` §6 risk register            | `docs/plan/reference/risk-register.md`    |
