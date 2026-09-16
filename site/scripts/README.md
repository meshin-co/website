# site/scripts

Every script this project runs, grouped by the job it does. The directory is flat on purpose:
`X.mjs` sits beside `X.test.mjs`, which is what `node --test` and the coverage habit rely on.
This file is the map, and `scripts-index.test.mjs` fails when a script is added without a row or
a row names a script that no longer exists.

Three shapes appear below. A **gate** exits non-zero and blocks; a **generator** writes an asset
or a document; a **module** is imported and holds the rules, with its own tests. Runners named
`run-*.mjs` drive a module against the real tree so the rules stay testable without a browser or
a build.

## Gates

| Script                   | Invoked by                           | What it refuses                                                             |
| ------------------------ | ------------------------------------ | --------------------------------------------------------------------------- |
| `gate.mjs`               | `npm run build`                      | A byte budget exceeded, measured from real gzip bytes                       |
| `content-gate.mjs`       | `gate:content`                       | Banned phrase, missing source, prose rule violation                         |
| `content-html.mjs`       | `gate:html`                          | Invalid markup, duplicate id, missing alt, wrong heading order              |
| `jsonld-gate.mjs`        | `gate:jsonld`                        | A graph node with no `@id`, or a reference that resolves nowhere            |
| `machine.mjs`            | `gate:machine`                       | A machine surface missing from `dist/`, or a catalog that drifted           |
| `orphan-gate.mjs`        | `gate:orphans`                       | A route no other page links to                                              |
| `routes-gate.mjs`        | `gate:routes`                        | The derived route set changed without the plan saying so                    |
| `editorial-gate.mjs`     | `gate:editorial`, `assets:seal`      | An unreviewed string, dead copy, or untraceable rendered text               |
| `generate-registers.mjs` | `gate:registers`, `assets:registers` | A hand-edited register block, or a dangling concept                         |
| `plan-gate.mjs`          | `gate:plan`                          | Two phases claiming `active`, or an index that disagrees with the directory |
| `run-docs-gate.mjs`      | `gate:docs`                          | A document citing a dead path, a dead command, or a stale locked-row range  |
| `check-skills.mjs`       | `gate:skills`                        | A skill naming a path or command that does not exist                        |
| `search-budget.mjs`      | `gate:search`                        | A search shard over its byte budget                                         |
| `mutation-smoke.mjs`     | `test:smoke`                         | A guard family that can no longer be made to fail                           |

## Generators

| Script                         | Invoked by                       | What it writes                                                     |
| ------------------------------ | -------------------------------- | ------------------------------------------------------------------ |
| `gen-headers.mjs`              | `npm run build`                  | `dist/_headers`, with the inline-script hashes the CSP needs       |
| `gen-robots.mjs`               | `assets:robots`                  | `public/robots.txt`                                                |
| `generate-static-sidecars.mjs` | `npm run build`                  | The `.md` sidecar beside every static page                         |
| `search-page-text.mjs`         | `npm run build`                  | The page text the search index is built from                       |
| `generate-logo.mjs`            | `assets:logo`                    | The brand mark: component, symbol, `public/logo.svg`, dark variant |
| `generate-favicons.mjs`        | `assets:favicons`, `assets:logo` | Favicons, apple touch icon, the square social PNGs                 |
| `generate-og-default.mjs`      | `assets:og-default`              | The default Open Graph image                                       |
| `generate-gaps.mjs`            | `assets:gaps`                    | `audits/phase-4.7/gaps.md` from the ledger and the registers       |
| `semantic-core.mjs`            | `assets:registers`               | The generated blocks inside `docs/SEMANTIC-CORE.md`                |
| `indexnow-ping.mjs`            | CI, when the route set changed   | The IndexNow submission                                            |

## Audits and reports

| Script                      | Invoked by               | What it produces                                            |
| --------------------------- | ------------------------ | ----------------------------------------------------------- |
| `report.mjs`                | `gate:lh`, CI            | `audits/phase-N/REPORT.md`, including the metric budgets    |
| `collect-reports.mjs`       | `gate:lh`, `gate:lh:one` | The per-shard Lighthouse runs, merged                       |
| `run-polish-sweep.mjs`      | `audit:polish`           | `audits/phase-5/polish-sweep.md`, 105 routes at six widths  |
| `run-pre-launch.mjs`        | `audit:prelaunch`        | `audits/phase-5/pre-launch.md`, all 24 checklist sections   |
| `run-smoke-prod.mjs`        | `smoke:prod`             | `audits/phase-5/smoke-prod.md`, 18 live requests            |
| `generate-geo-baseline.mjs` | `audit:geo`              | `audits/geo-baseline.md`, buyer-prompt structural readiness |

## Modules

Imported, never run directly. Each holds the rules its gate or report enforces, so the rules can
be tested without a build.

| Script                    | Imported by                                   | What it holds                                                 |
| ------------------------- | --------------------------------------------- | ------------------------------------------------------------- |
| `docs-gate.mjs`           | `run-docs-gate.mjs`                           | Which citations are checkable, and which are excluded by name |
| `smoke-prod.mjs`          | `run-smoke-prod.mjs`                          | The required header set and the per-route verdict             |
| `polish-sweep.mjs`        | `run-polish-sweep.mjs`                        | Finding classification and the six audit widths               |
| `pre-launch.mjs`          | `run-pre-launch.mjs`                          | The checklist rules and the four statuses                     |
| `geo-baseline.mjs`        | `generate-geo-baseline.mjs`                   | Prompt parsing and readiness scoring                          |
| `content-rows.mjs`        | the content and editorial gates               | Row extraction from built HTML                                |
| `prose-rules.mjs`         | the content gate, the registers               | Machine-pattern and density rules                             |
| `registers.mjs`           | `generate-registers.mjs`, `generate-gaps.mjs` | Entity, concept and relationship registers                    |
| `editorial-inventory.mjs` | `editorial-gate.mjs`                          | What counts as a user-facing string                           |
| `editorial-gaps.mjs`      | `generate-gaps.mjs`                           | Unlinked concepts and orphan entities                         |
| `dispositions.mjs`        | `editorial-gate.mjs`                          | Disposition validity and derived status                       |
| `catalog-drift.mjs`       | `machine.mjs`                                 | Static page catalog versus the built pages                    |
| `templates.mjs`           | `editorial-inventory.mjs`                     | Template families and their leaves                            |
| `lh-shards.cjs`           | `lighthouserc.cjs`                            | Route sharding across the Lighthouse matrix                   |

## Servers

| Script            | Invoked by                             | What it does                                                        |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------- |
| `gate-server.mjs` | Playwright, every gate that needs HTTP | Serves `dist/` with the real `_headers` response, including the CSP |

→ verify: `node --test scripts/scripts-index.test.mjs`
