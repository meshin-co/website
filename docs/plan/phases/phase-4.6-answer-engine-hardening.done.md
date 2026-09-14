# Phase 4.6 · Answer-engine hardening

Goal: every route earns its snippet and its citation. Seven read-only audits (head and markup,
structured data, feeds and machine surfaces, the crawl graph, search, the semantic core, the
standards layer) found real gaps after CG-4.5b passed; this phase closes them and makes each fix
reproducible. Evidence: `audits/phase-4.6/`.

1. **Snippets and markup** (L42, L43): the full Twitter card set; FAQ descriptions rewritten to
   whole sentences inside 120–160 characters with a zod floor and a planted fixture; no
   mid-clause ellipsis in any title or description; `<article>` around every leaf body; visible
   published and updated `<time datetime>` on every dated family.
2. **Schema depth** (L44): `about`/`mentions` entity links to glossary terms, `citation` from the
   `sources` every collection already carries, `speakable`, `primaryImageOfPage`, `ImageObject`
   logo, `contactPoint`, `knowsAbout`, `HowTo` where content is genuinely step-by-step, and a
   JSON-LD gate that asserts required properties per family instead of node types alone.
3. **Feeds and crawler surfaces** (L45, L46): merged-feed per-kind floors honoured; per-collection
   feed, JSON Feed and `.md` sidecar advertised in every head; `lastmod` on hubs, static and
   taxonomy routes; unused sitemap namespaces dropped; the crawler register completed with a
   fixture test.
4. **Search parity** (L47): the shard catalogue derived from `STATIC_PAGE_CATALOG`, hub, category
   and tag kinds added, post text including its FAQ block, per-kind caps, and a fetch retry so one
   dropped request cannot disable search.
5. **Crawl graph**: tag trails include the `/blog/tags` level; related blocks and entity links on
   FAQ, glossary, resource and service leaves; the pagination guard extended to the category
   variant.
6. **Semantic core** (L48): regenerated over all 105 routes with buckets for the taxonomy
   families, the strategy fields added per family, the buyer-prompt claims mechanically
   re-verified, and a staleness check in `gate:content`.
7. **Standards** (L49): every uncaptured lesson written into a skill, the dead
   `references/banned-phrases.md` reference fixed, and the reproducibility checks wired into
   `check-skills.mjs`.

CG-4.6 is the standard gate plus: the new property-level JSON-LD assertions, the crawler fixture,
the search parity test, the semantic-core staleness check and the skills coverage check all green,
with `audits/phase-4.6/REPORT.md` generated.
