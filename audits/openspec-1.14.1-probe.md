# OpenSpec 1.14.1 — probe record

Generated-from: d2cd00a (the commit this record was written against; the commands below were run by hand, and no gate re-runs them)

Every claim is a command that was run on this machine on 2026-10-13, with its real exit code. This
file is dated testimony about a tool, not a live check: nothing in the harness re-runs it. Re-run a
row by hand before trusting it after a CLI upgrade.

Resolved CLI: `site/node_modules/.bin/openspec`, version `1.14.1`, pinned exact in
`site/package.json`. Environment for every run: `OPENSPEC_TELEMETRY=0 OPENSPEC_NO_UPDATE_CHECK=1`.

| # | Claim | Command | Exit |
|---|---|---|---|
| 1 | `init --tools none` creates exactly three paths and a comments-only config | `openspec init --tools none` in an empty directory | 0 |
| 2 | An empty tree validates green with zero items, so a vacuity guard is required | `openspec validate --all --strict --json` | 0 |
| 3 | A requirement without a scenario is an error | `openspec validate --specs --strict --json` on a spec whose requirement has no `#### Scenario:` | 1 |
| 4 | A spec with zero requirements is an error, so attrition bottoms out at one per capability | same command on a spec with an empty `## Requirements` | 1 |
| 5 | A hand-made archived change with `skip_specs: true`, a proposal and a design, and no `tasks.md`, validates clean — verbatim phase import is legal | `openspec validate --archived --json` | 0 |
| 6 | `skip_specs: true` is honoured on an **active** change, so the validation opt-out must be restricted by our own rule | `openspec validate --all --strict --json` with an active change declaring it | valid, info only |
| 7 | `list --json` computes `completedTasks`/`totalTasks` and reports `in-progress` or `no-tasks`; `--sort name` exists | `openspec list --json`, `openspec list --help` | 0 |
| 8 | The CLI resolves the repository-root tree when invoked from `site/`, walking upward from the working directory rather than from its own location | `openspec list --json` run in `<root>/site` with the tree at `<root>/openspec` | 0, `root.source: nearest` |
| 9 | `CENSUS.json` and `INDEX.md` placed inside `openspec/specs/` are ignored by the validator, which counts only `spec.md` under a capability directory | `openspec validate --all --strict --json` with both files present | unchanged counts |
| 10 | `init --tools oh-my-pi` would write 196 KB across 12 files into `.omp/`; rejected, the repository keeps its own lazy rule instead | `openspec init --tools oh-my-pi` in a scratch directory | 0 |

## Why this file is not under `audits/phase-*/`

`routes-gate.mjs` picks its route baseline from the highest-sorting `phase-*` directory that already
contains a `routes.json`. A markdown-only bucket could not re-point that baseline today, but a
numbered directory invites one later. This record is evidence about a tool, not about a phase, so it
carries no phase number.
