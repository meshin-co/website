# Adapt the Engine to a New Site

The writing engine is the set of scripts, workflows and skills that choose a topic, write an entry,
judge it and merge it (locked row L62). A second site can run it. This skill is the order of work.

## 1. Run the self-check

```
cd site && npm run gate:engine
```

`scripts/check-engine.mjs` prints `ENGINE <rule> <where>: <detail>` for every missing piece and exits 1
until none is left. A `config-value-unset` line names a value and says what it means. A
`config-invalid` line reads `<field>: <problem> in site/engine.config.json; <description>`. An
`anchor-missing` line names a file and says what reads it. Start from a copy of the engine and read
the list from the top. `--root <dir>` checks another tree. CI runs it in the `types-and-units` job,
after `gate:autowriter`.

## 2. Set the values in one file

`site/engine.config.json` holds every site-specific value the engine reads. Each field is required and
has no default. `scripts/engine-config.mjs` loads it and checks it against
`scripts/engine-config.schema.json` (the rules the schema cannot say are in
`scripts/engine-config-checks.mjs`); a mistake names the field and the file. Sections:

- `diff`: which paths are prose, shipped build, automation or test files.
- `routeFamilies`: route prefix to title family and content-gate profile, longest prefix first.
- `content`: the data directory, the term, article and resource collections, their route prefixes, the author.
- `loop`: attempt cap, quarantine hours, monthly spend ceiling, claim lifetime, hold label.
- `demand`: Search Console window, data lag, maximum report age, impression floor, position band.

## 3. Create the anchor files

`scripts/engine-anchors.mjs` lists them. A file that is absent stops the writer, so create each.

- **Law and copy rules:** `AGENTS.md`, `docs/SEMANTIC-CORE.md`, `docs/CONTENT-GATE.md`. The writer prompt
  quotes them; the selector reads the concept register.
- **Audit records:** `audits/routes.json`, `audits/search-demand.md`, `audits/sentence-band.json`.
- **Word lists:** `site/banned-phrases.json`, `site/content-facts.json`, `site/controlled-words.json`.
- **Site files:** `site/package.json`, `site/.nvmrc`, `site/src/config.yaml`, `site/src/content.config.ts`
  and the directory `site/.agents/skills`.
- **Workflows:** `.github/workflows/ci.yml`, `.github/workflows/watch-pr.yml`,
  `.github/workflows/write-daily.yml`.
- **From `content`:** the tag list in the data directory (here `site/src/data/tags.mjs`) and one
  directory per collection (here `site/src/data/glossary`, `site/src/data/post`, `site/src/data/resource`).

## 4. Keep one diff classifier

`scripts/build-surface.mjs` is the only place a path becomes prose, tooling or build. `ci.yml` calls it
through `scripts/run-classify-diff.mjs` (`scripts/classify-diff.mjs` is the logic). Never re-express that
rule in a workflow or a script. A path it cannot classify draws the full job graph. `scripts/classify-wiring.mjs`
makes `gate:engine` fail when the `changes` job stops calling it.

## 5. What is not in the config

A second site changes these in code, or accepts them. Each has a reason it can wait.

- The pages with no graph or no content gate: `GRAPH_EXEMPT` in `scripts/jsonld-gate.mjs`, `UNGATED` in `scripts/content-gate.mjs`.
- The JSON-LD type per route pattern, in `scripts/jsonld-gate.mjs`; the blog page patterns in `scripts/human-gate.mjs`.
- The non-public collections and the feed floor: `NON_PUBLIC`, `FEED_FLOOR` in `scripts/machine.mjs`.
- The GitHub organisation in `scripts/links-gate.mjs`; the own host in `scripts/external-links.mjs`.
- The collection names in `scripts/repair-scope.mjs`; the glossary paths in `scripts/generate-gaps.mjs` and
  `scripts/generate-registers.mjs`.
- The prompt sources `PROMPT_SOURCES` in `scripts/writer-prompt.mjs`; the forbidden claims in `scripts/check-skills.mjs`.
- The model vendor in `scripts/writer-config.mjs`. Model name and rates come from the environment.
- The Search Console property is the `GSC_PROPERTY` environment variable, never a committed value.
- The brand reads `site/src/config.yaml` through `site/scripts/site-brand.mjs`: set `site.name` there.

## 6. Prove it

1. `npm run gate:engine` reports `engine: 0 findings`.
2. `npm run gate:plan`, `gate:docs`, `gate:skills` and `gate:spec` pass.
3. `npm test` passes. `scripts/engine-specimens.mjs` plants a removed value, a removed anchor file and a
   re-expressed classifier, and `npm run test:smoke` proves `gate:engine` still fails on each.

Two steps stay with the owner: branch protection on `main` (require the check
`all required jobs passed`), and the Lighthouse measurement record from `npm run gate:lh` (L59).
