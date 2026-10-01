# Build and Verify the Search Index

Search is a build-time index of seven shards emitted by `site/src/pages/search-index-[kind].json.ts`, ranked by
`site/public/search/index-model.mjs` and fetched lazily by `site/public/search/box.mjs` on the
first real query. There is no third-party search runtime.

## Coverage and derivation

The `page` shard's route set is derived, never hand-listed: `src/pages/search-index-[kind].json.ts`
builds it from `publicIndexableStaticPages()` (`src/utils/machine-text.mjs`) plus
`collectionHubs({ collections: LLMS_COLLECTIONS, staticPaths })` (`src/utils/llms-collections.mjs`)
for the five collection hubs, plus every category and tag that actually has a live post. A
category or tag with zero live posts gets no entry — that route is either noindexed (a category
with no posts) or does not exist at all (`blog/tag/[tag].astro`'s own `getStaticPaths` already
skips it), so indexing it would surface a page search engines are told to ignore.

Pages with no data module (`/approach`, `/pricing`, `/ai-policy`, `/security`, `/now`, `/contact`,
`/imprint`, `/privacy`, `/terms`, and the five hub leads) carry no transcribed copy of their prose.
Those entries are built empty at Astro-build time, then `scripts/search-page-text.mjs` runs as a
postbuild step — `npm run build` calls it after `gen-headers.mjs` and before `gate.mjs`, once
`dist/` exists — and reads each entry's own built HTML back out, taking the title from `<title>`,
the description from the description meta and the body from `content-html.mjs`'s `extractPage`,
which already strips header, footer and nav chrome and every `<script>` and `<style>` block, so a
page's inline JSON-LD never becomes search text. It only fills an entry whose text is still
empty, so sourced entries are never overwritten. Search text therefore cannot drift from a page's
copy, because it is that copy's rendered output. `categoryPillars`, `TAGS`, `~/data/home` and the
`author` and `faq` collections remain the direct source for `/`, `/about`, `/faq`, `/blog/tags`,
every category and every tag — those never read `dist/` because they never drifted.

Per-kind entry text caps live in `ENTRY_TEXT_CAPS` (`public/search/shards.mjs`), sized from
measured content, not one shared number: `post: 16384` (long-form articles with a faq block),
`glossary`/`resource`/`case`/`page: 4096`, `service: 3072`, `faq: 1024`. `textFor.post` includes
the post's own `faq` frontmatter, the same pattern `textFor.service` already used — a post's FAQ
answer is a findable phrase, not silently dropped. Shard and sum budgets
(`scripts/search-budget.mjs`, 64 KB gz per shard / 192 KB gz summed) are unchanged and still
pass with headroom; re-measure with `npm run gate:search` after touching any
`textFor` entry or cap.

`public/search/box.mjs`'s `load()` memoizes the shard fetch in a module-level `loading`
promise. A rejected `Promise.all` used to stay assigned there forever, disabling search for the
rest of the page's life on the first dropped request. `load()` now clears `loading` in a
`.catch` before rethrowing, so the next search attempt retries the fetch instead of replaying
the same dead promise. `tests/search.spec.ts` proves this with `page.route(...).abort()`
followed by `page.unroute(...)`: the first search shows the fallback message, the second
succeeds.
