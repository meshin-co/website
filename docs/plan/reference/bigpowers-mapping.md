# bigpowers, mapped onto this project

The bigpowers skill catalogue was read in full on 2026-09-15 and judged against what this project
already does. Most of it is already here under different names. This file records the verdicts so
no future session re-derives them, and so nobody adopts a skill that would break a hard rule.

Three verdicts: **adopt** (a real gap, now closed), **maps to** (the project already does this,
named here), **skip** (does not apply, with the reason).

## Adopted

| Skill                | What it gave us                                                                            | Where it lives now                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `smoke-test`         | The Calibration Gate's edge checks were prose. Now 18 real requests against a live origin. | `npm run smoke:prod`, `site/.agents/skills/smoke-the-live-site.md`, artifact `audits/phase-5/smoke-prod.md` |
| `compose-workflow`   | Phase 6 had a goal list and no procedure. Now an ordered eight-step loop.                  | `site/.agents/skills/run-the-growth-loop.md`                                                                |
| `enforce-first`      | The F.I.R.S.T rubric was followed but written nowhere, so it could not be checked.         | `AGENTS.md`, the Tests section                                                                              |
| `write-document`     | BMAD's four criteria, and its 300-line circuit breaker, applied to `docs/`.                | This review; `npm run gate:docs` enforces the claims                                                        |
| `organize-workspace` | Three raw `.mhtml` handover dumps sat loose in `docs/`.                                    | `docs/sources/`, named in the read order                                                                    |

Adopted as ideas, never as file formats. `compose-workflow` prescribes `specs/workflows/*.yaml`;
that would breach L49, which says a procedure lives in a skill, a hard rule, a locked row or a
machine check. It became a skill.

## Maps to what already exists

| Skill                               | Already done by                                                                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `survey-context`, `using-bigpowers` | `AGENTS.md` read order plus `docs/plan/INDEX.md` and `navigate-the-plan.md`                                                   |
| `session-state`                     | Each phase file's "Done, with evidence" and "Blocked on the owner" sections, which cite artifacts rather than asserting state |
| `verify-work`                       | `docs/plan/reference/calibration-gate.md`, eleven steps, no waiver path                                                       |
| `execute-plan`, `build-epic`        | The numbered work items in the active phase file, each closed by a gate                                                       |
| `change-request`                    | Appending a locked row and editing the phase file in the same commit                                                          |
| `deploy`                            | L16: Cloudflare Pages builds and deploys from git; there is no CLI step to orchestrate                                        |
| `wire-ci`                           | `.github/workflows/ci.yml`, which classifies the diff before choosing how much of the graph to run                            |
| `audit-code`                        | `npm run check`, `gate:skills`, and the generated phase report                                                                |
| `assess-impact`                     | `gate:orphans` and `gate:routes`, which derive dependents from `dist/` instead of grepping source                             |
| `define-language`                   | The generated registers in `docs/SEMANTIC-CORE.md`, drift-gated by `gate:registers`                                           |
| `develop-tdd`                       | The planted-specimen rule: every guard is proven to fail before it is trusted                                                 |
| `security-review`                   | No server, no auth, no user data; `gate:jsonld`, `gate:content` and the CSP headers cover the real surface                    |

## Skipped, with the reason

- `orchestrate-project` and `gate-trace` both carry waiver-capable status models. The gate has no
  waiver field and status lives only in a filename. Adopting either would weaken both rules.
- `slice-tasks`, `plan-work`, `plan-release`, `scope-work`, `run-planning` describe a greenfield
  discover phase. Phases 0 to 4.7 are done and the scope is fixed by the PRD and the locked rows.
- `trace-requirement` wants story tags in code comments. This project verifies claims in `dist/`,
  never in source, and comments are banned.
- `release-branch` gates on coverage percentage, which means nothing against a Lighthouse and
  byte-budget bar. Pushes to `main` are already gated by the CI graph.
- `inspect-quality` would add a second issue tracker beside the phase files.
- `migrate-spec`, `spike-prototype`, `design-interface`, `seed-conventions` have no target: there
  is no foreign spec to convert, no unexplored domain, no pending interface decision, and the
  conventions already exist in `AGENTS.md`.

## How to use this file

Before adopting anything from the catalogue, read the row here. If a skill is marked `skip` and
the reason no longer holds, change the row in the same commit that adopts it.

→ verify: `npm run gate:docs` proves every path and command this file names resolves.
