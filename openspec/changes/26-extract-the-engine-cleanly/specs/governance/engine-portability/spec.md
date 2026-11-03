# governance/engine-portability Specification

## ADDED Requirements

### Requirement: Every tracked file has one class, derived from a property it has

The engine SHALL give every tracked file exactly one of three classes, engine, site or evidence,
using an ordered list of rules that each read a property of the file: where it lives, whether a
script reads it, whether it names a collection entry, whether a generator writes it, whether the
engine ships a seed for it. The rules SHALL NOT read a list of paths. A file that fits no rule
SHALL be reported as a finding and SHALL NOT receive a default class.

#### Scenario: A file fits no rule

- **WHEN** a tracked file matches no rule
- **THEN** `node scripts/run-partition-gate.mjs` prints `PARTITION unclassified <path>`, names what to
  decide, and exits 1

#### Scenario: A collection entry is added

- **WHEN** a markdown file is added under a directory that `site/src/content.config.ts` exports as a
  collection
- **THEN** the partition classes it as site without any change to a rule

#### Scenario: A seed claims a file

- **WHEN** the engine holds `seed/<path>.seed`
- **THEN** `<path>` is classed as site, and the seed itself is classed as engine

### Requirement: A file can declare that it belongs to one site

A file whose name carries `.site` before its extension, such as `topic-core.site.test.mjs` or
`navigate-the-plan.site.md`, SHALL be classed site, whatever else it is, and the export SHALL leave it out.
The marker is its author's declaration that the file pins or describes one site. The same name without
the marker keeps the class its other properties give it.

#### Scenario: A test pins this site's content

- **WHEN** a test that asserts a fact of one site is named `<name>.site.test.mjs`
- **THEN** the partition classes it as site by the rule `site-marked`, and `npm run export:engine` does not
  write it

#### Scenario: The same name without the marker

- **WHEN** a test is named `<name>.test.mjs`
- **THEN** the partition classes it as engine by the rule `test`, and a copy of the engine runs it

### Requirement: An engine file names no site

An engine file, except a test or a file of fixture data, SHALL NOT contain the site name, the host
or the author name that the site configuration holds. A term shorter than four letters SHALL NOT
count.

#### Scenario: A skill names the host

- **WHEN** an engine skill contains the host from `site/src/config.yaml`
- **THEN** the run prints `PARTITION site-bound <path>` with the term, and exits 1

#### Scenario: A test names the site

- **WHEN** a test file contains the same host
- **THEN** the run reports no finding for it, because a test pins behaviour against an invented site

#### Scenario: A new engine file names the site

- **WHEN** the run is given `--allow site-bound=<n>` and more than `<n>` engine files name the site
- **THEN** every one of them prints as `PARTITION site-bound`, a `PARTITION site-bound-ceiling` line says that a new
  engine file names the site, and the run exits 1

#### Scenario: Fewer files name the site than the ceiling allows

- **WHEN** fewer than `<n>` engine files name the site
- **THEN** they print as `ALLOWED`, the run exits 0, and a `NOTE` line gives the number to lower the ceiling to

### Requirement: Every file the engine expects is served

Each file or directory that `scripts/engine-anchors.mjs` expects SHALL be shipped as engine, provided
by a seed, written by a generator, or produced by a measure script. Otherwise the partition SHALL
report it.

#### Scenario: An anchor has no server

- **WHEN** an anchor file is a site file and no seed holds a starter for it
- **THEN** the run prints `PARTITION anchor-unserved <path>` and exits 1

#### Scenario: A record has a measure script

- **WHEN** an anchor is an audit record and `scripts/measure-<record>.mjs` is tracked
- **THEN** the record counts as produced, and the run reports no finding for it

### Requirement: Engine source holds no copy of a site's pages

The modules the export ships SHALL NOT hold the titles, descriptions or dates of a site's static pages or
collection hubs. They SHALL read them from `site/src/data/static-pages.mjs`, a site data file that the
export seeds with starter values. A copy of the engine SHALL build, without an edit of any file the
partition classes as engine, once its owner has filled the configuration and the data files.

#### Scenario: The export builds as exported

- **WHEN** the engine is exported into an empty directory and only the configuration and the data files are
  filled for a second site
- **THEN** `npm run build` succeeds there, and `git diff` shows no change to a file the partition classes as
  engine

#### Scenario: A site adds a static page

- **WHEN** a site adds a static page
- **THEN** its entry is added to `site/src/data/static-pages.mjs`, and no engine module changes

### Requirement: A document an engine file names travels once it names no site

A document under `docs/` that a script, a workflow, a hook or an agent rule names SHALL be classed engine
when it names neither the site name, the host nor the author. A document that names one of them SHALL be
classed site.

#### Scenario: The calibration procedure names no site

- **WHEN** `docs/plan/reference/calibration-gate.md` names no term of the site identity and
  `.omp/rules/openspec.md` names it
- **THEN** the partition classes it engine, and the export ships it

### Requirement: The interview names everything the engine needs from its owner

The interview bank SHALL name every leaf value of `site/engine.config.json` by its dotted path, every secret
and every variable that a workflow reads except `GITHUB_TOKEN`, and every variable of `site/.env.example`.
`npm run gate:engine` SHALL report each name the bank does not contain.

#### Scenario: A config value has no question

- **WHEN** a leaf value is added to `site/engine.config.json` and the bank does not name its path
- **THEN** `gate:engine` prints `ENGINE interview-gap <path>: config value` and exits 1

#### Scenario: A workflow reads a new secret

- **WHEN** a workflow reads `secrets.NEW_TOKEN` and the bank does not name it
- **THEN** `gate:engine` prints `ENGINE interview-gap NEW_TOKEN: workflow secret` and exits 1

#### Scenario: A name is only a prefix of a longer one

- **WHEN** the bank names `AUTOWRITER_PAT_OLD` and a workflow reads `AUTOWRITER_PAT`
- **THEN** `AUTOWRITER_PAT` counts as missing, because a name is covered only as a whole word

### Requirement: A citation of a file the engine writes does not dangle

A skill or a document SHALL be allowed to cite a path that does not exist when a script in `site/scripts`,
a workflow, `site/playwright.config.ts`, `site/lighthouserc.cjs` or `site/package.json` names that path,
because a copy has not yet run what writes it. A test file, a specimen catalogue and a document SHALL NOT
count as naming it. A citation of a missing path that nothing in the engine names SHALL remain a finding.

#### Scenario: A record that a script writes

- **WHEN** a skill cites `audits/geo-baseline.md`, which `scripts/generate-geo-baseline.mjs` writes, and the
  file does not exist yet
- **THEN** `gate:skills` and `gate:docs` report no finding for it

#### Scenario: A path that only a document or a test names

- **WHEN** a skill cites a missing path that only another document or a `*.test.mjs` file names
- **THEN** the gates report `missing-path` or `dead-path`
