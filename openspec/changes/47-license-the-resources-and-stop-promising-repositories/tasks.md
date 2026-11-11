# Tasks

No box is ticked while this change is parked, because a ticked box ends the parking and `blocked.md` says why. Task
1.1 and groups 2 to 6 are in the tree. Task 1.2 and group 7 wait for the archive. The boxes are ticked when the
change is unparked.

## 1. The spec moves first

- [ ] 1.1 The delta under `specs/content/collection-schemas/` modifies the resource requirement: a `license` is
      required, its text ships under `site/public/licenses/`, and an entry that declares none fails the build
- [ ] 1.2 When the change is archived after 44, 45 and 46, the main spec says the same, and `openspec/INDEX.md` and
      `openspec/CENSUS.json` are regenerated

## 2. Every resource entry declares a licence the build can check

- [ ] 2.1 `licenseHasText` in `site/src/utils/resource-license.mjs` returns false for an entry with no `license`,
      for an id with no file under `site/public/licenses/`, and for a file that holds only whitespace
- [ ] 2.2 The resource schema in `site/src/content.config.ts` requires `license`, and an entry that omits it fails
      `npm run build` naming `license: Required`
- [ ] 2.3 `site/public/licenses/CC-BY-4.0.txt` holds the whole legal code of the licence, and each of the 7 entries
      in `site/src/data/resource/` declares `license: CC-BY-4.0`
- [ ] 2.4 `seed/site/src/data/resource/short-answer-checklist.md.seed` declares a `license` and
      `seed/site/public/licenses/CC-BY-4.0.txt.seed` ships its text, so a copy of the engine has a licence to declare

## 3. The site grants what the decision says

- [ ] 3.1 The Content section of `site/src/pages/terms.astro` grants the writing under CC BY 4.0, states the credit
      the licence asks for and names the text at `/licenses/CC-BY-4.0.txt`
- [ ] 3.2 The Engagements section of the same page says only the working method travels between engagements and
      points at the FAQ for where that line falls, rather than restating the boundary: G91
- [ ] 3.3 `site/LICENSE.md` grants the code in the name of the site's author, keeps the notice of the theme above
      the permission text and points the writing at its licence text, and `seed/site/LICENSE.md.seed` carries the
      same structure with the holder left for the owner of the copy
- [ ] 3.4 `/terms` carries the date of the change in `site/src/data/static-pages.mjs`, and `site/content-facts.json`
      allows the number 4.0 that the page now holds

## 4. The pages promise no repository

- [ ] 4.1 The `status` of each of the 7 entries reads
      `Available as a page on this site. There is no repository copy.`, none sets `repoUrl`, and each carries the
      date of the change as its `updatedDate`
- [ ] 4.2 `repoUrl` stays optional in the schema, the page draws the button only when it is set, and the JSON-LD
      names a `codeRepository` only then, so a repository returns with one frontmatter line
- [ ] 4.3 Every rewritten text carries a disposition: `npm run assets:seal` then `npm run gate:editorial` reports 0
      stale
- [ ] 4.4 Row L76 of `docs/plan/reference/locked-decisions.md` amends L10 and leaves its text as it was, and
      `AGENTS.md`, `docs/DECISIONS.md` and `docs/PRD.md` count the new row
- [ ] 4.5 The documents that quoted the old sentence or the old address say what is true now: rows G35 and G43 of
      `docs/plan/reference/known-gaps.md`, rows 6.6 and 6.8 of `docs/COPY-CHECKLIST.md`, and
      `investigation/10-what-exists-for-the-seven-resources.md`

## 5. The guards are proven able to fail

- [ ] 5.1 `site/src/utils/resource-license.test.mjs` fails an entry with no licence even when a text shipped under
      the id `undefined` or `null`, and `site/src/utils/resource-license.site.test.mjs` reads the 7 real entries, so
      a pass is never an empty loop
- [ ] 5.2 `site/scripts/mutation-smoke.mjs` carries `resource-license-undeclared` beside
      `resource-license-without-text`, each with a planted entry under `site/tests/guard-mutations/fixtures/`
- [ ] 5.3 `site/src/utils/resource-license.site.test.mjs` plants a changed `site/LICENSE.md` for each defect the
      check exists to catch: the holder missing, the notice of the theme gone or below the permission text, the
      permission text gone, and the writing not pointed at its licence text

## 6. What no guard covers is written down

- [ ] 6.1 `docs/plan/reference/known-gaps.md` holds G86, the window this change opens, G87, the `status` of an entry
      that nothing relates to its `repoUrl` and a repository that nothing checks, G88, the licence the checklist of
      the owner still records for a page-only artefact, G89, the licence that the structured data names by its bare
      id, G90, the grant of `/terms` that nothing reads, and G91, the boundary on ownership that no
      answer of the owner backs

## 7. Calibration Gate

- [ ] 7.1 `npm test` and `npm run check` pass on the tree
- [ ] 7.2 `npm run test:smoke` proves every family, `resource-license-undeclared` included
- [ ] 7.3 `npm run build`, then `GATE_PHASE=47-license-the-resources-and-stop-promising-repositories npm run gate:lh`
      reading 100 on both form factors for every audited route, then `npm run lh:record`
- [ ] 7.4 `node scripts/report.mjs 47-license-the-resources-and-stop-promising-repositories ../audits/phase-47-license-the-resources-and-stop-promising-repositories`
      generates the report, and it reads `Result: PASS`
