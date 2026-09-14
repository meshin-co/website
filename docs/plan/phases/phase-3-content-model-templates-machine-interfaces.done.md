# Phase 3 · Content model, templates, machine interfaces

Goal: every page type renders and every machine interface is correct; site is functionally complete
with minimal real content.

- `src/content.config.ts` per PRD §8, with the word-count and date refinements. Boundary fixtures
  and the RED/GREEN proof for each refinement land **before** the schema (test-first, L14).
- Templates: PostLayout, ServicePage, ResourcePage, CasePage, GlossaryTermPage, CategoryHub,
  FaqPage, ProfilePage, plus `/pricing`, `/approach`, `/contact` (L6), `/ai-policy`, `/security`,
  `/now`, `/speaking`, legal pages.
- `src/utils/jsonld.ts` — one `@graph` per page, node builders per PRD Appendix D, `@id`
  integrity test.
- Endpoints: `llms.txt.ts`, `llms-full.txt.ts`, `feed.json.ts`, `[...slug].md.ts`,
  `og/[...slug].png.ts` (satori + resvg; assert rendered text nodes, not file existence), sitemap
  filter and `lastmod`. All generators read the collection list from the content config.
- Rehype/remark chain: slug, autolink headings, external links, mermaid → SVG at build time,
  expressive-code. Pagefind postbuild, `/search`, `data-pagefind-body` on `<main>`.
- Minimum real content: 1 post, 3 services, 1 resource, `/case-studies` hub + anonymized template
  (L11), 10 glossary terms, 20 FAQ entries, `/about`.
- Apply the SEO and GEO skills (schema, technical, llms.txt, crawlers) and fix everything found.

CG-3 routes: the full derived list (~20 routes). Extra: JSON-LD valid everywhere, `.md` sidecars
200, `llms.txt` valid, `feed.json` valid, sitemap free of noindex routes.

**Stop after CG-3.** Deliver `docs/COPY-CHECKLIST.md`: every fact only the owner can supply
(timeline years and roles, only.help numbers if they exist, credential status, speaking history,
`/now` content, resource contents). Phase 4 starts when it comes back filled.
