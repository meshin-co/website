# discovery/site-search Specification

## Purpose

Governs the site's own search: the partitioned index the build writes, a manifest with its term chunks and document pages, what each entry holds, how a query is matched and ranked in the browser, and how the `/search` page answers, summarises and recovers from a failed load. The index files are checked by `npm run gate:search`, the index model and builder by unit tests under `npm run test`, and the page itself by `site/tests/search.spec.ts` against the built site.

## Requirements

### Requirement: A query in the address is answered on load, and every answer is summarised by kind

Loading `/search?q=<query>` SHALL run that query without a click. A query that matches nothing SHALL list no results and print `No pages match “<query>”.`; matches SHALL be counted per kind, largest group first, as in `12 answers · 8 terms · 3 articles match “evals”.` Guarded by `site/tests/search.spec.ts` under `npm run gate:visual` and `site/scripts/search-index.test.mjs` under `npm run test`.

#### Scenario: The address query is ignored

- **WHEN** the page loads `/search?q=retainer` and shows no results until a click
- **THEN** `npm run gate:visual` fails the test `a query in the url is answered on load, and a nonsense query says so`

#### Scenario: The summary orders kinds wrongly

- **WHEN** the summary for 3 articles, 8 terms and 12 answers lists the articles first
- **THEN** `npm run test` fails the test `the summary line groups the kind of every match with counts, biggest group first`

### Requirement: A query matches whole-word prefixes of every word it holds, and title hits rank first

`rankLists` and `createSearch` in `site/public/search/index-model.mjs` SHALL keep only documents holding every query word, matched without regard to case at the start of a word and never inside one, and SHALL score each occurrence of a word 8 in a title, 3 in a description and 1 in the text, listing the highest score first and ties in address order. A query of punctuation or a single letter matches nothing. Guarded by `site/src/utils/search-index.test.mjs` under `npm run test`.

#### Scenario: A word matches mid-word

- **WHEN** the runtime returns a document for the query word `vals` because the title is `Evals`
- **THEN** `npm run test` fails the test `the ranking equals the old whole-array scan for every word, every prefix and many word pairs`

#### Scenario: One missing word is forgiven

- **WHEN** a document holding `evals` but not `kubernetes` is returned for the words `evals` and `kubernetes`
- **THEN** `npm run test` fails the test `the ranking equals the old scan on a generated corpus that spans many chunks, pages and shared prefixes`

#### Scenario: A one-letter query returns results

- **WHEN** the query `e` returns results
- **THEN** `npm run test` fails the test `the search words of a query drop stop words and one-letter words, and fold case`

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

Every page entry built with empty text SHALL take its text from the prose of its built page, leaving out the header, navigation, footer, JSON-LD and inline styles, and an entry with no title and description SHALL take both from that page's head. `site/scripts/search-page-text.mjs` does this inside `npm run build`, guarded by `site/scripts/search-page-text.test.mjs` under `npm run test`.

#### Scenario: Derived text keeps the page's JSON-LD

- **WHEN** the derived text of `/pricing` includes the JSON-LD the page ships inside its main
- **THEN** `npm run test` fails the test `derived text is the prose a person reads, never the JSON-LD or inline style a page ships inside its main`

#### Scenario: A static page is searchable by its title only

- **WHEN** the page entry for `/security` ships with no text
- **THEN** `npm run gate:visual` fails the test `a hand-authored static page is found by a phrase from its own body copy, not its title or description`

### Requirement: A page entry with no built page stops the build

Every page entry built with empty text SHALL name a route that has a built page; when one does not, `site/scripts/search-page-text.mjs` throws and `npm run build` stops instead of shipping an entry with no text. Guarded by `site/scripts/search-page-text.test.mjs` and `site/scripts/build-search-index.test.mjs` under `npm run test`.

#### Scenario: An entry names a page that was not built

- **WHEN** the page entries name `/ghost` with empty text and no `/ghost` page was built
- **THEN** `npm run build` exits 1 with `search-page-text: no built page for search entry "/ghost"`

