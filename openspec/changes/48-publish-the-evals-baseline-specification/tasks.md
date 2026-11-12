# Tasks

No box is ticked while this change is parked, because a ticked box ends the parking and `blocked.md` says why.
Groups 1 to 6 are in the tree. Task 1.2 and group 7 wait for the archive. The boxes are ticked when the change is
unparked.

## 1. The spec moves first

- [ ] 1.1 The delta under `specs/content/collection-schemas/` adds the specification-entry requirement: a `name`, a
      two-number `version`, a `license`, a `citeAs` holding its `citeKey`, and one entry per address
- [ ] 1.2 When the change is archived after 44, 45, 46 and 47, the main spec says the same, and `openspec/INDEX.md`
      and `openspec/CENSUS.json` are regenerated

## 2. The family exists and is addressed by data

- [ ] 2.1 `specCollection` in `site/src/content.config.ts` requires the five fields, and `specId` builds the entry id
      from `name` and `version`, so a second version is a second file
- [ ] 2.2 `site/src/pages/spec/[name]/[version].astro` renders the version page and
      `site/src/pages/spec/[name]/index.astro` the series page, which holds no normative text
- [ ] 2.3 `SERIES_BASES` in `site/scripts/route-kinds.mjs` carries `spec`, so `templateOf` reports two template
      families and the gates that walk templates see both

## 3. The dotted version segment is read as a path, never as a file extension

- [ ] 3.1 `site/scripts/gate-server.mjs` answers `/spec/evals-baseline/1.0` with the page instead of 404
- [ ] 3.2 `site/scripts/links-gate.mjs` rewrites it to `.html` the way it rewrites every other route
- [ ] 3.3 `site/scripts/markdown-negotiation.mjs` answers `Accept: text/markdown` on it with the `.md` sidecar

## 4. The family carries every obligation the others carry

- [ ] 4.1 `dist/spec/evals-baseline/1.0.md` and `dist/spec/evals-baseline.md` are the sidecars, and
      `npm run gate:agents` reads them
- [ ] 4.2 Both routes hold a sitemap entry with `lastmod`, a search document, an OG card and a JSON-LD graph whose
      every `@id` resolves
- [ ] 4.3 `spec` is the seventh public collection: `dist/llms/spec.txt`, a line in `dist/llms.txt` and
      `dist/llms-full.txt`, and entries in `dist/spec/rss.xml`, `dist/rss.xml` and `dist/feed.json`

## 5. The guards are proven able to fail

- [ ] 5.1 `groupSeries` in `site/src/utils/spec-series.mjs` throws on two entries at one address, and
      `site/src/utils/spec-address.test.mjs` covers the duplicate, the several-versions case and the sorted report
- [ ] 5.2 `site/scripts/mutation-smoke.mjs` carries `spec-address-duplicated` with a planted entry under
      `site/tests/guard-mutations/fixtures/`, and `npm run build` fails naming the address
- [ ] 5.3 `site/src/data/spec-vector-table.site.test.mjs` parses the published coverage table and fails on an
      inflated row, a stated total that is not the sum, a row claiming more vectors than exist, and verb counts that
      do not add up

## 6. What the change leaves open is written down

- [ ] 6.1 `docs/plan/reference/known-gaps.md` holds G92, the conformance vectors a reader cannot reach while the
      implementation is unpublished, and G93, the absence of any check relating the page to that implementation
- [ ] 6.2 Row L77 of `docs/plan/reference/locked-decisions.md` records that the address carries no trailing slash,
      against the form section 12 of `docs/plan/reference/evals-baseline-spec.md` settled on 2026-11-11

## 7. Calibration Gate

- [ ] 7.1 `npm test` and `npm run check` pass on the tree
- [ ] 7.2 `npm run test:smoke` proves every family, `spec-address-duplicated` included
- [ ] 7.3 `npm run build`, then `GATE_PHASE=48-publish-the-evals-baseline-specification npm run gate:lh` reading 100
      on both form factors for every audited route, then `npm run lh:record`
- [ ] 7.4 `node scripts/report.mjs 48-publish-the-evals-baseline-specification ../audits/phase-48-publish-the-evals-baseline-specification`
      generates the report, and it reads `Result: PASS`
