# discovery/machine-interfaces Specification

## Purpose

Governs the files the site publishes for crawlers, answer engines and feed readers: the llms text files, the markdown sidecars, the RSS and JSON feeds, the sitemap, robots.txt, humans.txt, the canonical URL of every page, the noindex header on machine files and the social cards. Each rule is checked in the built output by `npm run gate:machine`, which prints every finding as a `MACHINE` line and exits 1, or in a unit test of the code that writes the file.

## Requirements

### Requirement: Every indexable route is listed in llms.txt or in a collection file

Every built route whose page carries no `noindex` robots meta SHALL appear in `/llms.txt` or in a file under `/llms/`, on a line that opens with a link to it or holds only its URL. Archives under a collection hub (`/<base>/category/`, `/<base>/tag/`, `/<base>/tags`, `/<base>/page/`) are reached through that hub and are exempt. `npm run gate:machine` enforces this against every built page.

#### Scenario: A static page is missing from llms.txt

- **WHEN** the `/security` line is removed from `/llms.txt`
- **THEN** `npm run gate:machine` prints `MACHINE llms.txt and /llms/ are missing indexable route /security` and exits 1

### Requirement: The static page list behind the machine files holds exactly the thirteen public pages

`publicIndexableStaticPages` in `site/src/utils/machine-text.mjs`, which feeds the Pages section of `/llms.txt`, the static sidecars, the static sitemap dates and the page search shard, SHALL return exactly `/`, `/about`, `/approach`, `/pricing`, `/faq`, `/contact`, `/blog/tags`, `/ai-policy`, `/security`, `/now`, `/imprint`, `/privacy` and `/terms`, never `/search`, `/styleguide` or `/404`. Guarded by `site/src/utils/machine-text.test.mjs` under `npm run test`.

#### Scenario: A noindex page joins the public list

- **WHEN** `/search` is removed from `NOINDEX_STATIC_PAGES`
- **THEN** `npm run test` fails the test `publicIndexableStaticPages never lists the noindex static pages` with `/search must not be indexable`

#### Scenario: A public page leaves the list

- **WHEN** `/security` is dropped from `STATIC_PAGE_CATALOG`
- **THEN** `npm run test` fails the test `publicIndexableStaticPages covers every public static page of the site`

### Requirement: llms.txt entry lines carry their link and, when dated, an ISO update date

`renderLlmsTxt` in `site/src/utils/machine-text.mjs` SHALL write each entry as `- [title](url): description`, with ` (updated <ISO instant>)` between the link and the colon when the entry is dated and nothing there when it is not, keep sections in the order given and leave out a section with no entries. Guarded by `site/src/utils/machine-text.test.mjs` under `npm run test`.

#### Scenario: A dated entry loses its date

- **WHEN** `renderLlmsTxt` writes a dated entry without its `(updated …)` part
- **THEN** `npm run test` fails the test `renderLlmsTxt appends the ISO updatedDate to a dated entry line`

### Requirement: Draft and noindex entries never reach llms-full.txt, the collection files or the feeds

`renderLlmsCollection`, `renderLlmsFull` and `buildFeedItems` in `site/src/utils/machine-text.mjs` SHALL drop every entry marked `draft` or `noindex`, and `collectionFeedItems` in `site/src/utils/feed-items.mjs` SHALL drop every `noindex` entry. Guarded by `site/src/utils/machine-text.test.mjs` and `site/src/utils/feed-items.test.mjs` under `npm run test`.

#### Scenario: A draft reaches the feed items

- **WHEN** `buildFeedItems` keeps an entry marked `draft: true`
- **THEN** `npm run test` fails the test `buildFeedItems never emits a draft or noindex entry`

#### Scenario: A noindex entry reaches a collection file

- **WHEN** `renderLlmsCollection` keeps an entry marked `noindex: true`
- **THEN** `npm run test` fails the test `renderLlmsCollection never emits a draft or noindex entry`

### Requirement: Every entry, public static page and hub ships a complete markdown sidecar

