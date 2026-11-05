# discovery/machine-interfaces Specification

## ADDED Requirements

### Requirement: Every file of the search index is checked against the noindex header

`npm run gate:machine` SHALL check the manifest, every term chunk and every document page of the search index against the built headers file, as it checks the markdown sidecars, and SHALL fail on a file that no `X-Robots-Tag: noindex` rule matches. `HEADER_GUARDED_MACHINE_FILE` in `site/scripts/machine.mjs` names the files, guarded by `site/scripts/machine.test.mjs` under `npm run test`.

#### Scenario: The manifest loses its noindex header

- **WHEN** the built headers file holds no rule that matches `/search-index/manifest.json`
- **THEN** `npm run gate:machine` prints `MACHINE /search-index/manifest.json carries no X-Robots-Tag rule, its siblings carry noindex` and exits 1

### Requirement: The search index lists no hub or entry of a collection that has no live entry

`npm run gate:machine` SHALL read the manifest and the document pages of the search index through `site/scripts/collection-gate.mjs`, and SHALL fail when a page lists the hub or an entry of a collection that has no live entry, as it does for the sitemap and the feeds. Guarded by `site/scripts/collection-gate.test.mjs` under `npm run test`.

#### Scenario: The index lists the hub of an empty collection

- **WHEN** a document page of the search index lists `/case-studies` and the `case` collection has no live entry
- **THEN** `npm run gate:machine` prints `MACHINE /search-index/manifest.json lists /case-studies but /case-studies has no live case entry` and exits 1

## MODIFIED Requirements

### Requirement: The static page list behind the machine files holds exactly the thirteen public pages

`publicIndexableStaticPages` in `site/src/utils/machine-text.mjs`, which feeds the Pages section of `/llms.txt`, the static sidecars, the static sitemap dates and the page entries of the search index, SHALL return exactly `/`, `/about`, `/approach`, `/pricing`, `/faq`, `/contact`, `/blog/tags`, `/ai-policy`, `/security`, `/now`, `/imprint`, `/privacy` and `/terms`, never `/search`, `/styleguide` or `/404`. Guarded by `site/src/utils/machine-text.test.mjs` under `npm run test`.

#### Scenario: A noindex page joins the public list

- **WHEN** `/search` is removed from `NOINDEX_STATIC_PAGES`
- **THEN** `npm run test` fails the test `publicIndexableStaticPages never lists the noindex static pages` with `/search must not be indexable`

#### Scenario: A public page leaves the list

- **WHEN** `/security` is dropped from `STATIC_PAGE_CATALOG`
- **THEN** `npm run test` fails the test `publicIndexableStaticPages covers every public static page of the site`

### Requirement: Every route is owed the surfaces its kind implies, and the gate names each one it lacks

A built route SHALL be classified as exactly one of an entry, a collection hub, a public static page,
a tag index, a taxonomy archive, a pagination page, a declared exception or a withheld route, and
SHALL carry every machine surface that kind is owed. `npm run gate:parity` SHALL fail, naming the
route and the surface, for each owed surface a route lacks, and SHALL print how many routes it derived
and how many owed cells it checked and found present.

#### Scenario: An entry drops out of its search shard

- **WHEN** a built entry has no row of its kind in the document pages the search index manifest names
- **THEN** `npm run gate:parity` prints `PARITY <route> is owed a search entry: /search-index/manifest.json holds no entry for it` and exits 1

#### Scenario: An entry loses its social card

- **WHEN** the card file an entry's `og:image` points at is not in the build, or is not a 1200 by 630 PNG
- **THEN** `npm run gate:parity` names the entry and `a social card` and exits 1

#### Scenario: An entry is not the newest of its collection

- **WHEN** an entry is not the newest of its collection and is absent from the merged feed
- **THEN** `npm run gate:parity` stays silent about it, because only the newest entry of a collection is owed a place in the merged feed

#### Scenario: A hand-written and a generated entry of one collection

- **WHEN** two entries of the same collection are built, one hand-written and one generated
- **THEN** each is owed the same surfaces and a surface missing from either is named

#### Scenario: An entry drops out of its llms shards

- **WHEN** a built entry is listed in no file of its collection under `/llms/`
- **THEN** `npm run gate:parity` prints `PARITY <route> is owed a place in its llms collection file: /llms/<kind>.txt and its shards do not list it` and exits 1

#### Scenario: An entry is outside its collection feed window

- **WHEN** an entry is older than the newest 15 of its collection and is absent from the collection feed
- **THEN** `npm run gate:parity` stays silent about it, because only the entries inside the window are owed a place in the collection feed

#### Scenario: An entry is in no line of llms-full.txt

- **WHEN** a built entry appears in no line of `/llms-full.txt`
- **THEN** `npm run gate:parity` stays silent about it, because `/llms-full.txt` lists collections and no entry
