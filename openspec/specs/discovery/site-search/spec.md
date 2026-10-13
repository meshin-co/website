# discovery/site-search Specification

## Purpose

Governs the site's own search: the per-kind index shards the build writes, what each entry holds, how a query is matched and ranked in the browser, and how the `/search` page answers, summarises and recovers from a failed load. The shard set is checked by `npm run gate:search`, the index model by unit tests under `npm run test`, and the page itself by `site/tests/search.spec.ts` against the built site.

## Requirements

### Requirement: The build ships exactly one index shard per search kind

The build SHALL hold one shard `/search-index-<kind>.json` for each of the seven kinds in `KINDS` of `site/public/search/shards.mjs`, `post`, `glossary`, `resource`, `service`, `case`, `faq` and `page`, and no other. `npm run gate:search` exits 1 when the per-kind shard files number other than seven or the build holds no index file at all, and `site/scripts/search-index.test.mjs` pins the seven kinds and the shard names under `npm run test`.

#### Scenario: A shard is missing

- **WHEN** the build holds no `/search-index-case.json`
- **THEN** `npm run gate:search` prints `shard count 6 does not match the expected 7` and exits 1

#### Scenario: A stray shard appears

- **WHEN** the build gains a `/search-index-extra.json` beside the seven shards
- **THEN** `npm run gate:search` prints `shard count 8 does not match the expected 7` and exits 1

#### Scenario: The build holds no index at all

- **WHEN** the build holds no search index file
- **THEN** `npm run gate:search` prints `sum 0 bytes gz` and exits 1

### Requirement: The search page loads the index only when asked, and then loads all of it

Opening `/search` SHALL fetch no index shard. The first query SHALL fetch exactly the set of shards the build holds and list at least one result whose link is a root-relative path. `site/tests/search.spec.ts` checks this in Chromium at desktop and mobile widths under `npm run gate:visual`.

#### Scenario: The shards load before anyone searches

- **WHEN** the search page fetches its shards on load, before any query
- **THEN** `npm run gate:visual` fails the test `search returns real hits and every fetched shard stays inside the per-shard and sum budgets`

#### Scenario: A query skips a shard

- **WHEN** the first query fetches six of the seven shards
- **THEN** `npm run gate:visual` fails the test `search returns real hits and every fetched shard stays inside the per-shard and sum budgets`

### Requirement: A query in the address is answered on load, and every answer is summarised by kind

Loading `/search?q=<query>` SHALL run that query without a click. A query that matches nothing SHALL list no results and print `No pages match “<query>”.`; matches SHALL be counted per kind, largest group first, as in `12 answers · 8 terms · 3 articles match “evals”.` Guarded by `site/tests/search.spec.ts` under `npm run gate:visual` and `site/scripts/search-index.test.mjs` under `npm run test`.

#### Scenario: The address query is ignored

- **WHEN** the page loads `/search?q=retainer` and shows no results until a click
- **THEN** `npm run gate:visual` fails the test `a query in the url is answered on load, and a nonsense query says so`

#### Scenario: The summary orders kinds wrongly

- **WHEN** the summary for 3 articles, 8 terms and 12 answers lists the articles first
- **THEN** `npm run test` fails the test `the summary line groups results by kind with counts, biggest group first`

### Requirement: A query matches whole-word prefixes of every word it holds, and title hits rank first

`rankEntries` and `scoreEntry` in `site/public/search/index-model.mjs` SHALL keep only entries holding every query word of at least two characters, matched without regard to case at the start of a word and never inside one, and SHALL rank a title hit above a description hit and a description hit above a text hit. A query of punctuation or a single letter matches nothing. Guarded by `site/scripts/search-index.test.mjs` under `npm run test`.

#### Scenario: A word matches mid-word

- **WHEN** the query word `vals` matches the title `Evals`
- **THEN** `npm run test` fails the test `matching is case-insensitive and matches word prefixes, not substrings mid-word`

#### Scenario: One missing word is forgiven

- **WHEN** an entry holding `evals` but not `kubernetes` still scores for the words `evals` and `kubernetes`
- **THEN** `npm run test` fails the test `every word must appear somewhere for the entry to match`

#### Scenario: A one-letter query returns results

- **WHEN** the query `e` returns entries
- **THEN** `npm run test` fails the test `a query of only punctuation or one letter matches nothing`

### Requirement: Each kind's index entry carries the fields people search for