Every built collection leaf route, every public static page and every collection hub SHALL have a `.md` sidecar at its own path, `/index.md` for `/`. Each sidecar SHALL carry a `# ` title, a `Source:` line equal to the page's absolute URL, an `Updated: YYYY-MM-DD` line and a non-empty body after the `---` divider. `npm run gate:machine` enforces both.

#### Scenario: A page has no sidecar

- **WHEN** the build holds no `/about.md`
- **THEN** `npm run gate:machine` prints `MACHINE no markdown sidecar for /about.md` and exits 1

#### Scenario: A sidecar has an empty body

- **WHEN** `/about.md` keeps its head lines but loses everything after the `---` divider
- **THEN** `npm run gate:machine` prints `MACHINE sidecar for /about body is empty` and exits 1

#### Scenario: A sidecar names another page as its source

- **WHEN** the `Source:` line of `/about.md` reads `https://meshin.co/wrong-page`
- **THEN** `npm run gate:machine` prints `MACHINE sidecar for /about canonical is https://meshin.co/wrong-page, expected https://meshin.co/about` and exits 1

### Requirement: The merged feed carries at least five entries of each collection, or all of a smaller one

`/rss.xml` SHALL carry at least the smaller of 5 and N items of each public collection, where N is that collection's number of live entries. `npm run gate:machine` enforces the floor; `mergeWithKindFloor` in `site/src/utils/machine-text.mjs` makes the selection and is guarded by `site/src/utils/machine-text.test.mjs`.

#### Scenario: A collection falls under its floor

- **WHEN** every FAQ item is removed from `/rss.xml` and `/feed.json`
- **THEN** `npm run gate:machine` prints `MACHINE merged rss.xml carries 0 faq entries, floor is 5` and exits 1

### Requirement: feed.json mirrors rss.xml item for item

`/feed.json` SHALL list the same item URLs as `/rss.xml`, in the same order and the same number. `npm run gate:machine` enforces this, and the `machine-feed-coverage` family of `npm run test:smoke` plants a `/feed.json` missing its last item and requires that failure.

#### Scenario: feed.json loses an item

- **WHEN** the last item is removed from `/feed.json`
- **THEN** `npm run gate:machine` prints `MACHINE feed.json does not mirror rss.xml item-for-item` and exits 1

### Requirement: Every populated collection reaches feed.json and the sitemap

For every public collection with at least one live entry, `/feed.json` and `/sitemap-0.xml` SHALL each contain a URL path under that collection's base. A collection with no live entry is named on stdout and skipped, and a build in which no collection has a live entry fails instead of passing on nothing. `npm run gate:machine` enforces this; `/llms.txt` is held to the pointer rules below instead.

#### Scenario: feed.json covers no FAQ entry

- **WHEN** `/feed.json` holds no URL under `/faq/`
- **THEN** `npm run gate:machine` prints `MACHINE feed.json covers no faq entry` and exits 1

#### Scenario: No collection has a live entry

- **WHEN** every collection leaf page of the build carries a `noindex` robots meta
- **THEN** `npm run gate:machine` prints `MACHINE no public collection has a live entry, so generator coverage was not checked` and exits 1

### Requirement: Each collection hub advertises its own collection feed

Each collection hub, `/blog`, `/services`, `/resources`, `/glossary`, `/case-studies` and `/faq`, SHALL carry a `<link rel="alternate">` whose `href` is its own `/<base>/rss.xml`; a link to the merged `/rss.xml` alone does not count. `npm run gate:machine` enforces this.

#### Scenario: A hub advertises only the merged feed

- **WHEN** `/glossary` loses its link to `/glossary/rss.xml`
- **THEN** `npm run gate:machine` prints `MACHINE /glossary does not advertise its own collection feed <link>` and exits 1

### Requirement: The sitemap never lists a noindex route

`/sitemap-0.xml` SHALL carry no `<loc>` for a built route whose page has a `noindex` robots meta, such as `/search`, `/styleguide` or `/404`. `npm run gate:machine` enforces this after reading the robots meta of every built page.

#### Scenario: A noindex page leaks into the sitemap

