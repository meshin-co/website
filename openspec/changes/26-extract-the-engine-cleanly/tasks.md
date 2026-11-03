# Tasks

## 1. Partition the repository, by derivation

- [x] 1.1 `scripts/engine-partition.mjs` gives every tracked file one class from an ordered rule
      list; a file that fits no rule has no class
- [x] 1.2 `scripts/engine-partition-facts.mjs` reads the layout, the collections, the script
      directories, the generated outputs, the noindex routes and the identity terms from the tree
- [x] 1.3 `scripts/engine-partition-gate.mjs` and `scripts/run-partition-gate.mjs` report
      `unclassified`, `site-bound` and `anchor-unserved`, and print the three counts
- [x] 1.4 Planted scenes in `engine-partition-gate.test.mjs` fail on each finding; the runner test
      fails when the exit code is forced to 0
- [x] 1.5 The skill `extract-the-engine-from-a-site.md` states the rules, the findings and what does
      not transfer
- [x] 1.6 22 starters under `seed/<path>.seed` leave 0 `unclassified` and 0 `anchor-unserved`
      findings: the agent law, the site config, the semantic core, the routes, an empty demand report with
      every buyer prompt unproven, the content facts, the category, tag and home data, the static page
      catalogue, three collection hubs, and one example entry for the term, article, resource and author
      collections
- [ ] 1.7 Resolve the 34 `site-bound` files that `gate:partition` still allows: prose in skills, specs and
      workflows names the site; scripts hardcode it (`external-links`, `links-gate`, `geo-probe`,
      `escalate-channels`, `pr-github`); `jsonld`, `booking`, `navigation`, `styleguide` and the search index
      hold its identity in engine code; `package.json`, `.env.example`, `README.md`, `content-facts.json` and
      `engine.config.json` name it. Each one moves its fact into the config or into a seeded data file
- [ ] 1.8 `STATIC_PAGE_CATALOG` and `HUB_PAGES` moved to `site/src/data/static-pages.mjs`, which the export
      seeds, so a copy builds with no edit of an engine file. Still open: 52 `missing-path` findings of
      `gate:skills` and 55 `dead-path` findings of `gate:docs` in a copy, because skills and documents cite
      site or evidence files that do not travel
- [ ] 1.9 Move into configuration, or into a question, the facts engine code holds without the
      partition seeing the site name: the person-name pattern `OUR_NAMES` in `geo-probe.mjs`; the
      place term and the locked-decision reference in `ABSENCE_CLAIMS` and the buyer size in
      `semantic-core.mjs`; the heading `### The 30 buyer prompts` read by `semantic-core.mjs`,
      `route-derive.mjs` and `geo-baseline.mjs`; four copies of the category list
      (`entry-limits.mjs`, `content.config.ts`, `categories.mjs`, `categories.test.mjs`); the
      standards vocabulary in `claim-sources.mjs`, `content-rows.mjs` and `writer-prompt-text.mjs`;
      the `audits/phase-4.7/` paths in `generate-gaps.mjs` and `route-derive.mjs`; `site.name`
      serving as title suffix, mail domain and probe host; `TICK_MINUTES = 10` in `pr-watch.mjs`
      beside the `autowriter-tick` timer

## 2. Export, and prove the export by adopting it

- [x] 2.1 `scripts/export-engine.mjs` (`npm run export:engine -- <empty directory>`) writes every engine file
      and every seed at its target path, plus `engine-export.json` with the counts, the seeded files and the
      carried `site-bound` files; it refuses a non-empty target, an `unclassified` file and an
      `anchor-unserved` anchor
- [x] 2.2 The export was adopted in a scratch directory for an invented site: `engine.config.json` filled,
      anchor files created, `npm install`, `npm run build` and every gate that needs no secret run; the
      stdout is quoted in the delivery report. The copy builds with no edit of an engine file
- [x] 2.3 No measured record is exported. `audits/sentence-band.json` describes one corpus: `bandFor` throws
      when it is absent and `gate:autowriter` reports `record-corpus-stale` for another corpus, so the
      new site runs `node scripts/measure-sentence-band.mjs --write` before its first automated article.
      The demand report ships empty with every prompt unproven, because a report measured on another
      property is not evidence for this one
- [ ] 2.4 `npm test` in the adopted copy fails 182 tests in 49 files: the seeded core has 3 prompts where tests
      pin the original's 30, the corpus is smaller than the tests assume, and tests hold the original's host,
      brand, author, pages and collections. A test that pins a fact of this site belongs to this site

## 3. The interview

- [x] 3.1 `docs/plan/reference/new-site-interview.md` holds 97 questions in the order they are needed,
      each with the options, a recommendation, where the answer lands and what breaks when it is
      wrong: the site (S1 to S48), the semantic core and the buyer prompts (K1 to K34, ending in the
      contract of a complete core) and the platform (P1 to P15)
- [x] 3.2 Part 3 of the bank records the secrets and the repository settings separately, with what
      fails and how when each is absent: `AUTOWRITER_PAT`, `AUTOWRITER_OPENAI_API_KEY`,
      `GSC_SERVICE_ACCOUNT_JSON`, `SLACK_WEBHOOK_URL`, the four writer variables, the
      `autowriter-tick` environment and its wait timer, the required status check on `main`, and the
      three failures that already happened
- [x] 3.3 `interview-the-owner-of-a-new-site.md` is 68 lines; `check-engine.mjs` points at the bank
      whenever it reports a finding

## 4. Keep it true

- [x] 4.1 `npm run gate:partition` runs in `ci.yml` and is named by the skill. It runs with
      `--allow site-bound=34`, a ceiling: up to 34 engine files that name this site print as `ALLOWED` and do not
      fail, and a 35th fails with every one listed. `unclassified` and `anchor-unserved` always fail. The ceiling
      only goes down: lower it as 1.7 fixes files
- [x] 4.2 Planted specimens and `mutation-smoke.mjs` rows: a file that fits no rule, an anchor whose seed is
      removed, an engine file that names the site past the ceiling, and an export that no longer builds
- [x] 4.3 The export proof runs on demand. A full export and build takes about a minute, which is too slow for
      the gate and too slow for the pre-push hook. `localOnlyGates` in `site/package.json` records it
- [ ] 4.4 A finding for an interview that misses a config value or a workflow secret

## 5. Calibration Gate

- [ ] 5.1 `npm run test:smoke` proves every guard family can still fail, including the partition
      findings once 4.2 lands
- [ ] 5.2 Run the Calibration Gate and commit the report it generates for this change
