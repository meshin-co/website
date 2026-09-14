# Phase 4.5b · Human layer: navigation, standards, semantic core

Goal: a reader — human or crawler following links — can reach everything from everything.

1. **Breadcrumbs UI everywhere** (L29): the existing `Breadcrumbs.astro` wired on every page
   below home, sharing data with the JSON-LD trail; gate-extended to hubs.
2. **Pagination** (L30): `/blog` and category pages paginate at 12/page; page one canonical at
   the bare route; page 2+ noindex-follow with crawlable numbered links. At 4 posts no page 2
   renders, so pagination is proven inside the mutation-smoke repo copy (packet 7): a LIVE 13th
   post added in the copy forces page 2, the build is asserted to render it with the correct
   canonical and noindex-follow, and the copy is discarded. A draft specimen would never render.
3. **Tag pages** (L31, owner re-affirmed twice): `/blog/tag/{tag}` for every used tag plus
   `/blog/tags` index; all indexed and sitemapped; posts and PostCards render tags as links;
   tags stay in BlogPosting keywords. Tag vocabulary is a controlled list in
   `site/src/data/tags.mjs` — free-form tags in frontmatter fail the schema, so the tag space
   cannot drift into anarchy.
4. **Dead ends closed** (L32): every route linked from ≥1 other page; posts link up (blog,
   category, breadcrumbs) and sideways (prev/next within category, related-by-category, related
   resources); category pages linked from /blog hub, footer, and every post eyebrow; PostCard
   category becomes a link.
5. **Semantic core** (L33): `docs/SEMANTIC-CORE.md` — per-family tables GENERATED from
   `content-facts.json` at gate time (query, title pattern, meta pattern, H1, body intent,
   internal links); hand-authored columns only the *why* (business reason, PRD §) and the mapping
   of the 30 buyer prompts (PRD §17.3) to the routes that must win them, so the machine layer is
   designed against the questions LLMs actually get asked. A generated view cannot drift; no new
   drift gate. The title-pattern grammar is defined once (placeholder rules, lengths) in the
   generation script.
7. **Mutation smoke built for real** (L35): `site/scripts/mutation-smoke.mjs` and
   `site/tests/guard-mutations/fixtures/` from CG §3 finally exist. The smoke copies the repo to
   a temp dir, plants one violating specimen per guard family (zod refinements, budgets,
   JSON-LD gate, machine coverage, content gate, and the new L20–L28 guards), runs the gate
   there, and asserts a non-zero exit naming the offending field — restoring green afterwards.
   The pagination page-2 proof runs in the same copy. Every guard this phase adds is proven able
   to fail before CG-4.5b trusts it.

6. **Standards replaced** (L34): `site/.agents/skills/` — delete all 12 template-derived skills
   (not merely stale but rule-violating: `configure-contact-form.md` contradicts L6,
   `setup-decap-cms.md` describes a CMS this repo never had; rewriting docs for removed features
   is waste); the 4 keepers re-verified against L1–L34 before they survive; author the new set
   from procedures proven in phases 0–4: gate runbook, content-gate run, six-judge panel,
   add-a-collection-entry (which must name the four hand-lists a new collection touches:
   machine.mjs, templates.mjs, jsonld-gate ROUTE_TYPES, content-facts), machine-interface
   updates, representative-Lighthouse set, visual-baseline regeneration in the CI container,
   launch checklist. Classify the friction-log insights into these skills. AGENTS.md staleness
   fixed (rss.xml claim, Pagefind claim, jsonld.ts path); DECISIONS.md D9/D12 marked superseded;
   `config.yaml` dead blocks removed.

CG-4.5b: full gate re-run plus: linkinator crawl finds zero orphan routes; breadcrumb UI present
on all non-home routes; pagination proven via the live specimen in the smoke copy; semantic-core generation
green; skills lint (every skill names real files only); whole-site visual baselines regenerated
once at the end, per-template-family changelog entries.
