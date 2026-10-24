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

| Script                      | Invoked by                           | What it refuses                                                                                                                                                      |
| --------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gate.mjs`                  | `npm run build`                      | A byte budget exceeded: JS, CSS and page from real gzip bytes, fonts from raw woff2 bytes                                                                            |
| `content-gate.mjs`          | `gate:content`                       | Banned phrase, missing source, prose rule violation, or an indexable route with no booking link inside `<main>`                                                      |
| `run-human-gate.mjs`        | `gate:human`                         | Prose above the technical-reader ceilings, an AI tell, or a controlled word                                                                                          |
| `jsonld-gate.mjs`           | `gate:jsonld`                        | A graph node with no `@id`, or a reference that resolves nowhere                                                                                                     |
| `agent-interfaces-gate.mjs` | `gate:agents`                        | A machine interface that drifted from the build: a missing content signal, an OpenAPI path no longer shipped, a catalog link or manifest entry pointing at nothing   |
| `machine.mjs`               | `gate:machine`                       | A machine surface missing from `dist/`, a catalog that drifted, or a page whose JSON-LD, sitemap and sidecar dates disagree                                          |
| `orphan-gate.mjs`           | `gate:orphans`                       | A route no other page links to, or one that only header, footer, breadcrumb or hub listings link to                                                                  |
| `routes-gate.mjs`           | `gate:routes`, `assets:routes`       | A route the ledger `audits/routes.json` lists that the build no longer makes and `audits/routes-removed.json` does not name; `assets:routes` rewrites the ledger     |
| `editorial-gate.mjs`        | `gate:editorial`, `assets:seal`      | An unreviewed string, dead copy, or untraceable rendered text                                                                                                        |
| `generate-registers.mjs`    | `gate:registers`, `assets:registers` | A hand-edited register block that drifted from the source; a dangling concept is only reported, never a failure                                                      |
| `plan-gate.mjs`             | `gate:plan`                          | A script `ci.yml` never runs, a browser CI never installs, a malformed gap row, or a pending specimen owed to a missing or archived change                           |
| `run-evidence-gate.mjs`     | `gate:evidence`                      | A markdown file under `audits/` with no `Generated-from:` line, or whose first word is not a hash `git cat-file -t` calls a commit (8 legacy reports may keep prose) |
| `run-docs-gate.mjs`         | `gate:docs`                          | A document citing a dead path, a path git ignores, a dead command, or a stale locked-row range                                                                       |
| `run-spec-gate.mjs`         | `gate:spec`                          | A spec tree the validator disagrees with, a drifted census or index, a change that owes a Calibration Gate                                                           |
| `run-external-links.mjs`    | `gate:external`                      | An outbound link missing `nofollow`, `noopener` or `noreferrer`                                                                                                      |
| `run-links-gate.mjs`        | `gate:links`                         | A link whose target still errors after its retries; `LINKS_SKIP_EXTERNAL=1` crawls the build alone                                                                   |
| `check-skills.mjs`          | `gate:skills`                        | A skill naming a path or command that does not exist                                                                                                                 |
| `search-budget.mjs`         | `gate:search`                        | A search shard over its byte budget                                                                                                                                  |
| `mutation-smoke.mjs`        | `test:smoke`                         | A guard family that can no longer be made to fail                                                                                                                    |
| `brand-gate.mjs`            | `gate:brand`                         | A typed brand-name literal in code that should derive it from `src/config.yaml` instead                                                                              |
| `run-paid-gate.mjs`         | `gate:paid`                          | A built route loading an undeclared third-party origin, or whose analytics copy disagrees with the shipped beacon (L58)                                              |

## Generators

| Script                         | Invoked by                                                         | What it writes                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `gen-agent-catalog.mjs`        | `npm run build`                                                    | `dist/.well-known/api-catalog` and `dist/.well-known/ai-catalog.json`, from the machine files the build shipped |
| `gen-edge-worker.mjs`          | `npm run build`                                                    | `dist/_worker.js`, the markdown-negotiation handler Pages runs (L60)                                            |
| `gen-headers.mjs`              | `npm run build`                                                    | `dist/_headers`, with the inline-script hashes the CSP needs                                                    |
| `gen-openapi.mjs`              | `npm run build`                                                    | `dist/openapi.json`, describing the JSON resources the build ships                                              |
| `gen-robots.mjs`               | `assets:robots`                                                    | `public/robots.txt`                                                                                             |
| `generate-static-sidecars.mjs` | `npm run build`                                                    | The `.md` sidecar beside every static page                                                                      |
| `search-page-text.mjs`         | `npm run build`                                                    | The page text the search index is built from                                                                    |
| `generate-logo.mjs`            | `assets:logo`                                                      | The brand mark: component, symbol, `public/logo.svg`, dark variant                                              |
| `generate-favicons.mjs`        | `assets:favicons`, `assets:logo`                                   | Favicons, apple touch icon, the square social PNGs                                                              |
| `generate-og-default.mjs`      | `assets:og-default`                                                | The default Open Graph image                                                                                    |
| `generate-gaps.mjs`            | `assets:gaps`                                                      | `audits/phase-4.7/gaps.md` from the ledger and the registers                                                    |
| `semantic-core.mjs`            | `node scripts/semantic-core.mjs` (no npm script; run from `site/`) | The generated blocks inside `docs/SEMANTIC-CORE.md`                                                             |
| `generate-spec-census.mjs`     | `assets:spec-census`                                               | `openspec/CENSUS.json`, the requirement names of every capability                                               |
| `generate-spec-index.mjs`      | `assets:spec-index`                                                | `openspec/INDEX.md`, one line per capability                                                                    |
| `indexnow-ping.mjs`            | CI, when a page's built HTML changed                               | The IndexNow submission of the added and edited routes                                                          |

## Audits and reports

| Script                      | Invoked by             | What it produces                                                  |
| --------------------------- | ---------------------- | ----------------------------------------------------------------- |
| `report.mjs`                | CI (`gate-report` job) | `audits/phase-N/REPORT.md`, including the metric budgets          |
| `collect-reports.mjs`       | `gate:lh:one`          | The per-shard Lighthouse runs, merged                             |
| `run-polish-sweep.mjs`      | `audit:polish`         | `audits/phase-5/polish-sweep.md`, 105 routes at six widths        |
| `run-pre-launch.mjs`        | `audit:prelaunch`      | `audits/phase-5/pre-launch.md`, all 24 checklist sections         |
| `run-smoke-prod.mjs`        | `smoke:prod`           | 19 live requests, 21 checks; the report is git-ignored by default |
| `generate-geo-baseline.mjs` | `audit:geo`            | `audits/geo-baseline.md`, buyer-prompt structural readiness       |
| `run-geo-probe.mjs`         | `audit:geo-probe`      | `audits/geo-probe.md`, what four live answer engines actually say |

## Publishing

| Script                   | Invoked by                 | What it does                                                                           |
| ------------------------ | -------------------------- | -------------------------------------------------------------------------------------- |
| `run-deploy-check.mjs`   | `deploy:check`             | Reports whether the token authenticates, Pages is readable and the project exists      |
| `run-deploy.mjs`         | `deploy`, `deploy:preview` | Uploads `dist/` to Pages, refusing a build the route ledger has not seen               |
| `run-publish-target.mjs` | Publish Live workflow      | Resolves which gated build a press publishes, refusing a stale or missing one          |
| `run-lh-parallel.mjs`    | `gate:lh`                  | Shards both form factors across workers, stamping the tree, stopping a shard that lags |
| `run-lh-evidence.mjs`    | `lh:record`, `lh:check`    | Records a green run measured from this tree, and refuses a push of one none measured   |

## Modules

Imported, never run directly. Each holds the rules its gate or report enforces, so the rules can
be tested without a build.

| Script                     | Imported by                                                                                                       | What it holds                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `evidence-gate.mjs`        | `run-evidence-gate.mjs`                                                                                           | Whether each markdown file under `audits/` names a real commit, the 8-report legacy allow-list, and the line generators stamp                 |
| `docs-gate.mjs`            | `run-docs-gate.mjs`                                                                                               | Which citations are checkable, and which are excluded by name                                                                                 |
| `spec-gate.mjs`            | `run-spec-gate.mjs`, `generate-spec-census.mjs`, `generate-spec-index.mjs`                                        | Spec parsing, the census, the index, and every change rule                                                                                    |
| `spec-tree.mjs`            | `generate-spec-census.mjs`, `generate-spec-index.mjs`                                                             | Reading the capability tree from disk                                                                                                         |
| `external-links.mjs`       | `run-external-links.mjs`                                                                                          | The required rel set, and what counts as outbound                                                                                             |
| `links-gate.mjs`           | `run-links-gate.mjs`                                                                                              | The crawl arguments, the skipped hosts, and the hermetic mode                                                                                 |
| `deploy.mjs`               | `run-deploy.mjs`, `run-deploy-check.mjs`                                                                          | The required credentials, the wrangler arguments, and the route-ledger refusal                                                                |
| `invoked-directly.mjs`     | every script with a `main`                                                                                        | Whether a module is the entry point, resolving symlinks, so a script run from a shard directory still starts                                  |
| `lh-port.cjs`              | `lighthouserc.cjs`                                                                                                | Which port a shard serves on: the one the runner handed it, or a spaced fallback when run by hand                                             |
| `lh-parallel.mjs`          | `run-lh-parallel.mjs`                                                                                             | How many workers a machine may run, which shard takes which port, and when a straggler has run long enough                                    |
| `markdown-table.mjs`       | `registers.mjs`, `semantic-core.mjs`                                                                              | One definition of a markdown table shaped the way prettier shapes it, so a generated block never reads as drift                               |
| `build-surface.mjs`        | `publish-target.mjs`, `lh-evidence.mjs`                                                                           | Whether a path can change the built output, which is not the same question as whether it is markdown                                          |
| `lh-evidence.mjs`          | `run-lh-evidence.mjs`, `run-lh-parallel.mjs`, `lh-record-family.mjs`                                              | The fingerprint of everything that can change the build, the stamp of the tree a run measured, and when a record is stale                     |
| `publish-target.mjs`       | `run-publish-target.mjs`                                                                                          | Which gated ci run the Publish Live button may publish, and which later commits block it                                                      |
| `third-party.mjs`          | `run-paid-gate.mjs`                                                                                               | Every third-party origin the build may load, with the reason each is free (L58)                                                               |
| `smoke-prod.mjs`           | `run-smoke-prod.mjs`                                                                                              | The required header set and the per-route verdict                                                                                             |
| `polish-sweep.mjs`         | `run-polish-sweep.mjs`                                                                                            | Finding classification and the six audit widths                                                                                               |
| `pre-launch.mjs`           | `run-pre-launch.mjs`                                                                                              | The checklist rules and the four statuses                                                                                                     |
| `geo-baseline.mjs`         | `generate-geo-baseline.mjs`, `run-geo-probe.mjs`                                                                  | Prompt parsing and readiness scoring                                                                                                          |
| `geo-probe.mjs`            | `run-geo-probe.mjs`                                                                                               | Verdict classification, redirect resolution, the engine roster                                                                                |
| `content-html.mjs`         | `content-gate.mjs`, `generate-static-sidecars.mjs`, `search-page-text.mjs`, `semantic-core.mjs`, `human-gate.mjs` | HTML extraction: title, h1, paragraphs and headings from a built page, plus its `<main>` region and the part of it a reader reads as the page |
| `content-rows.mjs`         | `content-gate.mjs`, `semantic-core.mjs`                                                                           | Row extraction from built HTML                                                                                                                |
| `prose-rules.mjs`          | `content-gate.mjs`, `content-rows.mjs`, `human-gate.mjs`                                                          | Machine-pattern and density rules                                                                                                             |
| `human-gate.mjs`           | `run-human-gate.mjs`                                                                                              | Reading-level ceilings, the AI tells and the plain-word check                                                                                 |
| `registers.mjs`            | `generate-registers.mjs`, `generate-gaps.mjs`                                                                     | Entity, concept and relationship registers                                                                                                    |
| `editorial-inventory.mjs`  | `editorial-gate.mjs`                                                                                              | What counts as a user-facing string                                                                                                           |
| `editorial-gaps.mjs`       | `generate-gaps.mjs`                                                                                               | Unlinked concepts and orphan entities                                                                                                         |
| `dispositions.mjs`         | `editorial-gate.mjs`                                                                                              | Disposition validity and derived status                                                                                                       |
| `catalog-drift.mjs`        | `machine.mjs`                                                                                                     | Static page catalog versus the built pages                                                                                                    |
| `llms-corpus.mjs`          | `machine.mjs`                                                                                                     | The llms files against each other: counts, shard ranges, the next-part chain, no entry twice                                                  |
| `templates.mjs`            | nothing in `scripts/` — only `templates.test.mjs` exercises it                                                    | Template families and their leaves                                                                                                            |
| `lh-shards.cjs`            | `lighthouserc.cjs`, `collect-reports.mjs`                                                                         | Route sharding across the Lighthouse matrix                                                                                                   |
| `lh-routes.cjs`            | `lighthouserc.cjs`, `report.mjs`, `gate:lh:one` (`--count`)                                                       | Audited routes, the noindex-by-design list, `LH_ONLY_ROUTES`                                                                                  |
| `mutation-specimens.mjs`   | `mutation-smoke.mjs`, `lh-record-family.mjs`                                                                      | Per gate: the planted defect and the output token it must name                                                                                |
| `markdown-negotiation.mjs` | `gen-edge-worker.mjs`, which copies it into the build as `dist/_worker.js`                                        | The edge handler Pages runs: `Accept: text/markdown` is answered with the route's `.md` sidecar (L60)                                         |
| `spec-specimens.mjs`       | `mutation-specimens.mjs`                                                                                          | The `gate:spec` specimens: one defect per rule, each on a fixed diff                                                                          |
| `evidence-specimens.mjs`   | `mutation-specimens.mjs`                                                                                          | A `Generated-from:` token naming a tree, prose off the allow-list, or a report that says FAIL                                                 |
| `lh-record-family.mjs`     | `mutation-smoke.mjs`                                                                                              | The `lh-record` family: a throwaway repository holding a measured phase, and the edit committed after its run                                 |
| `mutation-pending.mjs`     | `plan-gate.mjs`                                                                                                   | Gates still owed a specimen, each with the open change that owes it                                                                           |
| `pagination-markup.mjs`    | `mutation-smoke.mjs`                                                                                              | What a built tag archive must say: head, control, sitemap                                                                                     |
| `collection-gate.mjs`      | `machine.mjs`                                                                                                     | Which collections have no live entry, and whether an empty one is still indexable, mirrored, listed or fed                                    |
| `booking-cta.mjs`          | `content-gate.mjs`                                                                                                | Whether `<main>` of each indexable built route links the booking url, and what it links instead                                               |
| `date-agreement.mjs`       | `machine.mjs`                                                                                                     | Whether each route states one editorial date in its JSON-LD, sitemap entry and sidecar, and that no date is a clock reading                   |

## Servers

| Script            | Invoked by                             | What it does                                                                                                                                         |
| ----------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gate-server.mjs` | Playwright, every gate that needs HTTP | Serves `dist/` as Cloudflare Pages serves a flat build: the real `_headers` and CSP, `/about` answered 200, and a 308 on `/about/` and `/about.html` |

→ verify: `node --test scripts/scripts-index.test.mjs`