- **WHEN** `/sitemap-0.xml` gains `<loc>https://meshin.co/search</loc>`
- **THEN** `npm run gate:machine` prints `MACHINE sitemap lists noindex route /search` and exits 1

### Requirement: Every dated live route carries a lastmod in the sitemap

Every live route that `siteLastmods` in `site/src/utils/sitemap-lastmod.mjs` dates SHALL appear in `/sitemap-0.xml` with a `<lastmod>`: each live content entry, each collection hub dated by its newest live entry, each category and tag archive of a live post, `/blog/tags` and each public static page, dated by its row in `site/src/utils/machine-text.mjs`, never by git history or the build clock. `npm run gate:machine` enforces this and asks that same helper which routes to expect.

#### Scenario: A route loses its lastmod

- **WHEN** the `/about` entry of `/sitemap-0.xml` loses its `<lastmod>`
- **THEN** `npm run gate:machine` prints `MACHINE sitemap has no lastmod for /about` and exits 1

#### Scenario: A public static page has no editorial date

- **WHEN** a public static page is added to `STATIC_PAGE_CATALOG` with no `updatedDate`
- **THEN** `npm run build` stops with `static page /<path> carries no updatedDate` instead of dating it by the commit the build ran in, and `npm run test` fails the test `siteLastmods refuses a static page that neither a collection nor the catalog dates` if that refusal is removed

### Requirement: Every page declares its own bare URL as canonical and og:url

Every built route SHALL carry a `<link rel="canonical">` and a `<meta property="og:url">` equal to its bare absolute URL: `https://meshin.co` for `/`, otherwise the origin plus the route with no trailing slash and no `.html`. `npm run gate:machine` enforces this, and the `canonical-names-a-built-file` family of `npm run test:smoke` plants the canonical `https://meshin.co/about.html` and requires that failure.

#### Scenario: A canonical carries a trailing slash

- **WHEN** `/about` declares `https://meshin.co/about/` as its canonical
- **THEN** `npm run gate:machine` prints `MACHINE /about canonical is https://meshin.co/about/, expected https://meshin.co/about` and exits 1

#### Scenario: A page has no og:url

- **WHEN** `/about` ships without `<meta property="og:url">`
- **THEN** `npm run gate:machine` prints `MACHINE /about og:url is (missing), expected https://meshin.co/about` and exits 1

### Requirement: The page catalog behind the machine files matches every shipped description

Every entry of `STATIC_PAGE_CATALOG` and `HUB_PAGES` in `site/src/utils/machine-text.mjs`, which supply the static page descriptions in `/llms.txt` and the description line of each static and hub sidecar, SHALL name a route that built and SHALL equal that page's meta description once curly quotes are straightened and whitespace collapsed. `npm run gate:machine` enforces this through `site/scripts/catalog-drift.mjs`.

#### Scenario: A page's description drifts from the catalog

- **WHEN** `/about` ships a meta description that differs from its catalog entry
- **THEN** `npm run gate:machine` prints `MACHINE /about catalog-description-drift [catalog says "<catalog text>" but the page ships "<built text>"]` and exits 1

#### Scenario: A catalogued page no longer builds

- **WHEN** a catalog entry names `/gone` and the build holds no such page
- **THEN** `npm run gate:machine` prints `MACHINE /gone catalog-route-missing [/gone is in the catalog but did not build]` and exits 1

### Requirement: humans.txt names only components the project depends on

`/humans.txt` SHALL carry a `Components:` line, and every component it names SHALL match a `dependencies` or `devDependencies` key of `site/package.json` once both are lowercased and stripped of everything but letters. `npm run gate:machine` enforces this.

#### Scenario: humans.txt names a component that is not installed

- **WHEN** the `Components:` line of `/humans.txt` adds `Pagefind`
- **THEN** `npm run gate:machine` prints `MACHINE humans-component-absent humans.txt names Pagefind, which is not a dependency of this project` and exits 1

#### Scenario: humans.txt drops its stack line

- **WHEN** `/humans.txt` carries no `Components:` line
- **THEN** `npm run gate:machine` prints `MACHINE humans-components-missing humans.txt names no Components line, so its stack claim cannot be checked` and exits 1

