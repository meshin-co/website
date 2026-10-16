# Prove Lighthouse ran locally

Lighthouse measures a browser under load, so a shared CI runner is the wrong instrument: the hosted
matrix took most of the wall time of every run and still produced 97–99 scores that had to be
re-run. It runs on a quiet machine instead, and a push proves it ran (L59).

## Run it

```bash
cd site
npm run build                                   # the only build that may be measured
GATE_PHASE=<bucket> npm run gate:lh             # both form factors, ~40 min
```

`GATE_PHASE` is required: `collect-reports.mjs` files each run under `audits/phase-<bucket>/`, and
`lh:record` reads that same folder. A bucket is a phase number or a change name.

Run nothing else while it runs. Four shards beside a baseline regeneration once took 2h37m and all
failed; run singly they passed in four minutes each.

## What the record proves

`gate:lh` ends in `lh:record`, which does not take the console's word for it. It calls
`phaseVerdict` in `scripts/report.mjs` — the same function that renders the committed REPORT.md —
and writes `audits/lighthouse-green.json` only when that verdict has no failures. So the record
means what the Calibration Gate means: every audited route present on both form factors, three runs
each, all four categories at 100 (noindex routes scored without `is-crawlable`), and the median LCP,
CLS and TBT budgets met. A partial audit cannot satisfy it, because the expected route set is
derived from `dist/` rather than from the run.

It also refuses while any build-surface file is uncommitted: the record keys a fingerprint of HEAD,
and a run measured from a dirty tree would certify bytes nobody measured. The order is commit,
build, measure, record, then commit the record — which lands under `audits/`, so it does not move
the fingerprint it just wrote.

The record keys a fingerprint, from `scripts/lh-evidence.mjs`, of every tracked file that can
change the built output. `scripts/build-surface.mjs` answers which: content markdown under
`site/src/data/` counts, a test file or a fixture does not, and prose under `docs/`, `audits/`,
`openspec/`, `investigation/` or `site/.agents/` never does.

A refusal names the factor, the route and what failed, and writes nothing:

```
LIGHTHOUSE mobile /pricing performance: 99
LIGHTHOUSE desktop /blog: 2 runs, gate requires 3
LIGHTHOUSE audits/phase-13-free-analytics is not a passing calibration run (2 failure(s))
```

## The push

`.githooks/pre-push` runs `scripts/run-lh-evidence.mjs check`. It refuses a push whose tree no
recorded run measured, naming when the last run happened. A prose-only commit changes no
fingerprint and pushes freely.

`npm install` points `core.hooksPath` at `.githooks`; after a fresh clone run it once before
pushing, or the hook is simply absent.

There is no waiver. A tree that needs a new measurement gets one.