`buildShardEntry` in `site/public/search/shards.mjs` SHALL index a post's key takeaways, full answer, FAQ pairs and body; a glossary term's short and full definitions and body; a service's short answer, deliverables, FAQ pairs and body; a case study's problem, approach and outcome metrics; and an FAQ entry's question as its title, its answer as its description and both as its text. Guarded by `site/scripts/search-index.test.mjs` under `npm run test`.

#### Scenario: A post's FAQ block leaves the index

- **WHEN** post entries stop indexing their own FAQ pairs
- **THEN** `npm run test` fails the test `a post entry indexes takeaways, full answer, its own faq block and body`

#### Scenario: A service's deliverables leave the index

- **WHEN** service entries stop indexing their deliverables
- **THEN** `npm run test` fails the test `a service entry indexes the short answer, deliverables and service faq pairs`

### Requirement: Entry text is cut at its own kind's cap

Each entry's text SHALL be cut at its own kind's cap in `ENTRY_TEXT_CAPS` of `site/public/search/shards.mjs`, never at one shared cap, with the post cap above the FAQ cap, and text derived from a built page SHALL stay within the page cap. Guarded by `site/scripts/search-index.test.mjs` and `site/scripts/search-page-text.test.mjs` under `npm run test`.

#### Scenario: Every kind is cut at one shared cap

- **WHEN** post and FAQ entries are cut at the same length
- **THEN** `npm run test` fails the test `entry text is capped at its own kind budget, not a shared global one`

### Requirement: Index entries keep only what search needs

`buildIndexEntry` in `site/public/search/index-model.mjs` SHALL keep only `href`, `title`, `description`, `kind` and `text`, drop a trailing slash from the href, collapse whitespace and strip markdown from the text, and every kind SHALL carry its display label from `KINDS`. Guarded by `site/scripts/search-index.test.mjs` under `npm run test`.

#### Scenario: An entry keeps a trailing slash

- **WHEN** an entry built for `/glossary/evals/` keeps that href
- **THEN** `npm run test` fails the test `an index entry keeps only what search needs, with collapsed whitespace`

### Requirement: Page entries are searched by the prose of their built page

Every page-shard entry built with empty text SHALL take its text from the prose of its built page, leaving out the header, navigation, footer, JSON-LD and inline styles, and an entry with no title and description SHALL take both from that page's head. `site/scripts/search-page-text.mjs` does this inside `npm run build`, guarded by `site/scripts/search-page-text.test.mjs` under `npm run test`.

#### Scenario: Derived text keeps the page's JSON-LD

- **WHEN** the derived text of `/pricing` includes the JSON-LD the page ships inside its main
- **THEN** `npm run test` fails the test `derived text is the prose a person reads, never the JSON-LD or inline style a page ships inside its main`

#### Scenario: A static page is searchable by its title only

- **WHEN** the page entry for `/security` ships with no text
- **THEN** `npm run gate:visual` fails the test `a hand-authored static page is found by a phrase from its own body copy, not its title or description`

### Requirement: A page entry with no built page stops the build

Every page-shard entry built with empty text SHALL name a route that has a built page; when one does not, `site/scripts/search-page-text.mjs` throws and `npm run build` stops instead of shipping an entry with no text. Guarded by `site/scripts/search-page-text.test.mjs` under `npm run test`.

#### Scenario: An entry names a page that was not built

- **WHEN** the page shard names `/ghost` with empty text and no `/ghost` page was built
- **THEN** `npm run build` exits 1 with `search-page-text: no built page for search entry "/ghost"`

### Requirement: A failed index load says so and the next search tries again

When a shard fetch fails, the search page SHALL list no results, print `Search is unavailable right now. The FAQ, writing and glossary pages list everything.` and fetch the shards again on the next search instead of keeping the failure. `site/tests/search.spec.ts` checks both halves under `npm run gate:visual`.

#### Scenario: The page keeps a failed load

- **WHEN** the shards answer again after a failed load but the next search still shows the fallback
- **THEN** `npm run gate:visual` fails the test `a failed shard fetch shows the fallback message, and the next search retries instead of staying broken`

### Requirement: Real content is found by its own words

Searching the built site SHALL find a long post by a phrase deep in its body, a post by a phrase from its own FAQ block, a tag archive and a collection hub by name, a glossary term by name, a static page by a phrase from its body copy and a collection hub by a phrase from its body copy. `site/tests/search.spec.ts` runs one query for each against the real content under `npm run gate:visual`.

#### Scenario: Post bodies leave the index

- **WHEN** the post shard stops carrying post bodies
- **THEN** `npm run gate:visual` fails the test `a phrase from deep inside a long article is found by its own words, not just its title`