### Requirement: robots.txt is the generated crawler register

`site/public/robots.txt` SHALL equal the output of `site/scripts/gen-robots.mjs`: a `*` group, then one group for each of 22 named training, retrieval and search crawlers in a pinned order, each with `Allow: /` and the `*` group's disallows, `/search` and `/styleguide`, plus `/api` only when a pages `api` directory exists, then a `Sitemap:` line naming `https://meshin.co/sitemap-index.xml`. Guarded by `site/scripts/gen-robots.test.mjs` under `npm run test`.

#### Scenario: robots.txt is edited by hand

- **WHEN** `site/public/robots.txt` differs from what the generator renders for the real pages directory
- **THEN** `npm run test` fails the test `the committed robots.txt equals the generator output for the real pages directory`

#### Scenario: A named crawler drops out of the register

- **WHEN** an agent is removed from the generator's crawler lists
- **THEN** `npm run test` fails the test `the crawler register names exactly this pinned set of agents, in this order, so silence is never a decision`

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

### Requirement: Social cards are addressed per entry and drawn on a 1200×630 canvas

The card template in `site/src/utils/og-template.mjs` SHALL draw on a fixed 1200×630 canvas, and a collection entry's `og:image` SHALL be the absolute URL of `/og/<collection>/<id>.png` unless the entry names its own image. Guarded by `site/src/utils/og-template.test.mjs` and `site/src/utils/machine-links.test.mjs` under `npm run test`.

#### Scenario: The card canvas changes size

- **WHEN** the template's root element is no longer 1200 by 630
- **THEN** `npm run test` fails the test `the root element carries the fixed 1200x630 canvas size`

#### Scenario: A post's og:image points elsewhere

- **WHEN** `articleMetadata` stops pointing a post's `og:image` at `https://meshin.co/og/post/<id>.png`
- **THEN** `npm run test` fails the test `article metadata carries the absolute og image and the article dates`

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

### Requirement: Every shard is a shipped machine file, noindex and referenced

Each `/llms/*.txt` file, shard or not, SHALL match a `noindex` rule in the built headers file and SHALL be reachable by links from a built page or from `/llms.txt`, directly or through another machine file. `npm run gate:machine` enforces this, so a shard no index lists fails it.

#### Scenario: A shard no index lists ships

- **WHEN** the build holds `/llms/post-1.txt` and `/llms/post.txt` does not list it
- **THEN** `npm run gate:machine` prints `MACHINE /llms/post-1.txt ships but the post index does not list it` and exits 1

### Requirement: The llms files describe the build they came from

The count on a collection's line in `/llms.txt` and in `/llms-full.txt` SHALL equal the entries its files hold, each shard SHALL hold the range the index gives it, an index SHALL hold no entry itself, no entry SHALL ship twice, and the last shard SHALL be the last. Every live entry is then reachable from `/llms.txt` in two further fetches. `npm run gate:machine` enforces this through `llmsCorpusGaps` in `site/scripts/llms-corpus.mjs`.

#### Scenario: A count drifts from the shipped entries

- **WHEN** the `/llms.txt` line for `/llms/post.txt` says 9 entries and the files hold 8
- **THEN** `npm run gate:machine` prints `MACHINE llms.txt says 9 entries for post, its files hold 8` and exits 1

#### Scenario: An index carries an entry itself

- **WHEN** `/llms/post.txt` indexes shards and also lists the URL of `/blog/a-post` as an entry
- **THEN** `npm run gate:machine` prints `MACHINE /llms/post.txt is an index of shards but lists https://meshin.co/blog/a-post itself` and exits 1

### Requirement: The llms files order entries by a total key and no generator reads a clock

Entries SHALL be ordered by publish date ascending, then by id ascending, a total order, and no generator SHALL read a clock. A newer entry lands last, so only the old last shard and the index move; a back-dated entry shifts every later shard. Guarded by `site/src/utils/llms-collections.test.mjs`; `npm run test:smoke` drops the tie-break and appends a timestamp, and each must turn it red.

#### Scenario: The id tie-break is dropped

