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
- [ ] 1.6 Resolve the 2 `unclassified` and the 9 `anchor-unserved` findings with seeds
      (`seed/<path>.seed`): `AGENTS.md`, `site/src/config.yaml`, `docs/SEMANTIC-CORE.md`,
      `audits/routes.json`, `audits/search-demand.md` with every prompt unproven,
      `site/src/data/tags.mjs`, and one example entry for the term, article and resource collections
- [ ] 1.7 Resolve the 37 `site-bound` findings: prose in skills, specs and workflows names the site;
      five scripts hardcode it (`external-links`, `links-gate`, `geo-probe`, `escalate-channels`,
      `pr-github`); `jsonld`, `booking`, `navigation`, `machine-text`, `styleguide` and the search
      index hold its identity in engine code; `package.json`, `.env.example`, `README.md`,
      `content-facts.json` and `engine.config.json` name it
- [ ] 1.8 Decide what ships for the 57 site and evidence paths that engine skills cite, and for the
      collection hub pages, which the rules class as site copy although their markup is engine
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

- [ ] 2.1 An export command writes every engine file, and every seed at its target path, into an
      empty directory; it refuses a non-empty target and a tree whose partition has findings
- [ ] 2.2 Adopt the export in a scratch directory for an invented second site: fill
      `engine.config.json`, create the anchor files, install, build, run every gate that needs no
      secret; quote the stdout
- [ ] 2.3 Justify each starter file. A band or a length floor copied from this site is a measurement
      of a corpus the new site lacks, so the export ships none; the new site measures its own with
      `node scripts/measure-sentence-band.mjs --write` before its first automated article
- [ ] 2.4 `npm test` in the adopted copy: list every engine test that reads data only this site has

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

- [ ] 4.1 `npm run gate:partition`, in `ci.yml` and the skill that names it, once 1.6 to 1.8 leave
      zero findings
- [ ] 4.2 A planted specimen and a `mutation-smoke.mjs` row for each finding, and for an export that
      no longer builds
- [ ] 4.3 Decide whether the export proof runs in the gate, in the pre-push hook or on demand, and
      record the decision beside `localOnlyGates` in `site/package.json`
- [ ] 4.4 A finding for an interview that misses a config value or a workflow secret

## 5. Calibration Gate

- [ ] 5.1 `npm run test:smoke` proves every guard family can still fail, including the partition
      findings once 4.2 lands
- [ ] 5.2 Run the Calibration Gate and commit the report it generates for this change
