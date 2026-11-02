# Extract the Engine from a Site

An engine file is copied to the next site. A site file is not. This skill says how a tracked file gets
its class, what each finding asks of you, and what never transfers. The adoption order is in
`adapt-the-engine-to-a-new-site.md`.

## 1. Run the partition

```
cd site && node scripts/run-partition-gate.mjs
```

Every tracked file is `engine`, `site` or `evidence`. The first entry of `RULES` in
`scripts/engine-partition.mjs` that fits a file decides. Each rule reads a property the file has: where it
lives, whether a script reads it, whether it names a collection entry, whether a generator writes it. No
rule reads a list of paths. `--list` prints every file with its class and rule. `--root <dir>` reads
another tree. The last line gives the three counts and the findings; the exit code is 1 while any remain.

`scripts/engine-partition-facts.mjs` takes the facts from the tree: the layout from
`site/engine.config.json`, the collections from `site/src/content.config.ts`, the script directories and
the files the `assets:` scripts write from `site/package.json`, and the pages served as machinery from
`site/src/utils/machine-text.mjs`. Change one of them and files change class on purpose.

## 2. The three classes

- **engine:** scripts, tests, workflows, skills, specs, shipped source, page templates, endpoints and the
  starters under `seed/`.
- **site:** collection entries, the vocabulary beside them, static pages with copy, served assets, files a
  generator writes, prose no script names, and every file a seed replaces.
- **evidence:** `audits/`, `investigation/`, `openspec/changes/`, screenshots and `docs/sources/`. They
  record one site and never travel.

## 3. Findings

`scripts/engine-partition-gate.mjs` prints `PARTITION <rule> <where>: <detail>`.

- `unclassified`: a file fits no rule. Decide its class, then add the rule that derives it, or a seed that
  makes it the site's. Never add a path to a list.
- `site-bound`: an engine file names the brand, the host or the author that `site/src/config.yaml` and
  `site/engine.config.json` name. Move the fact into config or data, or seed the file. Tests and
  `*.fixture.*` files may name a site: they pin behaviour against an invented one.
- `anchor-unserved`: `scripts/engine-anchors.mjs` expects a file that nothing ships, seeds or measures.
  `scripts/engine-records.mjs` names the measure script of a record. A new site would fail `gate:engine`.
- `facts-unreadable`: a source of facts is missing or malformed.

## 4. Seeds

`seed/<path>.seed` is the starter for `<path>`. The real path belongs to the site, so its class is `site`.
A seed names no site. A file under `seed/` without the suffix fits no rule.

## 5. Defaults that decide a file nobody named

- A document under `docs/` is engine only when a script, workflow, hook or rule names its path and it names
  no site. Every other document is site prose.
- A static page missing from `NOINDEX_STATIC_PAGES` is site copy, even when it is a collection hub.
- A skill may cite a site or evidence path. In a new repository the path dangles and `gate:skills`
  reports it, so seed the file or stop citing it.

## 6. What does not transfer

A second site inherits the method, not the verdicts.

- The Cloudflare account, token, DNS zone and Pages project (`CLOUDFLARE_PAGES_PROJECT`).
- The domain, the `www` choice and `site.site` in `site/src/config.yaml`.
- The Search Console property (`demand.property`) and the service account behind `GSC_SERVICE_ACCOUNT_JSON`.
- Anything priced per vendor: the model vendor in `scripts/writer-config.mjs`, its rates and
  `loop.monthlySpendCeilingUsd`.
- The byte budgets in `site/budgets.json` and the Lighthouse assertions in `site/lighthouserc.cjs`. One
  site's pages set them. Measure yours, then change them.
- Every record under `audits/`. The sentence band is the sharp case: `bandFor` in
  `scripts/sentence-band.mjs` throws when `audits/sentence-band.json` is absent, and `gate:autowriter`
  reports `record-corpus-stale` for a band measured on another corpus. Measure with
  `node scripts/measure-sentence-band.mjs --write`.
- The demand report is dated. One older than `demand.maxAgeDays` is too old to choose a topic from.
- The locked decisions L1 to L67 in `docs/plan/reference/locked-decisions.md`: they record why one site is
  the way it is.
