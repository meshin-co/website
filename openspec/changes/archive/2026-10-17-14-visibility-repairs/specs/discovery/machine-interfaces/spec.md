# discovery/machine-interfaces Specification

## RENAMED Requirements

- FROM: `### Requirement: llms.txt lists every indexable route of the build`
- TO: `### Requirement: Every indexable route is listed in llms.txt or in a collection file`
- FROM: `### Requirement: Every populated collection reaches llms.txt, feed.json and the sitemap`
- TO: `### Requirement: Every populated collection reaches feed.json and the sitemap`

## REMOVED Requirements

### Requirement: Every live collection entry is listed in llms.txt, llms-full.txt and its collection file

**Reason**: `/llms.txt` no longer lists the entries of an unbounded collection, so "listed in llms.txt" is false by design. The guarantee is kept by the two requirements added below: entries are in `/llms-full.txt` and in the collection files, and every live entry is reachable from `/llms.txt` in two further fetches.

## MODIFIED Requirements

### Requirement: Every indexable route is listed in llms.txt or in a collection file

Every built route whose page carries no `noindex` robots meta SHALL appear in `/llms.txt` or in a file under `/llms/`, on a line that opens with a link to it or holds only its URL. Archives under a collection hub (`/<base>/category/`, `/<base>/tag/`, `/<base>/tags`, `/<base>/page/`) are reached through that hub and are exempt. `npm run gate:machine` enforces this against every built page.

#### Scenario: A static page is missing from llms.txt

- **WHEN** the `/security` line is removed from `/llms.txt`
- **THEN** `npm run gate:machine` prints `MACHINE llms.txt and /llms/ are missing indexable route /security` and exits 1

### Requirement: Every populated collection reaches feed.json and the sitemap

For every public collection with at least one live entry, `/feed.json` and `/sitemap-0.xml` SHALL each contain a URL path under that collection's base. A collection with no live entry is named on stdout and skipped, and a build in which no collection has a live entry fails instead of passing on nothing. `npm run gate:machine` enforces this; `/llms.txt` is held to the pointer rules below instead.

#### Scenario: feed.json covers no FAQ entry

- **WHEN** `/feed.json` holds no URL under `/faq/`
- **THEN** `npm run gate:machine` prints `MACHINE feed.json covers no faq entry` and exits 1

#### Scenario: No collection has a live entry

- **WHEN** every collection leaf page of the build carries a `noindex` robots meta
- **THEN** `npm run gate:machine` prints `MACHINE no public collection has a live entry, so generator coverage was not checked` and exits 1

### Requirement: Machine files carry an X-Robots-Tag noindex header and HTML pages never do

The headers file that `site/scripts/gen-headers.mjs` writes into the build SHALL send `X-Robots-Tag: noindex` for `/rss.xml`, `/*/rss.xml`, `/feed.json`, `/llms.txt`, `/llms-full.txt`, `/llms/*`, `/search-index*` and `/*.md`, and its site-wide `/*` block, which covers every HTML page, SHALL NOT send it. Guarded by `site/scripts/gen-headers.test.mjs` under `npm run test`; `npm run gate:machine` also checks every shipped machine file against the built headers file.

#### Scenario: A machine file loses its noindex header

- **WHEN** `renderHeaders` drops the `/llms/*` rule
- **THEN** `npm run test` fails the test `machine surfaces carry X-Robots-Tag: noindex` with `/llms/* misses X-Robots-Tag`

#### Scenario: A built machine file has no matching rule

- **WHEN** the built headers file gives `/llms/*` the value `all`
- **THEN** `npm run gate:machine` prints `MACHINE /llms/faq.txt carries X-Robots-Tag "all", its siblings carry noindex` and exits 1

#### Scenario: HTML pages get the noindex header

- **WHEN** the site-wide `/*` block gains `X-Robots-Tag: noindex`
- **THEN** `npm run test` fails the test `html pages never receive X-Robots-Tag`

## ADDED Requirements

### Requirement: Every live collection entry is in llms-full.txt and in its collection file

For each public collection with at least one live entry, meaning every collection in `site/src/content.config.ts` except `author` and `speaking`, every live entry SHALL appear in `/llms-full.txt` and in `/llms/<collection>.txt`, or in that collection's shards, on a line that opens with a link to it or holds only its URL. A live entry is a built `/<base>/<slug>` page with no `noindex` robots meta. `npm run gate:machine` enforces this.

#### Scenario: An entry is missing from llms-full.txt

- **WHEN** the URL line of `/glossary/evals` is removed from `/llms-full.txt`
- **THEN** `npm run gate:machine` prints `MACHINE llms-full.txt omits /glossary/evals` and exits 1

#### Scenario: An entry is missing from its collection file