### Requirement: A failed index load says so and the next search tries again

When a fetch of the manifest, a chunk or a page fails, the search page SHALL retry once inside the same query, and when that fails SHALL list no results, print `Search is unavailable right now. The FAQ, writing and glossary pages list everything.` and fetch again on the next search instead of keeping the failure. `site/tests/search.spec.ts` checks both halves under `npm run gate:visual`.

#### Scenario: The page keeps a failed load

- **WHEN** the files answer again after a failed load but the next search still shows the fallback
- **THEN** `npm run gate:visual` fails the test `a failed shard fetch shows the fallback message, and the next search retries instead of staying broken`

#### Scenario: A failed fetch is not retried inside the query

- **WHEN** a single failed fetch makes the query reject without a second attempt
- **THEN** `npm run test` fails the test `a failed fetch is retried inside the same query and a lasting failure rejects, then recovers on the next query`

### Requirement: Real content is found by its own words

Searching the built site SHALL find a long post by a phrase deep in its body, a post by a phrase from its own FAQ block, a tag archive and a collection hub by name, a glossary term by name, a static page by a phrase from its body copy and a collection hub by a phrase from its body copy. `site/tests/search.spec.ts` runs one query for each against the real content under `npm run gate:visual`.

#### Scenario: Post bodies leave the index

- **WHEN** the index stops carrying the words of post bodies
- **THEN** `npm run gate:visual` fails the test `a phrase from deep inside a long article is found by its own words, not just its title`

### Requirement: The build ships one manifest, its term chunks and its document pages, and no per-kind shard

The build SHALL write `/search-index/manifest.json`, the term chunks `/search-index/<version>/t/<n>.json` and the document pages `/search-index/<version>/d/<n>.json` the manifest names, and no other index file and no `/search-index-<kind>.json`. `npm run gate:search` runs `site/scripts/search-budget.mjs` and exits 1 on a missing manifest, a file the manifest does not name, a named file the build lacks or a legacy artifact.

#### Scenario: The manifest is missing

- **WHEN** the build holds no `/search-index/manifest.json`
- **THEN** `npm run gate:search` prints `search-index: /search-index/manifest.json is missing` and exits 1

#### Scenario: A file no manifest names

- **WHEN** the build holds `/search-index/8c45b17826/t/99.json` and the manifest of that version names 17 chunks
- **THEN** `npm run gate:search` prints `search-index: /search-index/8c45b17826/t/99.json is not named by the manifest` and exits 1

#### Scenario: A legacy shard ships

- **WHEN** the build holds `/search-index-post.json`
- **THEN** `npm run gate:search` prints `search-index: /search-index-post.json is a legacy artifact and must not ship` and exits 1

### Requirement: The search page loads nothing when opened, and a first query loads only what it needs

Opening `/search` SHALL fetch no index file. A first query SHALL fetch the manifest, one term chunk for each of its distinct words and the document pages of its top 20 results, and a second query SHALL reuse what the first fetched. `site/tests/search.spec.ts` checks this in Chromium under `npm run gate:visual`, and `site/src/utils/search-index.test.mjs` checks the set of files under `npm run test`.

#### Scenario: The index loads before anyone searches

- **WHEN** the search page fetches the manifest on load, before any query
- **THEN** `npm run gate:visual` fails the test `search returns real hits and the first query downloads less than the first-query budget`

#### Scenario: A query fetches a file the manifest does not name

- **WHEN** the first query fetches a file outside the version folder the manifest names
- **THEN** `npm run gate:visual` fails the test `search returns real hits and the first query downloads less than the first-query budget`

#### Scenario: A first query fetches more than it needs

- **WHEN** a first query fetches the chunk of a stop word or the page of a document outside its top 20
- **THEN** `npm run test` fails the test `a first query fetches the manifest, one chunk per distinct word and only the pages of its hits`

#### Scenario: A second query fetches again what the first fetched

- **WHEN** a second query fetches the manifest again
- **THEN** `npm run test` fails the test `a second query reuses what the first fetched`