- **WHEN** `orderEntries` sorts by publish date alone
- **THEN** `npm run test` fails the test `generating twice from one fixture is byte-identical for every file, in any input order`

#### Scenario: A timestamp is appended

- **WHEN** a generator appends the current time to a file
- **THEN** `npm run test` fails the test `the generator reads no clock: a second run a day later is byte-identical`

### Requirement: A second build of an unchanged tree writes byte-identical llms files

A second `npm run build` of an unchanged tree SHALL write byte-identical `/llms.txt`, `/llms-full.txt` and `/llms/*.txt`. Guarded by `site/src/utils/llms-collections.test.mjs` under `npm run test`.

#### Scenario: A second build

- **WHEN** the generator runs a second time over the same entries, a day later and in reversed input order
- **THEN** `npm run test` passes the tests `the generator reads no clock: a second run a day later is byte-identical` and `generating twice from one fixture is byte-identical for every file, in any input order`

### Requirement: Every route is owed the surfaces its kind implies, and the gate names each one it lacks

A built route SHALL be classified as exactly one of an entry, a collection hub, a public static page,
a tag index, a taxonomy archive, a pagination page, a declared exception or a withheld route, and
SHALL carry every machine surface that kind is owed. `npm run gate:parity` SHALL fail, naming the
route and the surface, for each owed surface a route lacks, and SHALL print how many routes it derived
and how many owed cells it checked and found present.

#### Scenario: An entry drops out of its search shard

- **WHEN** a built entry has no entry in the search shard of its collection
- **THEN** `npm run gate:parity` prints `PARITY <route> is owed a search entry: /search-index-<kind>.json holds no entry for it` and exits 1

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

### Requirement: A route's kind is derived, never listed

The kind of a route SHALL be derived from its shape under a collection base taken from the content
configuration and from whether its built page is noindex. No list of routes SHALL decide what a
route is owed, so a new collection or a new entry is owed every surface on the day it exists.

#### Scenario: A collection is added

- **WHEN** a new collection with a base and a live entry is built
- **THEN** its hub and entry are owed their surfaces with no edit to any list in the gate

#### Scenario: A noindex page nobody declared

- **WHEN** a built page is noindex and is neither a declared exception, a withheld hub of an empty collection nor an entry whose source marks it noindex
- **THEN** `npm run gate:parity` prints that the route is noindex and nothing declares it, and exits 1

### Requirement: The routes that carry less are declared once, with a reason, and counted

`site/src/utils/route-exceptions.mjs` SHALL declare each route that is deliberately outside the
indexed machine surfaces, and each collection that deliberately holds no live entry, with a reason.
The gate SHALL print their count and names. A declared exception whose route no longer builds or whose
page is indexable, and a declared empty collection that holds an entry or does not exist, SHALL each
be a finding. A collection with no live entry that is not declared empty SHALL be a finding.

#### Scenario: A declared exception disappears

- **WHEN** `/styleguide` is declared an exception and no page builds at `/styleguide`
- **THEN** `npm run gate:parity` prints that the exception names no built page and exits 1

#### Scenario: The first case study is published

- **WHEN** the `case` collection is declared empty and a live `case` entry builds
- **THEN** the gate prints that the collection is declared empty but holds a live entry and exits 1

### Requirement: A check that examines nothing is a finding

`npm run gate:machine` SHALL NOT report a collection with no live entry as a skipped check. It SHALL
count the collections declared empty and name them on stdout, SHALL fail on a collection with no live
entry that is not declared empty, and SHALL fail when no sitemap lastmod was expected. `npm run gate:parity` SHALL fail when no route in the build is
owed a surface.

#### Scenario: A collection has no live entry and is declared empty

- **WHEN** `case` has no live entry and is declared empty with a reason
- **THEN** `npm run gate:machine` prints `1 of 6 collections have no live entry and are declared empty with a reason (case)` and exits 0

#### Scenario: A collection has no live entry and nobody declared it

- **WHEN** a collection other than `case` has no live entry
- **THEN** `npm run gate:machine` prints a finding naming the collection and the register to declare it in, and exits 1

