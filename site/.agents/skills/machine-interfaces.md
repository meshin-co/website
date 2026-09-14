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
- /llms-full.txt — the actual full body text of every collection, concatenated section by
  section from `src/pages/llms-full.txt.ts` using the same `toLlmsEntry()` mapping as
  `/llms/{collection}.txt` (`src/pages/llms/[collection].txt.ts`), which stays the per-kind
  view. A 2 MB byte guard in `scripts/machine.mjs` fails loudly instead of letting the file
  grow unbounded unnoticed.
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

## Feeds, sitemap and crawler register

`src/utils/machine-text.mjs`'s `mergeWithKindFloor` guarantees every kind reaches
`min(floor, live count)` in the merged `/rss.xml` — proven mathematically (the top-up loop
scans the full recency-sorted list per kind, not a windowed slice, so it cannot exhaust before
quota) and pinned by a regression test in `machine-text.test.mjs` built from this site's real
date skew (25 same-day FAQ entries vs. 30 older glossary entries). A kind that clears its floor
only (glossary, most days) is not a bug: the merged feed is a recency sample, not a mirror, and
its own per-collection feed carries every entry in full — which is why every hub and leaf page
must advertise its collection feed, the JSON Feed and its `.md` sidecar in `<head>` (MetaAndMarkup
owns the actual `<link>` tags; ask this section's owner for the exact set).

`src/utils/sitemap-lastmod.mjs`'s `siteLastmods()` is the single call `astro.config.ts`'s
sitemap `serialize` uses, layered in this order (later wins): `collectionLastmods` (per-entry
leaf routes, from frontmatter), `staticPageLastmods` (the file named in `STATIC_PAGE_CATALOG`'s
`file` field, dated by `git log -1 --format=%aI` — never `fs.mtime`, which is checkout wall
time under a shallow CI clone and would violate the "never build-time" lastmod rule), `hubLastmods`
(a collection hub's date is its newest LIVE entry, e.g. `/faq`), and `taxonomyLastmods`
(`/blog/category/{slug}`, `/blog/tag/{slug}` and `/blog/tags`, via `liveTopicMap` over live
posts only — a draft's date never leaks into a hub or taxonomy date). A route with zero live
backing content (an unused category) gets no key anywhere in this chain, and `scripts/machine.mjs`
correctly does not require one — it calls the same `siteLastmods()` as the source of truth for
which routes must carry a `<lastmod>`, so the gate can never drift from the generator. The
sitemap's `namespaces: { news: false, image: false, video: false }` option in `astro.config.ts`
drops the three unused Google sitemap extensions; `xhtml` stays on since nothing rules it out,
but nothing in this phase populates `image`, `video` or `news`, so there is nothing to keep them for.

`public/robots.txt` is generated, never hand-edited: `npm run assets:robots`
(`scripts/gen-robots.mjs`) after changing `TRAINING_AGENTS`, `RETRIEVAL_AGENTS` or
`SEARCH_AGENTS`, then commit the regenerated file — `gen-robots.test.mjs` fails the build if
the committed file and the generator output ever diverge. Every group repeats the `*` group's
disallows verbatim; the register exists to make silence about a named crawler impossible, not
to differentiate policy per agent. `gen-robots.test.mjs` pins the exact ordered agent list as a
fixture — add a new agent to the right category array and to that fixture's expected list in
the same change.
