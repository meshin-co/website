# Machine Interfaces

Everything a crawler, answer engine or feed subscriber reads is a build output derived from
the collections. Verify in the built output, never in source. The gate is
`npm run gate:machine` (`scripts/machine.mjs`).

## Surfaces

- /rss.xml — merged full-text feed sorted by max(publishDate, updatedDate), per-kind floor
  of 5, no global cap. Mirrored at /feed.json.
- Six per-collection feeds — /blog/rss.xml, /glossary/rss.xml, /resources/rss.xml,
  /case-studies/rss.xml, /faq/rss.xml, /services/rss.xml — each listing every live entry of
  its collection, generated from `src/pages/<base>/rss.xml.ts` endpoints.
- /llms.txt — index with an ISO updatedDate on every entry line.
- /llms-full.txt — an index of the per-collection full-text files at /llms/ per
  `src/pages/llms/[collection].txt.ts`.
- .md sidecars per page, from `src/pages/[...slug].md.ts`.
- OG images rendered by satori at `src/pages/og/[...slug].png.ts`; template in
  `src/utils/og-template.mjs`; hash-keyed render cache in `src/utils/og-cache.mjs`.
- Search shards at /search-index- per `src/pages/search-index-[kind].json.ts`, ranked
  client-side by `public/search/index-model.mjs`.

## What updates when content changes

Nothing is hand-edited: every generator reads the collection list exported from
`site/src/content.config.ts`. One shared lastmod helper in `site/src/utils/lastmod.mjs` feeds
sitemap, feeds, sidecars and llms lines — omitted when an entry has no date, never
build-time. `scripts/machine.mjs` asserts: every public collection appears in every generator
(COLLECTION_BASES, from `site/src/utils/feeds.mjs`); feed coverage meets the per-kind floor;
sidecars exist for every route that should have one; and no noindex route leaks into an
index. llms derivation comes from the built routes minus the shared noindex set in
`site/src/utils/machine-text.mjs`.

Machine-surface noindex headers (feeds, llms, sidecars, search shards) are correct forever
and are written by `scripts/gen-headers.mjs`; they are not the Phase-5 preview noindex.

## Adding a collection or surface

A new collection touches four hand-lists plus endpoints: add-or-restore-a-collection.md.
