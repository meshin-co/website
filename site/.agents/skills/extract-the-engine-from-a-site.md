# Extract the Engine from a Site

An engine file is copied to the next site. A site file is not. This skill says how a tracked file gets its class,
what each finding asks of you, what never transfers and how to export. The order of adoption is in `adapt-the-engine-to-a-new-site.md`.

## 1. Run the partition

```
cd site && node scripts/run-partition-gate.mjs
```

Every tracked file is `engine`, `site` or `evidence`. The first entry of `RULES` in
`scripts/engine-partition.mjs` that fits a file decides. Each rule reads a property the file has: where it
lives, whether a script reads it, whether it names a collection entry, whether a generator writes it. No
rule reads a list of paths. `--list` prints every file with its class and rule; `--root <dir>` reads another
tree. The last line gives the three counts and the findings; the exit code is 1 while any remain. `scripts/tracked-files.mjs` lists the files git tracks; in a copy that is not yet a repository the gate prints `not-a-repository` (run `git init && git add -A`) or `nothing-tracked` (run `git add -A`) and exits 1.
`npm run gate:partition` runs in CI. When `site/package.json` carries `--allow site-bound=N`, up to N engine
files that name this site print as `ALLOWED` and the next one fails with all listed; lower N as files are fixed. `scripts/partition-specimens.mjs` plants failures.

`scripts/engine-partition-facts.mjs` reads the facts from the tree: the layout from `site/engine.config.json`,
the collections from `site/src/content.config.ts`, the script directories and `assets:` outputs from
`site/package.json`, the machinery pages from `site/src/utils/machine-text.mjs`. Change one: files change class.

## 2. The three classes

- **engine:** scripts, tests, workflows, skills, specs, shipped source, page templates, endpoints and the
  starters under `seed/`.
- **site:** collection entries, the vocabulary beside them, static pages with copy, served assets, files a
  generator writes, prose no script or skill names, and every file a seed replaces.
- **evidence:** `audits/`, `investigation/`, `openspec/changes/`, screenshots and the captures of external documents. They
  record one site and never travel.

## 3. Findings

`scripts/engine-partition-gate.mjs` prints `PARTITION <rule> <where>: <detail>`.

- `unclassified`: a file fits no rule. Decide its class, then add the rule that derives it, or a seed that
  makes it the site's. Never add a path to a list.
- `site-bound`: an engine file names the brand, the host or the author that `site/src/config.yaml` and
  `site/engine.config.json` name. Move the fact into config or data, or seed the file. Tests and
  `*.fixture.*` files may name a site: they pin behaviour against an invented one. A test that asserts a fact of this site is renamed `*.site.test.mjs`.
- `anchor-unserved`: `scripts/engine-anchors.mjs` expects a file that nothing ships, seeds or measures.
  `scripts/engine-records.mjs` names the measure script of a record. A new site would fail `gate:engine`.
- `facts-unreadable`: a source of facts is missing or malformed.

## 4. Seeds and the export

`seed/<path>.seed` is the starter for `<path>`. The real path belongs to the site, so its class is `site`.
A seed names no site and holds no measured record. A file under `seed/` without the suffix fits no rule.
`npm run export:engine -- <empty directory>` copies every engine file, writes each seed at its target path and
`engine-export.json` (counts, seeds, carried `site-bound` files). It refuses a non-empty target, an `unclassified`
file and an `anchor-unserved` anchor. The copy needs `npm install`, then `npm run assets:logo`, `assets:og-default` and `assets:robots`
before it builds: the build hook reads the crawler register the last one writes, and an absent file ships empty. `npm run gate:export` exports to a temporary directory, builds and commits the copy, and runs its own gates and `npm test` (93 s). `.githooks/pre-push` runs it on every push, with no path list; `localOnlyGates` records why.

## 5. Defaults that decide a file nobody named

- A document under `docs/` is engine only when a script, workflow, hook, rule or skill (one not marked `.site`) names its path and it names no site; every other document is site prose.
- A static page missing from `NOINDEX_STATIC_PAGES` is site copy, even when it is a collection hub; its catalogue entry is in `site/src/data/static-pages.mjs`, which the export seeds.
- A skill that cites a site or evidence path dangles in a copy, and `gate:skills` reports it. Cite the command
  that writes a record instead of the record, or seed the file the skill needs.
- A file named `<name>.site.<ext>` (`topic-core.site.test.mjs`, `navigate-the-plan.site.md`) is its author's declaration that it belongs to one site: rule `site-marked`, never exported.

## 6. What does not transfer

A second site inherits the method, not the verdicts.

- The Cloudflare account, token, DNS zone and Pages project (`CLOUDFLARE_PAGES_PROJECT`).
- The domain, the `www` choice and `site.site` in `site/src/config.yaml`.
- The Search Console property (`demand.property`) and the service account behind `GSC_SERVICE_ACCOUNT_JSON`.
- Anything priced per vendor: the model vendor in `scripts/writer-config.mjs`, its rates and `loop.monthlySpendCeilingUsd`.
- The byte budgets in `site/budgets.json` and the Lighthouse assertions in `site/lighthouserc.cjs`. One
  site's pages set them. Measure yours, then change them.
- Every record under `audits/`. The measured ones are the sharp case: `bandFor` and `lengthFor` throw when
  `audits/sentence-band.json` or `audits/entry-length.json` is absent, and `gate:autowriter` reports
  `record-corpus-stale` for a band measured on another corpus. Measure with `node scripts/measure-sentence-band.mjs --write`
  and `node scripts/measure-entry-length.mjs --write`; `gate:autowriter` also wants `npm run audit:spend` run once.
- The demand report is dated. One older than `demand.maxAgeDays` is too old to choose a topic from.
- The locked decisions L1 to L67 in `docs/plan/reference/locked-decisions.md`: they record why one site is
  the way it is.