#### Scenario: Nothing in the build is owed a surface

- **WHEN** the build holds no route that any kind owes a surface
- **THEN** `npm run gate:parity` prints that route parity examined nothing and exits 1

### Requirement: Every live entry ships once in its collection's files and is reachable in two further fetches

For each public collection with a live entry, every live entry SHALL appear exactly once across `/llms/<collection>.txt` and its numbered shards, on a line that opens with a link to it or holds only its URL, so `/llms.txt` reaches it in at most two further fetches. A live entry is a built `/<base>/<slug>` page with no `noindex` robots meta. `npm run gate:machine` enforces this.

#### Scenario: An entry is missing from its shards

- **WHEN** the URL line of `/blog/a-post` is removed from `/llms/post-2.txt`
- **THEN** `npm run gate:machine` prints `MACHINE /llms/post.txt omits /blog/a-post` and exits 1

#### Scenario: An entry ships twice

- **WHEN** `/llms/post-2.txt` repeats the URL line of an entry that `/llms/post-1.txt` holds
- **THEN** `npm run gate:machine` prints `MACHINE https://meshin.co/blog/a-post ships twice across the post shards` and exits 1

#### Scenario: A collection file was not built

- **WHEN** the build holds live FAQ entries and no `/llms/faq.txt`
- **THEN** `npm run gate:machine` prints `MACHINE no /llms/faq.txt full-text file` and exits 1

### Requirement: llms-full.txt points at the collection files and lists no entry

`/llms-full.txt` SHALL carry one line for each collection that has a live entry, holding its entry count and a link to `/llms/<collection>.txt`, and SHALL list no entry of any collection. A count that differs from the entries the collection's files hold, and an entry listed inline, each fail `npm run gate:machine`, which compares them with `llmsInlinedRoutes` in `site/scripts/machine.mjs`.

#### Scenario: An entry is listed in llms-full.txt

- **WHEN** `/llms-full.txt` gains a line linking `https://meshin.co/blog/a-post`
- **THEN** `npm run gate:machine` prints `MACHINE llms-full.txt lists /blog/a-post inline, entries of an unbounded collection belong in /llms/` and exits 1

#### Scenario: A count drifts from the shipped entries

- **WHEN** the `/llms-full.txt` line for `/llms/post.txt` says 9 entries and the files hold 10
- **THEN** `npm run gate:machine` prints `MACHINE llms-full.txt says 9 entries for post, its files hold 10` and exits 1

### Requirement: No file under /llms/ is over 100000 bytes

Every file under `/llms/` SHALL stay at or under `LLMS_FILE_MAX_BYTES`, 100000 bytes, in `site/src/utils/llms-collections.mjs`: what the fetch-tool documentation of Anthropic calls a large documentation page, about 25000 tokens. The entry caps keep the largest measured entry of each collection under it, and `npm run gate:machine` fails the file that is not.

#### Scenario: A shard outgrows its budget

- **WHEN** `/llms/post-1.txt` grows to 100001 bytes
- **THEN** `npm run gate:machine` prints `MACHINE llms/post-1.txt is 100001 bytes, over the 100000 byte guard` and exits 1

### Requirement: Each collection feed carries the newest entries of its collection and no more than its window

Every public collection SHALL have a feed base, and its feed `/<base>/rss.xml` SHALL carry a `<guid>` for each of the newest `FEED_WINDOW` live entries of that collection, 15, ordered by last modification and then by URL, and for no other. `npm run gate:machine` enforces both, and `site/scripts/machine.test.mjs` fails under `npm run test` when the merged feed endpoint or any collection feed endpoint is missing from the source.

#### Scenario: A collection feed drops an entry inside its window

- **WHEN** the item for `/glossary/dpia`, one of the newest 15 glossary entries, is removed from `/glossary/rss.xml`
- **THEN** `npm run gate:machine` prints `MACHINE /glossary/rss.xml omits /glossary/dpia` and exits 1

#### Scenario: A collection feed carries more than its window

