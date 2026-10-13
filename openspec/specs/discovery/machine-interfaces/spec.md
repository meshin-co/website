# discovery/machine-interfaces Specification

## Purpose

Governs the files the site publishes for crawlers, answer engines and feed readers: the llms text files, the markdown sidecars, the RSS and JSON feeds, the sitemap, robots.txt, humans.txt, the canonical URL of every page, the noindex header on machine files and the social cards. Each rule is checked in the built output by `npm run gate:machine`, which prints every finding as a `MACHINE` line and exits 1, or in a unit test of the code that writes the file.

## Requirements

### Requirement: Every live collection entry is listed in llms.txt, llms-full.txt and its collection file

For each public collection, meaning every collection in `site/src/content.config.ts` except `author` and `speaking`, every live entry SHALL appear in `/llms.txt`, `/llms-full.txt` and `/llms/<collection>.txt` on a line that opens with a link to it or holds only its URL; a link inside prose does not count. A live entry is a built `/<base>/<slug>` page with no `noindex` robots meta. `npm run gate:machine` enforces this and fails when a collection file is missing.

#### Scenario: An entry's own line is missing from llms.txt

- **WHEN** the line linking `https://meshin.co/glossary/evals` is removed from `/llms.txt` while that entry is live
- **THEN** `npm run gate:machine` prints `MACHINE llms.txt omits /glossary/evals` and exits 1

#### Scenario: An entry is missing from llms-full.txt

- **WHEN** the URL line of `/glossary/evals` is removed from `/llms-full.txt`
- **THEN** `npm run gate:machine` prints `MACHINE llms-full.txt omits /glossary/evals` and exits 1

#### Scenario: An entry is missing from its collection file

- **WHEN** the URL line of `/glossary/evals` is removed from `/llms/glossary.txt`
- **THEN** `npm run gate:machine` prints `MACHINE /llms/glossary.txt omits /glossary/evals` and exits 1

#### Scenario: A collection file was not built

- **WHEN** the build holds no `/llms/faq.txt`
- **THEN** `npm run gate:machine` prints `MACHINE no /llms/faq.txt full-text file` and exits 1

### Requirement: llms.txt lists every indexable route of the build

Every route built into the site whose page carries no `noindex` robots meta SHALL appear in `/llms.txt` on a line that opens with a link to it or holds only its URL, so static pages, collection hubs and the live category and tag archives are listed as well as collection entries. `npm run gate:machine` enforces this against every built page.

#### Scenario: A static page is missing from llms.txt

- **WHEN** the `/security` line is removed from `/llms.txt`
- **THEN** `npm run gate:machine` prints `MACHINE llms.txt is missing indexable route /security` and exits 1

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

### Requirement: llms-full.txt and the collection files carry each entry's full text

`renderLlmsCollection` and `renderLlmsFull` in `site/src/utils/machine-text.mjs` SHALL write each entry as its `# ` title, its ISO date when dated, its URL as a link, its summary and its whole body with markdown stripped, with `---` between entries, so the files hold the text and not only links to it. Guarded by `site/src/utils/machine-text.test.mjs` under `npm run test`.

#### Scenario: llms-full.txt carries links without bodies

- **WHEN** `renderLlmsFull` stops writing entry bodies
- **THEN** `npm run test` fails the test `renderLlmsFull carries the actual full body text of every collection, not just links to it`

### Requirement: Draft and noindex entries never reach llms-full.txt, the collection files or the feeds

`renderLlmsCollection`, `renderLlmsFull` and `buildFeedItems` in `site/src/utils/machine-text.mjs` SHALL drop every entry marked `draft` or `noindex`, and `collectionFeedItems` in `site/src/utils/feed-items.mjs` SHALL drop every `noindex` entry. Guarded by `site/src/utils/machine-text.test.mjs` and `site/src/utils/feed-items.test.mjs` under `npm run test`.

#### Scenario: A draft reaches the feed items

- **WHEN** `buildFeedItems` keeps an entry marked `draft: true`
- **THEN** `npm run test` fails the test `buildFeedItems never emits a draft or noindex entry`

#### Scenario: A noindex entry reaches a collection file

- **WHEN** `renderLlmsCollection` keeps an entry marked `noindex: true`
- **THEN** `npm run test` fails the test `renderLlmsCollection never emits a draft or noindex entry`

### Requirement: llms-full.txt stays within its two-megabyte guard

`/llms-full.txt` SHALL stay at or under 2000000 bytes of UTF-8, so its growth fails the gate instead of passing unnoticed. `npm run gate:machine` enforces the limit through `LLMS_FULL_MAX_BYTES` in `site/scripts/machine.mjs`.

#### Scenario: llms-full.txt grows past the guard

- **WHEN** `/llms-full.txt` grows to 2225553 bytes
- **THEN** `npm run gate:machine` prints `MACHINE llms-full.txt is 2225553 bytes, over the 2000000 byte guard` and exits 1

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

### Requirement: Each collection feed carries every live entry of its collection

Every public collection SHALL have a feed base, and its feed `/<base>/rss.xml` SHALL carry a `<guid>` for every live entry of that collection. `npm run gate:machine` enforces both, and `site/scripts/machine.test.mjs` fails under `npm run test` when the merged feed endpoint or any collection feed endpoint is missing from the source.

#### Scenario: A collection feed drops an entry

- **WHEN** the item for `/glossary/dpia` is removed from `/glossary/rss.xml`
- **THEN** `npm run gate:machine` prints `MACHINE /glossary/rss.xml omits /glossary/dpia` and exits 1

#### Scenario: A new public collection has no feed base

- **WHEN** a collection `talks` is added to the content config and not to `FEED_BASES`
- **THEN** `npm run gate:machine` prints `MACHINE talks has no FEED_BASES entry; skipping its feed coverage check` and exits 1

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

### Requirement: Every populated collection reaches llms.txt, feed.json and the sitemap

For every public collection with at least one live entry, `/llms.txt`, `/feed.json` and `/sitemap-0.xml` SHALL each contain a URL path under that collection's base. A collection with no live entry is named on stdout and skipped, and a build in which no collection has a live entry fails instead of passing on nothing. `npm run gate:machine` enforces this.

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

Every live route that `siteLastmods` in `site/src/utils/sitemap-lastmod.mjs` dates SHALL appear in `/sitemap-0.xml` with a `<lastmod>`: each live content entry, each collection hub dated by its newest live entry or its page file's git history, each category and tag archive of a live post, `/blog/tags` and each public static page whose source file has git history. `npm run gate:machine` enforces this and asks that same helper which routes to expect.

#### Scenario: A route loses its lastmod

- **WHEN** the `/about` entry of `/sitemap-0.xml` loses its `<lastmod>`
- **THEN** `npm run gate:machine` prints `MACHINE sitemap has no lastmod for /about` and exits 1

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

The headers file that `site/scripts/gen-headers.mjs` writes into the build SHALL send `X-Robots-Tag: noindex` for `/rss.xml`, `/*/rss.xml`, `/feed.json`, `/llms.txt`, `/llms-full.txt`, `/search-index*` and `/*.md`, and its site-wide `/*` block, which covers every HTML page, SHALL NOT send it. Guarded by `site/scripts/gen-headers.test.mjs` under `npm run test`.

#### Scenario: A machine file loses its noindex header

- **WHEN** `renderHeaders` drops the `/feed.json` rule
- **THEN** `npm run test` fails the test `machine surfaces carry X-Robots-Tag: noindex` with `/feed.json misses X-Robots-Tag`

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
