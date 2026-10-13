# Phase 4.5a · Machine layer: every surface complete

Goal: every machine reader — crawler, answer engine, feed subscriber — gets the whole site, whole.
Decided with the owner 2026-09-12; hardened after a six-frame ADHD review the same day (evidence:
`audits/phase-4.5/adhd/`). Owner re-affirmed under review: all tags indexed (L31), sharding built now
(L26), six per-collection feeds (L24).

1. **FAQ becomes a first-class collection** (L20). Schema gains the publishable base
   (publishDate, updatedDate, draft, noindex). Route per question `/faq/{slug}` owning the full
   answer and the only FAQPage+Question JSON-LD for that answer; the hub carries the question plus
   a one-line teaser linking the leaf — never the full answer, so no answer text lives on two
   URLs. FAQ routes use the static default OG. `.md` sidecars per leaf. Each new route gets its
   `content-facts.json` row (query = the question text). FAQ rich-results markup is deprecated by
   Google; the target is answer-engine retrieval, which punishes duplication hardest.
2. **Speaking is deleted** (L21): collection, route, nav links, llms entries, Event JSON-LD,
   sitemap. Returns the day a real talk exists, with `Event` nodes.
3. **Open Graph everywhere** (L22): `og-default.png` designed in the site lane and committed as a
   static asset (not a build artifact — no build-order coupling); `Metadata.astro` fails the build
   on a missing image; zod caps the OG-fed title length with a planted violating specimen;
   `og:image:alt` on every route; per-entry `ogImage`/`canonical` schema fields consumed by the
   templates; satori renders get a hash-keyed cache (title+category+updatedDate) so unchanged OG
   images are not re-rendered as routes grow.
4. **robots.txt repaired** (L23): per-bot groups inherit the `*` disallows; `Sitemap:` line;
   training crawlers (GPTBot, ClaudeBot, Google-Extended, CCBot, PerplexityBot) AND the retrieval
   UAs that actually produce citations (OAI-SearchBot, Claude-SearchBot, Claude-User,
   Perplexity-User) enumerated deliberately; per-UA fixture test in the gate; IndexNow ping fired
   from CI whenever the dist route set changes; Plausible gains an AI-referrer segment
   (chatgpt.com, perplexity.ai, copilot.microsoft.com) so 'always cited' has a feedback loop.
5. **Feeds** (L24): merged full-text `/rss.xml` sorting by `max(publishDate, updatedDate)` with a
   per-kind floor of 5 and no global cap (a 50-newest window is already wrong today: evergreen
   glossary+FAQ would permanently evict the posts); six per-collection feeds
   (`/blog/rss.xml`, `/glossary/rss.xml`, `/resources/rss.xml`, `/case-studies/rss.xml`,
   `/faq/rss.xml`, `/services/rss.xml`), each listing every live entry of its collection;
   `/feed.json` mirrors the merged feed; autodiscovery `<link rel="alternate">` in head; the
   machine gate asserts: every live entry in its collection feed, merged feed carries at least
   the per-kind floor of every kind — a gate greenable on day one.
6. **llms.txt surfaces** (L25): FAQ included; every entry line carries its ISO updatedDate (the
   one surface LLMs read first is currently freshness-blind); `/llms-full.txt` becomes an index of
   per-collection full-text files so the payload does not scale past what any consumer fetches;
   the STATIC_PAGES hand-list is replaced by derivation from dist minus a shared noindex set
   consumed identically by sitemap, llms and feed generators.
7. **Search covers everything, sharded now** (L26, owner re-affirmed): index FAQ Q&A, glossary
   definitions, service FAQs and deliverables, post takeaways, case problem/approach,
   static-page bodies; per-entry text cap; shard by kind (`/search-index-{kind}.json`); client
   fetches shards in parallel on first search, merges, ranks across kinds, groups results by kind
   with counts. Budgets: per-shard cap AND a global sum-of-shards cap (no N-times-64KB
   inflation); the rewritten budget test lands and is mutation-proven against the unchanged
   single-kind index BEFORE the new kinds are added, so the guard is never red-greened in the
   same commit as the data it guards; a defined overflow response per kind (tighten that kind's
   entry cap) is written into the search skill.
8. **JSON-LD completed** (L27): `Organization.logo` + `image`; BlogPosting gains `image`,
   `wordCount`, `inLanguage`, `mainEntityOfPage`; hubs emit `itemListElement` lists (the
   rich-results-readable form, not `mainEntity`) for blog, categories, glossary, resources,
   case-studies, services; `ContactPage` on /contact, `ProfilePage` on /about; glossary
   `DefinedTermSet` consistent across hub and term pages; personNode derived from the author
   collection (single source); resource nodes carry dates; `webPageNode` with `dateModified` on
   undated pages. Entity split resolved: Person → `github.com/meshin-dev`, Organization →
   `github.com/meshin-co`, explicit `sameAs` edge. The gate's ROUTE_TYPES covers every family and
   FAILS CLOSED on an unknown route pattern (today `?? []` silently skips); the Rich Results
   check runs per emitted family, not per page.
9. **Sitemap and freshness** (L28): one shared `lastmod()` helper (frontmatter date, omitted when
   absent, never build-time) consumed by sitemap, all feeds, sidecars and llms entries — the gate
   asserts per-entry agreement across surfaces; paginated hubs list page one only (page 2+ is
   noindex-follow, discovered via crawlable numbered links); no `rel prev/next` (ignored by
   Google since 2019); new routes included.

CG-4.5a: full gate re-run (no hand-counted route numbers in gate text — derived counts only) plus:
every feed validates and satisfies the day-one-greenable coverage rule; robots group semantics
tested per UA fixture; OG tags present on every route (grep gate); JSON-LD gate green over every
family with fail-closed coverage; search finds one term from every kind; sum-of-shards budget
green; IndexNow ping dry-run verified; Playwright baseline regeneration scoped to the new FAQ
template only (whole-site regen happens once, at the end of 4.5b).
