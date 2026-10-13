# delivery/performance-budgets Specification

## Purpose

Governs the byte, search index and Lighthouse budgets that the built site must meet before it ships. Each budget is measured from the built site by a gate that exits non-zero on a breach, and the generated Calibration Gate report repeats every byte and Lighthouse breach as a failure.

## Requirements

### Requirement: Every built page stays inside its JavaScript, CSS and page byte budgets

Every route found in the built HTML, the 404 page and /styleguide included, SHALL ship at most 10240 bytes of JavaScript, 20480 bytes of CSS and 256000 bytes for the HTML plus that JavaScript and CSS, each measured as gzip at level 9. A value equal to its limit passes. Images and fonts are not part of the page total. `site/scripts/gate.mjs` checks every route against `site/budgets.json` as the last step of `npm run build`.

#### Scenario: The home page ships too much JavaScript

- **WHEN** the scripts the home page names gzip to 12419 bytes together
- **THEN** `npm run build` exits 1 and prints `OVER BUDGET / js 12419 > 10240`

### Requirement: A page is charged for every stylesheet and script its HTML names by a root-relative path

A page's JavaScript and CSS figures SHALL include each distinct file its HTML names in an href or src attribute whose value is a root-relative path ending in .css, .js or .mjs, so stylesheets, scripts and modulepreload links all count. A URL on another origin, such as the Plausible script, is never charged. `site/scripts/gate.mjs` applies the rule and `site/scripts/gate.test.mjs` pins both halves.

#### Scenario: The gate stops charging a modulepreload

- **WHEN** the asset scan in `site/scripts/gate.mjs` no longer returns the href of a `<link rel="modulepreload">`
- **THEN** `npm run test` fails the test `assets of a page include stylesheets, scripts and modulepreloads`

### Requirement: The shipped font files stay inside one site-wide raw byte budget

The .woff and .woff2 files directly under dist/_astro/fonts SHALL total at most 122880 bytes, measured raw because the files are already compressed. The total is site-wide and is charged to every route, so one breach is reported once per route. When the fonts budget is set and that folder holds no font bytes, the gate reports a finding instead of passing. `site/scripts/gate.mjs` enforces both during `npm run build`.

#### Scenario: The fonts outgrow the budget

- **WHEN** the font files under dist/_astro/fonts total 122881 bytes
- **THEN** `npm run build` exits 1 and prints `OVER BUDGET / fonts 122881 > 122880`, with a matching line for every other route

#### Scenario: The fonts leave the measured folder

- **WHEN** a build emits no .woff or .woff2 file under dist/_astro/fonts
- **THEN** `npm run build` exits 1 and prints `OVER BUDGET fonts measured 0 bytes in dist/_astro/fonts, so the fonts budget proved nothing`

### Requirement: No route carries a budget exception

`site/budgets.json` SHALL hold exactly js 10240, css 20480, page 256000 and fonts 122880 and no routes block, so every route is held to the same four limits. Because `site/scripts/gate.mjs` would let a routes block raise a named limit for one route, `site/scripts/report.test.mjs` compares the whole file with those four values, and any change fails `npm run test`.

#### Scenario: A route is given its own higher limit

- **WHEN** `site/budgets.json` gains `"routes": { "/search": { "js": 61440 } }`
- **THEN** `npm run test` fails the test `the printed byte-budget sentence comes from budgets.json, not a hardcoded copy` with `Expected values to be strictly deep-equal`

### Requirement: Every search index shard and the shards together stay under their gzip caps

Each built search index shard SHALL gzip to fewer than 65536 bytes, and all shards together to fewer than 196608 bytes, at the default gzip level; a value equal to a cap fails. `npm run gate:search` runs `site/scripts/search-budget.mjs` over the build, and `site/tests/search.spec.ts` asserts the same caps after a real search in a browser.

#### Scenario: One shard outgrows its cap

- **WHEN** `dist/search-index-post.json` gzips to 99316 bytes
- **THEN** `npm run gate:search` exits 1 and prints `dist/search-index-post.json 99316 bytes gz (over 65536)`

#### Scenario: The shards outgrow their joint cap

- **WHEN** every shard is under 65536 bytes but the shards gzip to 232939 bytes together
- **THEN** `npm run gate:search` exits 1 and prints `sum 232939 bytes gz (over 196608)`

