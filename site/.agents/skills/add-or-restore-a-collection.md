# Add or Restore a Collection

A new content collection touches four hand-lists plus endpoints. The gates fail when the
lists disagree, and `scripts/jsonld-gate.mjs` fails closed on an unknown route pattern.

## The four hand-lists

1. `scripts/machine.mjs` — COLLECTION_BASES, re-exported from FEED_BASES in
   `site/src/utils/feeds.mjs`: the collection's URL base, consumed by every machine
   generator. The gate asserts the new collection appears in llms, feeds and sitemap.
2. `scripts/templates.mjs` — ENTRY_PARENTS: the parent route whose leaves form one template
   family. Visual snapshots and the representative Lighthouse set derive from this list.
3. `scripts/jsonld-gate.mjs` — ROUTE_TYPES: the required JSON-LD node types per route
   pattern. An unlisted pattern is a failure, not a skip.
4. `site/content-facts.json` — one targetQuery row per route the collection emits.

## Plus

- The schema and the collections export in `site/src/content.config.ts`.
- A feed endpoint beside `src/pages/blog/rss.xml.ts`, mounted at the collection base.
- A search shard kind in `src/pages/search-index-[kind].json.ts` with its budget in
  `scripts/search-budget.mjs`.
- An llms section: the per-collection route `src/pages/llms/[collection].txt.ts` and the
  section list in `site/src/utils/llms-collections.mjs`.
- JSON-LD node builders in `site/src/utils/jsonld.mjs`, with an itemListElement list on the
  hub.
- Internal-only collections (author) go into the NON_PUBLIC set in `scripts/machine.mjs`
  instead, with no routes.

## Restore path — speaking (L21)

Speaking was deleted on 2026-09-12 and returns only when a real talk exists. To restore:
re-add the collection schema and its data directory, the speaking routes under `src/pages/`,
the nav links, the feed endpoint, the search shard, the Event node builders in
`site/src/utils/jsonld.mjs`, the four hand-lists above, and drop the name from NON_PUBLIC in
`scripts/machine.mjs`. A talk lands only with a confirmed row in `docs/COPY-CHECKLIST.md`;
nothing is invented to fill the hub.