### Requirement: Stop words are neither indexed nor matched, and a query holds at most eight distinct words

`termsOf` and `searchWords` in `site/public/search/index-model.mjs` SHALL drop stop words and words under two characters, fold case, cut a word at 32 characters and keep at most 8 distinct words, counting a repeated word once with its repeat. A query with no word left SHALL match nothing and fetch nothing. Guarded by `site/src/utils/search-index.test.mjs` under `npm run test`.

#### Scenario: A stop word is matched

- **WHEN** the query `how to` fetches a chunk or returns a result
- **THEN** `npm run test` fails the test `a stop word is not indexed and a query made only of stop words matches nothing and fetches nothing`

#### Scenario: A ninth word is used

- **WHEN** a query of nine distinct words fetches nine chunks
- **THEN** `npm run test` fails the test `a repeated word is kept once with its count, and at most the word limit is used`

#### Scenario: A one-letter query returns results

- **WHEN** the query `e` returns results
- **THEN** `npm run test` fails the test `the search words of a query drop stop words and one-letter words, and fold case`

### Requirement: The partitioned index returns what the whole-array scan returned for every word that is not a stop word

The ranking of `createSearch` in `site/public/search/index-model.mjs` SHALL equal the whole-array scan kept in `site/scripts/fixtures/search-oracle.mjs` for every word that is not a stop word, every prefix of one and pairs of them, on the real corpus and on a generated corpus that spans many chunks, pages and shared prefixes. Guarded by `site/src/utils/search-index.test.mjs` under `npm run test`.

#### Scenario: The ranking leaves the scan on the real corpus

- **WHEN** the runtime returns a different list from the scan for a word, a prefix or a pair of words of the corpus
- **THEN** `npm run test` fails the test `the ranking equals the old whole-array scan for every word, every prefix and many word pairs`

#### Scenario: The ranking leaves the scan on a generated corpus

- **WHEN** the runtime returns a different list from the scan on a corpus that spans many chunks, pages and shared prefixes
- **THEN** `npm run test` fails the test `the ranking equals the old scan on a generated corpus that spans many chunks, pages and shared prefixes`

### Requirement: A word found in more documents than the list cap keeps its best postings and never excludes a document

`INDEX_LIMITS.listCap` in `site/src/utils/search-index.mjs` SHALL be `floor(chunkBytes / 10)`, 1228 for a chunk of 12288 bytes. A longer list SHALL keep its best-weighted documents and be marked truncated; a truncated list SHALL NOT exclude a document that another word keeps, only add its retained weights, and when every word is truncated their lists SHALL be ranked together. Guarded by `site/src/utils/search-index.test.mjs` under `npm run test`.

#### Scenario: A list over the cap ships whole

- **WHEN** a list of 1229 postings ships untruncated
- **THEN** `npm run test` fails the test `a list longer than the list cap keeps the best-weighted documents and says so`

#### Scenario: A truncated list excludes a document

- **WHEN** a document absent from the retained list of a word over the cap is dropped from a two-word query that another word keeps
- **THEN** `npm run test` fails the test `a word over the list cap does not filter when another word can: its retained weights only add to the score`

#### Scenario: Every word is over the cap

- **WHEN** every word of a query is over the cap and the lists are not ranked together
- **THEN** `npm run test` fails the test `when every word is over the list cap the best documents of all their lists are ranked together, best first`

#### Scenario: The cap outgrows a chunk

- **WHEN** the list cap is larger than the postings one chunk can hold
- **THEN** `npm run test` fails the test `the list cap is derived from the chunk size, so a single full list always fits in one chunk`

### Requirement: A chunk holds at most its byte size, a page at most six documents and a row at most its field limits

A term chunk SHALL be at most `INDEX_LIMITS.chunkBytes` of 12288 bytes unless one key alone is larger, a document page SHALL hold at most `INDEX_LIMITS.pageDocuments` of 6 documents, and a row SHALL be `[href, title, description]` of at most 160, 160 and 500 characters, a longer title or description clipped and a longer href refused. `npm run gate:search` enforces the shapes and `site/src/utils/search-index.test.mjs` the builder under `npm run test`.

