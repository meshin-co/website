# delivery/performance-budgets Specification

## REMOVED Requirements

### Requirement: Every search index shard and the shards together stay under their gzip caps

**Reason**: The index is no longer seven shards that a visitor downloads whole. The post shard grew by 4,265 bytes gzipped per article and was set to cross its 65536 cap about 2026-11-07, and the 196608 sum cap about twelve days later. A cap on the sum of files the browser never fetches whole bounds nothing a visitor feels, so the guarantee is kept as a bound on what a first query downloads, in the two requirements added below.

## ADDED Requirements

### Requirement: The worst first query of a search stays within 64 KiB gzipped

`npm run gate:search` SHALL compute from the built `/search-index/` files, at the default gzip level, the gzip bytes of the manifest plus the eight largest term chunks plus the twenty largest document pages, all pages when there are fewer, and SHALL exit 1 when that sum is over 65536, a sum equal to 65536 passing. `site/tests/search.spec.ts` asserts the same cap on the bytes a real first query downloads.

#### Scenario: The worst first query outgrows its budget

- **WHEN** the document pages carry body text and the worst first query gzips to 109750 bytes
- **THEN** `npm run gate:search` prints `search-index: first query worst case 109750 bytes gz (over 65536)` and exits 1

#### Scenario: The cap itself passes

- **WHEN** the worst first query gzips to exactly 65536 bytes, and then to 65537
- **THEN** `npm run gate:search` exits 0 and then 1, as the test `a worst first query of exactly the cap passes and one byte over it is refused with its size` pins under `npm run test`

#### Scenario: The guard stops seeing growth

- **WHEN** `npm run gate:search` passes a build whose document pages carry body text
- **THEN** `npm run test:smoke` fails the family `search-index-grows-with-corpus`

### Requirement: The search index holds at most 4000 files

`npm run gate:search` SHALL exit 1 when `/search-index/` holds more than 4000 files, `INDEX_FILE_BUDGET` in `site/scripts/search-budget.mjs`, and 4000 files SHALL pass. The budget is a fifth of the 20000 files Cloudflare Pages allows in one deployment. On success the gate SHALL print the file count and the worst first query.

#### Scenario: The index outgrows its file budget

- **WHEN** `/search-index/` holds 4001 files
- **THEN** `npm run gate:search` prints `search-index: 4001 files (over 4000)` and exits 1

#### Scenario: A build within both budgets

- **WHEN** the index holds 37 files and its worst first query gzips to 43312 bytes
- **THEN** `npm run gate:search` prints `search-index: 37 files, first query worst case 43312 bytes gz (cap 65536)` and exits 0

### Requirement: The measure command prints how far each search limit is and the day it is crossed

`npm run measure:search` runs `site/scripts/measure-search.mjs` over the build and SHALL print the bytes of the manifest, the term chunks and the document pages, the worst first query against its budget, and for the first-query budget, the file budget and the list cap the day each is crossed and whether that day is inside five years. It SHALL exit 0 whatever it finds and 2 for an index it cannot measure or a flag it does not know.

#### Scenario: A limit falls on the five-year day

- **WHEN** the command calls a limit crossed on the day five years after the start beyond five years, or one crossed a day later inside five years
- **THEN** `npm run test` fails the test `a limit is inside five years up to the same day five years on, and beyond from the next day`

#### Scenario: The index cannot be measured

- **WHEN** `dist` holds no `/search-index/manifest.json`
- **THEN** `npm run measure:search` prints one `MEASURE-SEARCH` line naming the dist and the file and exits 2, as the test `the command refuses an index it cannot measure with exit 2 and one MEASURE-SEARCH line naming the dist and the file` pins under `npm run test`

#### Scenario: No rate is given

- **WHEN** the command runs with no `--per-day`
- **THEN** it takes the articles a day from the write times of the engine config, and `npm run test` fails the test `with no rate given the command takes the articles a day from the write times of the engine config` if it does not
