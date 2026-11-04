# Tasks

## 1. Measure before choosing

- [x] 1.1 Build the real corpus and record the bytes of the seven shards, the size of an entry and the
      first-query download in the proposal: 95,514 bytes gzipped in all, 4,265 more for every article
- [x] 1.2 Measure four mechanisms on the real corpus, the old shards, a partitioned inverted index, a
      per-entry token bag and titles and descriptions only, and the chunk size at 16,384, 32,768 and
      65,536 bytes
- [x] 1.3 Run 97 queries through the old index and the new one, and name every query whose list
      differs, with both lists
- [x] 1.4 Project +730, +1,460 and +3,650 articles with the production builder over a synthetic
      corpus, with the recall at 20 results against the uncapped index and the crossing date of
      every limit

## 2. The spec moves first

- [x] 2.1 The delta under `specs/` removes the seven-shard requirements and the per-shard and sum caps,
      and adds the manifest, the bounded first query, the stop words and the eight-word limit, the list
      cap, the page description as the excerpt, the deterministic version, the file budget, the one
      public route and its parity message
- [x] 2.2 The main specs of site-search, performance-budgets, agent-interfaces and machine-interfaces
      describe the tree as it now builds, and `openspec/INDEX.md` and `openspec/CENSUS.json` are
      regenerated

## 3. The index

- [x] 3.1 `site/src/utils/search-index.mjs` builds the manifest, the term chunks and the document pages
      from the entries, with `INDEX_LIMITS`, `ROW_LIMITS`, a content version and the list cap
- [x] 3.2 `site/public/search/index-model.mjs` reads it: stop words, at most eight distinct words,
      `rankLists`, and `createSearch` with a retry inside the query and a manifest dropped when its files
      are gone
- [x] 3.3 `site/src/pages/search-entries.json.ts` and `site/scripts/build-search-index.mjs` write the
      index after `astro build` and remove `search-entries.json`; `npm run build` runs the step
- [x] 3.4 `site/public/search/box.mjs` and `site/public/search/shards.mjs` use the new runtime, and the
      excerpt under a result is the page description

## 4. The guards

- [x] 4.1 `site/scripts/search-budget.mjs` replaces the per-shard and sum caps with the first-query
      budget of 65,536 and the file budget of 4,000, and refuses a manifest, a chunk or a page of the
      wrong shape, a file the manifest does not name and a legacy artifact
- [x] 4.2 `gate:machine` holds every file of the index to the noindex header, and its collection gate
      reads the manifest and the pages
- [x] 4.3 `gate:parity` owes each entry a search entry in the manifest and names
      `/search-index/manifest.json` when it holds none
- [x] 4.4 `site/scripts/measure-search.mjs`, run by `npm run measure:search`, prints the size of a built
      index by kind of file, the worst first query against its budget, what one more article adds and
      the day each limit is crossed, exits 0 whatever it finds and 2 for an index it cannot measure

## 5. The readers

- [x] 5.1 `site/scripts/gen-openapi.mjs` describes the manifest alone and `site/scripts/gen-agent-catalog.mjs`
      lists one search entry; the implementation files stay out of both
- [x] 5.2 The search-index skill, the scripts README and the plan documents say what the index now is:
      locked row L68, the decision log, the PRD and gap rows G65 to G67

## 6. Proof

- [x] 6.1 Unit tests of the builder and the runtime, among them the differential tests against the old
      whole-array scan kept in `site/scripts/fixtures/search-oracle.mjs`
- [x] 6.2 `site/tests/search.spec.ts` checks, in a browser, that a first query returns real hits, fetches
      only files the manifest names and downloads no more than the first-query budget
- [x] 6.3 One `test:smoke` family, `search-index-grows-with-corpus`, plants page rows that carry body
      text and requires `npm run gate:search` to go red; one parity specimen removes a search entry
      and requires `npm run gate:parity` to go red

## 7. Calibration Gate

- [ ] 7.1 Lighthouse 100 in every category, mobile and desktop, on `/search` and on the home page, with
      `npm run gate:lh`. Owner-run
- [ ] 7.2 `npm run test:smoke`, every family, including `search-index-grows-with-corpus` and the parity
      specimen. Owner-run: it needs a full build and three browsers
- [ ] 7.3 The Playwright suite with `npm run gate:visual`, including the test `search returns real hits
      and the first query downloads less than the first-query budget`. Owner-run
- [ ] 7.4 A first query in a real browser on the deployed preview: record the bytes downloaded and the
      time against the worst case of 43,312 and the median of 14,877. Owner-run
- [ ] 7.5 `npm run measure:search` on the deployed build, and compare the sizes, the growth per article
      and the crossing dates with the tables of the proposal. Owner-run
- [ ] 7.6 Run the Calibration Gate and commit the report it generates for this change, as change 26 owes,
      to audits/phase-41-search/REPORT.md. Owner-run

## 8. Found while building, not fixed

- [x] 8.1 (recorded as gap row G66, not fixed) The list cap truncates the commonest prefixes from
      2028-05-22 at two articles a day, inside five years, and recall at 20 results falls to 0.997 at
      +1,460 articles and 0.856 at +3,650, modelled
- [x] 8.2 (recorded as gap row G67, not fixed) The first-query budget is crossed on 2032-12-04 and the
      file budget on 2035-11-20 at the measured growth per article, both beyond five years