### Requirement: Every audited route scores 100 in every Lighthouse category on mobile and desktop

Each audited route SHALL reach a median score of 1 over 3 Lighthouse runs for performance, accessibility, best practices and SEO, under both the mobile and the desktop settings in `site/lighthouserc.cjs`, with Plausible blocked. A route named noindex by design in `site/scripts/lh-routes.cjs` is held instead to every weighted SEO audit except is-crawlable. `npm run gate:lh` exits 1 on any miss.

#### Scenario: An image has no text alternative

- **WHEN** an audited page shows an image with no alt attribute
- **THEN** `npm run gate:lh` exits 1 and prints `categories.accessibility failure for minScore assertion`, then `Assertion failed. Exiting with status code 1.`

#### Scenario: A page waives its own SEO with noindex

- **WHEN** a page that `site/scripts/lh-routes.cjs` does not name carries `<meta name="robots" content="noindex, follow">`
- **THEN** `npm run gate:lh` exits 1 and prints `categories.seo failure for minScore assertion`

### Requirement: Every audited route stays inside the LCP, CLS and TBT ceilings

On the median of 3 runs, each audited route SHALL keep largest contentful paint at or under 1850 ms, cumulative layout shift at or under 0.02 and total blocking time at or under 50 ms, on mobile and on desktop. Mobile runs with a 4x CPU slowdown and 150 ms round trips. `site/lighthouserc.cjs` asserts the three ceilings at error level and `npm run gate:lh` exits 1 when one is crossed.

#### Scenario: The largest paint is slow on mobile

- **WHEN** a route's median largest contentful paint over 3 mobile runs is 2400 ms
- **THEN** `npm run gate:lh` exits 1 and prints `largest-contentful-paint failure for maxNumericValue assertion` with `expected: <=1850`

### Requirement: The audited routes are derived from the build, never listed by hand

The audited set SHALL be derived from the built HTML: every top-level page, every page alone in its directory, and from each directory holding several pages only the heaviest by built bytes. No route is left out by name except /styleguide. `site/lighthouserc.cjs` and `site/scripts/report.mjs` both take the set from `site/scripts/lh-routes.cjs`, and `site/scripts/lh-routes.test.mjs` pins the rule.

#### Scenario: A second route is dropped from the audit

- **WHEN** /about joins /styleguide in the unaudited list in `site/scripts/lh-routes.cjs`
- **THEN** `npm run test` fails the test `the styleguide route is excluded from the auditable set by name`

### Requirement: The Calibration Gate report turns every byte and Lighthouse breach into a failure

`site/scripts/report.mjs` SHALL list each finding the byte gate wrote to dist/gate-routes.json as `budget:` plus the finding, each category median other than 100, and each median metric over the ceiling it reads from `site/lighthouserc.cjs`, then write `Result: FAIL` to REPORT.md and exit 1. It refuses to run when that file is missing, and the report has no waiver field.

#### Scenario: A byte breach reaches the report

- **WHEN** the build recorded `/ css 21000 > 20480`
- **THEN** `node scripts/report.mjs ci ../audits/phase-ci` exits 1, and REPORT.md reads `Result: FAIL` and lists `- budget: / css 21000 > 20480` under `## Failures`

#### Scenario: A slow median reaches the report

- **WHEN** a route's three mobile runs measure largest contentful paint at 1000, 2400 and 2500 ms
- **THEN** the report lists `metric: mobile / largest-contentful-paint: 2400 over budget 1850`

### Requirement: The Calibration Gate report fails when a derived route lacks three runs on either form factor

`site/scripts/report.mjs` SHALL fail when a route that `site/scripts/lh-routes.cjs` derives from the build has no mobile or no desktop run, when any route has other than 3 runs, or when the derived set is empty. It reads the results of every Lighthouse shard and never takes the expected set from the byte gate's route file, so neither a stale file nor a lost shard can shrink it.

#### Scenario: A shard's runs never arrive

- **WHEN** no mobile run for /about reaches the report
- **THEN** `node scripts/report.mjs ci ../audits/phase-ci` exits 1 and lists `mobile: no Lighthouse run for /about`

#### Scenario: A route arrives with one run

- **WHEN** the home page arrives with 1 mobile run
- **THEN** the report lists `mobile /: 1 runs, gate requires 3`
