# Work a change in the spec tree

Use this when you add or change a capability spec, open a change, or close one. The gate that
refuses the mistakes is `npm run gate:spec`, which runs `scripts/run-spec-gate.mjs` over
`scripts/spec-gate.mjs`.

## Before you write anything

Read `openspec/INDEX.md`. One line per capability, about 3 KB, generated. Open a single spec when
you need its detail; never read the tree whole.

## Adding a requirement

A requirement describes behaviour that exists **today** and that something can already fail on. If
no gate, test or mutation family fails when the behaviour breaks, the sentence belongs in
`docs/plan/reference/known-gaps.md` as a numbered row, not in a spec.

Cite the guard inside the requirement body, written as a path containing a slash
(`site/scripts/human-gate.mjs`) or as a command written exactly `npm run gate:content`. Those two
shapes are the only ones `scripts/docs-gate.mjs` resolves; a bare filename is checked by nothing
and is therefore banned.

Shape, enforced by the validator:

```markdown
### Requirement: A route loads at most 10240 gzipped bytes of JavaScript

Every built route SHALL load at most 10240 gzipped bytes, measured by `site/scripts/gate.mjs`.

#### Scenario: A route is one byte over

- **WHEN** the scripts referenced by `/about` gzip to 10241 bytes
- **THEN** `npm run build` exits non-zero and names the route
```

A requirement with no scenario is an error. A spec with no requirements is an error. Bodies over
500 characters warn, and the gate runs the validator with `--strict`.

## After editing the tree

```bash
npm run assets:spec-census   # scripts/generate-spec-census.mjs writes openspec/CENSUS.json
npm run assets:spec-index    # scripts/generate-spec-index.mjs writes openspec/INDEX.md
npm run gate:spec
```

Both generators read the tree through `scripts/spec-tree.mjs`. Never hand-edit `CENSUS.json` or
`INDEX.md`: the census records every requirement name, so a renamed requirement is a visible diff
rather than a silent substitution, and the index is compared byte for byte.

## Opening and closing a change

Prefixes start at 10, because `audits/phase-0` through `phase-5.2` own the lower numbers, and the
nine closed phases were imported under `01` to `09`. One change is in flight at a time, unless
another carries a `blocked.md` naming a gap row that exists in
`docs/plan/reference/known-gaps.md`, and has no ticked boxes. A sentence alone does not park a
change, and neither does a row number nobody wrote down: `gate:spec` counts both as in flight. The
block lives in its own file because the CLI rejects an unknown key in `.openspec.yaml`.

`skip_specs: true` says the change alters no specified behaviour. The gate refuses it only when the
change also carries a delta under its own `specs/`. It cannot see whether the commits beside the
change moved shipped source, because nothing ties a commit to a change: rows G29 and G36 in
`docs/plan/reference/known-gaps.md` record that limit.

A change touching the built-byte surface — `site/src`, `site/public`, `site/scripts`,
`astro.config.ts`, `budgets.json`, `lighthouserc.cjs`, the manifests — carries a
`## N. Calibration Gate` task group naming the report it generates. The procedure is
`docs/plan/reference/calibration-gate.md`, and it has no waiver.

Tick boxes as the work lands: `openspec list --sort name` computes status from them, so an
unticked list reads as work never started.

## What the gate cannot do

It checks structure, identity and wiring. It never checks whether a requirement is true: that is
the job of the guard the requirement cites. A spec whose guard disappears becomes a dead citation
and reds `npm run gate:docs`, which is the only link between the two.