#### Scenario: A chunk outgrows its size

- **WHEN** `/search-index/8c45b17826/t/3.json` holds 13000 raw bytes and more than one key
- **THEN** `npm run gate:search` prints `search-index: /search-index/8c45b17826/t/3.json is 13000 bytes raw (over 12288)` and exits 1

#### Scenario: A page holds seven documents

- **WHEN** `/search-index/8c45b17826/d/0.json` holds 7 rows
- **THEN** `npm run gate:search` prints `search-index: /search-index/8c45b17826/d/0.json holds 7 rows (over 6)` and exits 1

#### Scenario: A long description reaches the page whole

- **WHEN** a description of 600 characters reaches its page row unclipped
- **THEN** `npm run test` fails the test `a long title or description is clipped in its page row but still searchable in full, and a long href is refused`

### Requirement: A result shows the page description, and no body text ships in the index

A document page row SHALL carry the `href`, the `title` and the `description` of the document and no body text, so the excerpt under a result is the page description, and the text of a document SHALL reach the index only as weighted terms. `npm run gate:search` refuses a row of any other shape and a first query over its budget, which rows carrying body text reach at once.

#### Scenario: A row carries a body

- **WHEN** every row of `/search-index/8c45b17826/d/0.json` carries a fourth field of body text
- **THEN** `npm run gate:search` prints `search-index: /search-index/8c45b17826/d/0.json row 0 is not [href, title, description] strings of at most 160, 160 and 500 characters` and exits 1

#### Scenario: The index grows with the corpus

- **WHEN** 600 documents sharing 60 words carry their body text in the page rows
- **THEN** `npm run test` fails the test `the index does not grow with the corpus: 600 documents sharing 60 words pass, and the same documents with their body text in the page rows do not`

### Requirement: The index is deterministic, versioned by its content, and a stale manifest recovers

The builder SHALL write the same files for the same documents in any input order, SHALL name a ten-character hash of the content as the version and as the folder of every chunk and page, and the runtime SHALL drop a manifest cached before a redeploy when its files are gone and still answer. Guarded by `site/src/utils/search-index.test.mjs` under `npm run test`.

#### Scenario: The build depends on input order

- **WHEN** two builds of the same documents in a different order write different files
- **THEN** `npm run test` fails the test `the build is deterministic and independent of input order`

#### Scenario: A change leaves the version alone

- **WHEN** a document description changes and the version does not
- **THEN** `npm run test` fails the test `any change to a document changes the version, and every file path carries it`

#### Scenario: A cached manifest outlives a deploy

- **WHEN** the manifest a visitor cached names files the new build removed and the query fails
- **THEN** `npm run test` fails the test `a manifest cached before a redeploy is dropped when its files are gone, and the query still answers`

### Requirement: The index is written once the pages are built, and the intermediate file does not ship

`npm run build` SHALL run `site/scripts/build-search-index.mjs` after `astro build`; it SHALL read `search-entries.json`, give each page entry its text from its built page, write the index under `/search-index/` and remove `search-entries.json`, changing nothing else in the build. A build with no `search-entries.json` SHALL stop, naming the file and `astro build`. Guarded by `site/scripts/build-search-index.test.mjs` under `npm run test`.

#### Scenario: The build writes the index

- **WHEN** `npm run build` finishes over 110 documents
- **THEN** it prints `search-index: 110 documents, 37 files, version 8c45b17826` and `dist` holds no `search-entries.json`

#### Scenario: The intermediate file stays

- **WHEN** the build leaves `search-entries.json` in `dist`
- **THEN** `npm run test` fails the test `search-entries.json is removed once the index is written, and the only other change to dist is the search-index folder`

#### Scenario: The entries file is missing

- **WHEN** `dist` holds no `search-entries.json`
- **THEN** `npm run test` fails the test `a dist with no search-entries.json fails naming the file and astro build, and writes nothing`