- **WHEN** the URL line of `/glossary/evals` is removed from `/llms/glossary.txt`
- **THEN** `npm run gate:machine` prints `MACHINE /llms/glossary.txt omits /glossary/evals` and exits 1

#### Scenario: A collection file was not built

- **WHEN** the build holds live FAQ entries and no `/llms/faq.txt`
- **THEN** `npm run gate:machine` prints `MACHINE no /llms/faq.txt full-text file` and exits 1

### Requirement: llms.txt inlines what is bounded and points at what is unbounded

`/llms.txt` SHALL list the offers, the static pages, the hubs and the feeds inline, and SHALL carry one line for each collection that has a live entry, holding its name, its entry count and a link to `/llms/<collection>.txt`. Entries of any other collection appearing inline fail `npm run gate:machine`, which compares them with `llmsInlinedRoutes` in `site/scripts/machine.mjs`.

#### Scenario: A blog post is listed inline

- **WHEN** `/llms.txt` gains a line linking `https://meshin.co/blog/a-post`
- **THEN** `npm run gate:machine` prints `MACHINE llms.txt lists /blog/a-post inline, entries of an unbounded collection belong in /llms/` and exits 1

### Requirement: llms.txt stays under 8192 bytes

`/llms.txt` SHALL stay at or under `LLMS_TXT_MAX_BYTES`, 8192 bytes, in `site/scripts/machine.mjs`. It measured 5815 bytes on 2026-10-17; filling the case-study lines adds about 450, so 8 KiB leaves 30% over that worst case and a change that needs more is a deliberate decision. Enforced by `npm run gate:machine`.

#### Scenario: llms.txt outgrows its budget

- **WHEN** `/llms.txt` grows to 9000 bytes
- **THEN** `npm run gate:machine` prints `MACHINE llms.txt is 9000 bytes, over the 8192 byte guard` and exits 1

### Requirement: A collection file holds at most 100 entries and shards beyond that

`LLMS_SHARD_MAX_ENTRIES` in `site/src/utils/llms-collections.mjs` SHALL be 100. At or under it, `/llms/<collection>.txt` holds the entries. Above it, that file is an index of `/llms/<collection>-<n>.txt` shards, numbered from 1, each listed with its range and count, and each shard ends with a link to the next or says it is the last. Guarded by `site/src/utils/llms-collections.test.mjs` under `npm run test`.

#### Scenario: A collection has 101 entries

- **WHEN** a collection holds 101 live entries
- **THEN** `npm run test` passes the test `one entry over the cap makes an index and two shards named post-1 and post-2`, and a collection of exactly 100 stays one file

### Requirement: Every shard is a shipped machine file, noindex and referenced

Each `/llms/*.txt` file, shard or not, SHALL match a `noindex` rule in the built headers file and SHALL be reachable by links from a built page or from `/llms.txt`, directly or through another machine file. `npm run gate:machine` enforces this, so a shard no index lists fails it.

#### Scenario: A shard no index lists ships

- **WHEN** the build holds `/llms/post-1.txt` and `/llms/post.txt` does not list it
- **THEN** `npm run gate:machine` prints `MACHINE /llms/post-1.txt ships but the post index does not list it` and exits 1

### Requirement: The llms files describe the build they came from

The count on a collection's line in `/llms.txt` SHALL equal the entries its files hold, each shard SHALL hold the range the index gives it, no entry SHALL ship twice, and the last shard SHALL be the last. Every live entry is then reachable from `/llms.txt` in two further fetches. `npm run gate:machine` enforces this through `llmsCorpusGaps` in `site/scripts/llms-corpus.mjs`.

#### Scenario: A count drifts from the shipped entries

- **WHEN** the `/llms.txt` line for `/llms/post.txt` says 9 entries and the files hold 8
- **THEN** `npm run gate:machine` prints `MACHINE llms.txt says 9 entries for post, its files hold 8` and exits 1

### Requirement: The llms files are byte-identical across builds and ordered by a total key

Entries SHALL be ordered by publish date ascending, then by id ascending, a total order, and no generator SHALL read a clock. A second `npm run build` of an unchanged tree SHALL write byte-identical `/llms.txt`, `/llms-full.txt` and `/llms/*.txt`. A newer entry lands last, so earlier shards stay unchanged and only the old last shard and the index move; a back-dated entry shifts every later shard. Guarded by `site/src/utils/llms-collections.test.mjs`.

#### Scenario: A second build

- **WHEN** the generator runs a second time over the same entries, a day later and in reversed input order
- **THEN** `npm run test` passes the tests `the generator reads no clock: a second run a day later is byte-identical` and `generating twice from one fixture is byte-identical for every file, in any input order`
