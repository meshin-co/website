# Phase 2 — Calibration Gate report

Generated from raw check output by `scripts/report.mjs`. Do not hand-edit.

Generated-from: a revision before `6a0c9c2`, whose byte-budget assertion read a field
`gate.mjs` never wrote. This report's `Result` covers Lighthouse scores and Lighthouse
metric budgets only; its byte-budget rows were printed, never asserted. The raw Lighthouse
runs behind it are gitignored, so it cannot be regenerated — it is kept as the record of
what was measured at the time, with its limit stated.

Result: PASS

## Lighthouse (median of 3 runs)

| Form factor | Route | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|---|
| mobile | `/` | 100 | 100 | 100 | 100 |
| mobile | `/404` | 100 | 100 | 100 | 100 |
| mobile | `/styleguide/` | 100 | 100 | 100 | n/a (noindex) |
| desktop | `/` | 100 | 100 | 100 | 100 |
| desktop | `/404` | 100 | 100 | 100 | 100 |
| desktop | `/styleguide/` | 100 | 100 | 100 | n/a (noindex) |

## Measured byte budgets (gzip)

| Route | JS | CSS | Page total |
|---|---|---|---|
| `/` | 1108 | 20006 | 29385 |
| `/404` | 1108 | 20006 | 25331 |
| `/styleguide` | 1108 | 20186 | 31096 |

Budgets: JS ≤10240 · CSS ≤20480 · page ≤256000 bytes gzip.

## Derived route list

`/`, `/404`, `/styleguide`