- **WHEN** `/blog/rss.xml` holds 16 items
- **THEN** `npm run gate:machine` prints `MACHINE /blog/rss.xml carries 16 items, window is 15` and exits 1

#### Scenario: A new public collection has no feed base

- **WHEN** a collection `talks` is added to the content config and not to `FEED_BASES`
- **THEN** `npm run gate:machine` prints `MACHINE talks has no FEED_BASES entry; skipping its feed coverage check` and exits 1

### Requirement: Every feed file stays within the bytes its window allows

`/<base>/rss.xml` SHALL stay at or under `FEED_WINDOW` times the largest measured feed item, 28821 bytes, which is 432315, and `/rss.xml` and `/feed.json` at or under `MERGED_FEED_WINDOW`, 50, times it, 1441050; `/rss.xml` SHALL carry at most 50 items. The constants are in `site/src/utils/feeds.mjs` and `npm run gate:machine` fails a file over its budget.

#### Scenario: A collection feed outgrows its budget

- **WHEN** `/blog/rss.xml` grows to 500000 bytes
- **THEN** `npm run gate:machine` prints `MACHINE blog/rss.xml is 500000 bytes, over the 432315 byte guard` and exits 1

#### Scenario: The merged feed carries more than its window

- **WHEN** `/rss.xml` holds 51 items
- **THEN** `npm run gate:machine` prints `MACHINE merged rss.xml carries 51 items, window is 50` and exits 1

### Requirement: The collection files carry each entry's full text and llms-full.txt carries none

`renderLlmsCollection` and `renderLlmsShard` in `site/src/utils/machine-text.mjs` SHALL write each entry as its `# ` title, its ISO date when dated, its URL as a link, its summary and its whole body with markdown stripped, with `---` between entries. `renderLlmsFull` SHALL write no entry, because `/llms-full.txt` is an index of the collection files (locked row L25). Guarded by `site/src/utils/machine-text.test.mjs` under `npm run test`.

#### Scenario: A collection file carries links without bodies

- **WHEN** `renderLlmsCollection` stops writing entry bodies
- **THEN** `npm run test` fails the test `renderLlmsCollection carries the actual full body text of every entry, not just links to it`

#### Scenario: llms-full.txt carries an entry again

- **WHEN** `renderLlmsFull` writes the body of an entry
- **THEN** `npm run test` fails the test `renderLlmsFull lists the collection files and carries no entry`

### Requirement: llms-full.txt stays within its four-kilobyte guard

`/llms-full.txt` SHALL stay at or under `LLMS_FULL_MAX_BYTES`, 4096 bytes, in `site/src/utils/llms-collections.mjs`. It holds one line per collection and measured 0 bytes on 2026-11-04, so 4 KiB leaves room for about twenty collections and a change that needs more is a deliberate decision. Enforced by `npm run gate:machine`.

#### Scenario: llms-full.txt outgrows its budget

- **WHEN** `/llms-full.txt` grows to 5000 bytes
- **THEN** `npm run gate:machine` prints `MACHINE llms-full.txt is 5000 bytes, over the 4096 byte guard` and exits 1

### Requirement: A collection file holds at most its entry cap and shards beyond that

`LLMS_SHARD_MAX_ENTRIES` in `site/src/utils/llms-collections.mjs` SHALL give each collection the entries that fit 100000 bytes beside a 1024 byte frame at its largest measured entry: service 48, post 3, resource 7, glossary 33, faq 118, case 3. At or under its cap `/llms/<collection>.txt` holds the entries; above it that file indexes `/llms/<collection>-<n>.txt` shards, each with its range and count, chained by next links. `npm run gate:machine` fails a shard over its cap.

#### Scenario: A collection has one entry over its cap

- **WHEN** `post` holds 4 live entries
- **THEN** `npm run test` passes the test `one entry over the cap makes an index and two shards named post-1 and post-2`, and a collection of exactly 3 stays one file

#### Scenario: A shard holds more than its cap

- **WHEN** `/llms/post-1.txt` holds 4 entries
- **THEN** `npm run gate:machine` prints `MACHINE /llms/post-1.txt holds 4 entries, over the 3 entry cap` and exits 1
