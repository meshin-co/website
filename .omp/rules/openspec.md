---
description: How the OpenSpec tree works in this repository - where behaviour is specified, how a change is proposed and closed, and what gate:spec refuses. Read when touching anything under openspec/.
globs: ["openspec/**"]
---

# The OpenSpec tree

`openspec/` holds two things: what the site does today, and the work that is changing it.

- `openspec/specs/<domain>/<capability>/spec.md` — behaviour that exists **now**. Never a plan.
- `openspec/changes/NN-slug/` — work in flight: `proposal.md`, `tasks.md`, optional `design.md`.
- `openspec/changes/archive/YYYY-MM-DD-NN-slug/` — closed work, kept verbatim.
- `openspec/INDEX.md` and `openspec/CENSUS.json` — generated. Never hand-edit either.

Read `openspec/INDEX.md` first: one line per capability, about 3 KB. Open a single spec when you
need the detail.

## Writing a requirement

A requirement exists only where something can already fail on it. Cite that guard in the body as a
path containing a slash (`site/scripts/human-gate.mjs`) or as a command written exactly
`npm run gate:content`. Those are the only two shapes `site/scripts/docs-gate.mjs` resolves, so a
bare filename is never checked and is banned.

Behaviour nothing can fail on belongs in `docs/plan/reference/known-gaps.md` as a numbered row, not
in a spec. Decisions and their reasons stay in `docs/plan/reference/locked-decisions.md`, whose
numbered rows AGENTS.md, the PRD and three gate scripts cite by number.

Format: `## Purpose` whose **first sentence is lifted into the index**, then `## Requirements`,
then `### Requirement: <a sentence>` with SHALL or MUST under 500 characters, then at least one
`#### Scenario:` with WHEN and THEN bullets. A requirement without a scenario is a validator error,
and so is a spec without requirements.

`openspec/changes/archive/.ignore` holds `*`, so ripgrep and every tool that honours an ignore file
skips the archive: nine closed phases would otherwise answer most searches of this repository. Git
still tracks all 19 files, and `gate:docs`, `gate:spec` and the OpenSpec CLI all still read them —
only interactive search is quieter. Name a path under the archive explicitly to read it.

## Working a change

`openspec list --sort name` is the board; status is computed from ticked task boxes, so tick them as
the work lands. Prefixes start at 10, because `audits/phase-0` through `phase-5.2` already own the
lower numbers. One change is in flight at a time unless another is blocked and untouched — a
blocked change carries a `blocked.md` naming a gap row that exists in
`docs/plan/reference/known-gaps.md`, and has no ticked boxes. A sentence alone does not park a
change: `gate:spec` counts it as in flight. The block lives in its own file because the CLI
rejects an unknown key in `.openspec.yaml`.

A change that touches the built-byte surface (`site/src`, `site/public`, `site/scripts`,
`astro.config.ts`, `budgets.json`, `lighthouserc.cjs`, the manifests) carries a
`## N. Calibration Gate` task group and names the report it generates. The procedure is
`docs/plan/reference/calibration-gate.md` and it has no waiver path.

`skip_specs: true` says the change alters no specified behaviour. `gate:spec` refuses it only when
the change also carries a delta file under its own `specs/`, which is a contradiction. It cannot
tell whether the commits landing beside the change moved shipped source, because nothing ties a
commit to a change: rows G29 and G36 record that.

## After editing the tree

```
npm run assets:spec-census && npm run assets:spec-index && npm run gate:spec
```

`gate:spec` prints how many files it saw in the diff range. A zero there fails only when the range
was named — `SPEC_GATE_RANGE`, which CI always sets — because then the range was expected to hold
the push and resolved to nothing. On a clean checkout with no range named, zero files is the honest
answer and the gate passes.
