# Build and Verify the Search Index

Search is a build-time partitioned index under `/search-index/`, ranked in the browser by
`site/public/search/index-model.mjs` and fetched lazily by `site/public/search/box.mjs` on the first real query.
Opening `/search` fetches no index file. There is no third-party search runtime.

## Layout

- `/search-index/manifest.json` is the one fixed URL and the only public file: the `version` (ten hex characters), the
  document count, the page size, `lastKeys` (the last key of every term chunk) and `kindRuns` (where each kind starts).
- `/search-index/<version>/t/<n>.json` is a term chunk of at most 12 KiB: a flat array of
  `[key, count, ...id steps, ...weights]` runs in key order. A key is a term, or a prefix of two or more characters where
  terms branch apart, and a prefix's list sums theirs. A negative count marks a list cut to its best-weighted documents.
- `/search-index/<version>/d/<n>.json` is a document page of six `[href, title, description]` rows. Ids follow `href`
  order, and the kind of an id comes from `kindRuns`.

Everything under `<version>/` is an implementation file, never a public interface: `/openapi.json` and the ai-catalog
list the manifest alone. A change to any file changes the version.

## Build

1. `astro build` emits `/search-entries.json` from `src/pages/search-entries.json.ts`: one raw entry per route, of every
   kind in `KINDS` (`public/search/shards.mjs`), built by `buildShardEntry`, which cuts the body at the `ENTRY_TEXT_CAPS`
   size of its kind. A post's own `faq` frontmatter is indexed, as a service's always was.
2. `scripts/build-search-index.mjs` runs straight after, inside `npm run build`. It fills the page text, writes
   `dist/search-index/` through `buildSearchIndex` in `src/utils/search-index.mjs` and deletes `/search-entries.json`
   from `dist/`, so `gen-openapi.mjs` and `gen-agent-catalog.mjs` see only the finished index.
3. Check `dist/`: `/search-index/manifest.json` is there, `/search-entries.json` is gone, `npm run gate:search` passes.

## Coverage and derivation

The `page` kind's route set is derived, never hand-listed: `src/pages/search-entries.json.ts` builds it from
`publicIndexableStaticPages()` and `collectionHubs` (`src/utils/machine-text.mjs`), fed `LLMS_COLLECTIONS`
(`src/utils/llms-collections.mjs`), and from every category and tag with a live post. One with none gets no entry: that
route is noindexed or does not exist, and indexing it would surface a page crawlers are told to ignore.

Pages with no data module (`/approach`, `/pricing`, `/ai-policy`, `/security`, `/now`, `/contact`, `/imprint`,
`/privacy`, `/terms` and the five hub leads) carry no transcribed copy. Their entries reach step 2 with empty text, and
`fillPageText` in `scripts/search-page-text.mjs`, a library with no command of its own, reads each one's built HTML
back: the body from `extractPage` in `content-html.mjs`, which strips header, footer, nav, `<script>` and `<style>`, so
inline JSON-LD never becomes search text, and, for a hub built with no title or description, those from `<title>` and
the description meta. It fills only an entry whose text is empty and throws on one whose route has no built page. Search
text cannot drift from a page's copy, because it is that copy's rendered output. `categoryPillars`, `TAGS`,
`~/data/home` and the `author` and `faq` collections stay the direct source of `/`, `/about`, `/faq`, `/blog/tags` and
every category and tag.

## Query rules

`queryWords` lower-cases the query, splits it on anything that is not a letter or a digit, drops words under two
characters and cuts the rest at 32. Stop words (`STOP_WORDS`) are not indexed and are dropped from queries; a query with
no word left fetches nothing. At most 8 distinct words count. Every word is a prefix match and every word must match. A
document scores 8 for each occurrence of a word in its title, 3 in its description and 1 in its text; ties go to `href`
order, the top 20 are shown and the summary line counts every match by kind. A list longer than 1228 documents keeps its
best-weighted 1228, which still scores but no longer rules a document out. The excerpt under a result is the page
description: body text is indexed and never shipped.

## Budgets and limits

`npm run gate:search` (`scripts/search-budget.mjs`) holds the built index to two limits. The first query: the most any
one query could download, the manifest plus the 8 largest term chunks plus the 20 largest document pages, each gzipped,
is at most 64 KiB. The files: at most 4000 under `dist/search-index/` (Cloudflare Pages allows 20000). It also refuses a
manifest, chunk or page that is missing, malformed or not named by the manifest, and a leftover `search-entries.json` or
per-kind index file in `dist/`. `npm run measure:search` (`scripts/measure-search.mjs`) prints the sizes by class, the
worst first query against its budget, what one more article adds, and when the first query budget, the file budget and
the list cap are reached at the write rate in `site/engine.config.json`; it reports and exits 0.

To change a limit, edit `INDEX_LIMITS` (`chunkBytes`, `pageDocuments` and `listCap`, which follows `chunkBytes`) or
`ROW_LIMITS` in `src/utils/search-index.mjs`, or `MAXIMUM_QUERY_WORDS` or `MAXIMUM_RESULTS` in
`public/search/index-model.mjs`. Then run `npm run build` and `npm run measure:search`, record the printed sizes in the
active OpenSpec change (`work-a-change-in-the-spec-tree.md`) and correct the numbers this skill quotes. A red
`gate:search` names what grew or broke; never raise a budget to pass.

## Proof

`scripts/fixtures/search-oracle.mjs` is the former search, a scan of every document, kept as the reference the
differential tests in `src/utils/search-index.test.mjs` compare the index with. `createSearch` memoizes each fetch; a
failure drops its cache and retries the query once, and a lasting failure rejects, which `box.mjs` shows as the
unavailable text. `tests/search.spec.ts` proves the retry with `page.route(...).abort()` and then `page.unroute(...)`:
the first search shows the fallback message, the second succeeds. `npm run test:smoke` proves `gate:search` can fail.
