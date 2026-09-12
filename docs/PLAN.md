# meshin.co v2 — Phased Build Plan

Derived from `docs/PRD v2 · meshin.co` (single source of requirements), plus the owner decisions
locked in this session and the hardening rules that survived two ADHD passes.

Read order for any work on this repo: this file, then the PRD, then `skill://frontend-excellence`
(≤3 references at a time), then `skill://perfect-coder`.

---

## 1. Locked decisions that override or extend the PRD

The PRD's decision log (§2, D1–D24) stands except where a row below replaces it. These are closed.

| # | Decision | Value | Replaces |
|---|---|---|---|
| L1 | Repo layout | Astro app in `/site`; `docs/` beside it; git root at repo root | new |
| L2 | Git remote | `git@github.com:meshin-co/website.git` (private, currently empty) | new |
| L3 | Owner identity | `Dmitri Meshin`, `https://www.linkedin.com/in/meshin/`, company `https://www.linkedin.com/company/144892973`, `https://github.com/meshin-dev`, `https://cal.com/meshin` | §1 TODO(owner) |
| L4 | Google verification | TXT `google-site-verification=JzDVNYl7fyNlWq2UAtXGzgKmxjemBpi44BYH1_ahKgY` on `meshin.co`, DNS-only | §1 TODO(owner) |
| L5 | No ctxr references | No `ctxr-dev`, no npm `@ctxr` anywhere on the site or in schema `sameAs` | D22 partial, §11.6 |
| L6 | Contact | No form, no Pages Function, no Resend, no honeypot. `/contact` = email `hello@meshin.co` + Cal.com button | D11 |
| L7 | Newsletter | Dropped entirely: no `/newsletter`, no footer signup, no "notify me" fields, no Buttondown | §1, §7.1, §9.5 |
| L8 | Prices | Not published anywhere on the site. Three fee shapes only: Assessment fixed fee · Sprint fixed scope quoted once · Retainer monthly. Numbers are given on the fit call and written into the SOW. Replaces the earlier L8 (public $5,000/$25,000/$12,000), closed 2026-09-12 after owner review | §1, earlier L8 |
| L9a | Hero | Home hero is the "editorial ledger": unchanged H1 and sub, two CTAs, then a three-cell monospace offer ledger (2 weeks / 90 days / 1–2 days a week) with no dollar figures, no spec card. Numbered section labels ("01", "02"…) and figure-number chips removed from every page and component. No "meshin.co" written inside page copy | new, 2026-09-12 |
| L10 | Resource artifacts | Pages link to `https://github.com/meshin-co/<slug>`; repos are created by the owner later; `linkinator` skips that host prefix until they exist | D22 |
| L11 | Case studies | `/case-studies` ships as a hub plus the anonymized-case template, zero metrics, no invented client | D22 |
| L12 | Credential line | "ISO/IEC 42001 Lead Implementer (in progress)", no date; `hasCredential` stays out of Person schema until awarded | §4.5 |
| L13 | Lighthouse bar | Hard 100/100/100/100 mobile **and** desktop. A run at 97–99 is re-run up to 3 times; still under 100 = phase fails. No waiver file, no footnoted pass | §11.8, §14.9 |
| L14 | Tests | Logic units (zod refinements, JSON-LD builders, machine-interface endpoints, OG text) **plus** Playwright visual snapshots per page template | new |
| L15 | Enforcement | `perfect-coder` strict for `.ts`, shadow for `.astro`/`.md` (`/.perfect-coder/config.yml`) | new |
| L16 | Hosting | Deploy to `meshin.pages.dev` from Phase 1; Cloudflare API token requested from owner at the end of Phase 1; apex `meshin.co` attached at Phase 5 | D15 |
| L17 | Apex state | The old Cloudflare redirect from `meshin.co` to Google Calendar was removed by the owner; apex now serves nothing until Phase 5 | new |
| L18 | Copy handoff | Work stops after Phase 3 with a written copy checklist for the owner; Phase 4 copy starts only after that comes back | §14 |
| L19 | Resource slugs | `ai-governance-starter-kit`, `ai-readiness-scorecard`, `agent-evals-ci-starter`, `llm-gateway-governance-config`, `build-vs-buy-ai-kit` | §14 Phase 4 |

Verified facts behind these: Astro `7.3.1`, Tailwind `4.3.3`, template `@arthelokyo/astrowind@1.0.0-beta.66`
(Astro 7 + Tailwind v4, `engines.node >=22.22.3`), `pagefind 1.5.2`, `satori 0.33.4`,
`@resvg/resvg-js 2.6.2`, `@lhci/cli 0.15.1`. `cal.com/meshin` returns 200. `meshin.co` MX is
ProtonMail (nothing to change; no mail sending needed after L6). SEO/GEO skills are installed.

---

## 2. What each phase must not do

Rejected as overengineering after the ADHD passes. Written down so they do not creep back in:

- No dependency-DAG replacement for the phase order. Phases stay linear.
- No calibration gate on every file write, and no pre-push hook running Lighthouse.
- No automated rollback infrastructure or signed build manifests.
- No content-hash honesty check on `updatedDate`, no filler-word density metric.
- No full-page HTML snapshot tests, no OCR of OG images (compare satori's text nodes instead).
- No third-party service beyond Plausible. No cookies. No client framework.

---

## 3. Calibration Gate (CG) — one procedure, run at the end of every phase

Steps 1–11 all run. A step that cannot run yet (edge checks before the first deploy) is skipped
only by the rule that names it, never by judgement.

1. `npm run build && npm run check` — zero errors, zero warnings.
2. `scripts/gate/routes.mjs` — enumerate every `dist/**/*.html`, write
   `audits/phase-N/routes.json`, diff against the previous phase's file. The audited route list is
   **derived, never hand-authored**. An unexplained shrink fails the gate.
3. Lighthouse CI over a **representative list derived from `dist/`**: every unique page plus ONE
   leaf per repeated template family, chosen as the heaviest by built bytes (`lighthouseSet` in
   `scripts/gate.mjs`, exported into `dist/gate-routes.json`). Leaves of one template differ only
   in content, not in what Lighthouse measures, so auditing 100 posts proves what auditing one
   heaviest post proves. Mobile and desktop, `numberOfRuns: 3`, median. The gate asserts the
   results array really has 3 runs before trusting any score. Bar per L13.
4. `axe-core` on every derived route, light and dark → 0 violations.
5. `html-validate` 0 errors · `linkinator` 0 broken (skip list: `plausible.io`, `linkedin.com`,
   `github.com/meshin-co`) · byte budgets in range.
6. Byte budgets are measured, not declared: real gzip of every JS/CSS asset each route can reach,
   plus a Playwright pass that toggles the theme and runs a real search so Plausible, the toggle
   and the lazily-fetched search index are all charged to a route. Budgets: JS ≤10 KB gz,
   CSS ≤20 KB gz, page ≤250 KB without images, fonts ≤120 KB. No route carries an exception.
   **Deviation from the PRD, decided in Phase 3:** search is not Pagefind. Pagefind's runtime
   boots a Web Worker that reported `Failed to load Pagefind metadata` without ever requesting
   the metadata file, in three separate wirings (its own `astro-pagefind` component, a bundled
   module, and a plain static module), while the same calls from a page console worked. Instead,
   `/search-index.json` is generated from the same collections at build time (25 KB raw, 7 KB gz,
   fetched only on the first query) and ranked by `public/search/index-model.mjs`, which is unit
   tested. `/search` now costs 1.1 KB gz of JS like every other route, and the search behaviour
   itself is covered by `tests/search.spec.ts`.
7. JSON-LD: every page's `@graph` parses, and every `@id` referenced anywhere resolves to exactly
   one node that declares it. Rich Results test on one page per type.
8. Machine-interface parity: `/llms.txt`, `/llms-full.txt`, `/feed.json`, sitemap and `.md`
   sidecars are generated from the collection list read out of the content config, and the gate
   asserts every public collection appears in every generator. Sitemap contains no noindex route.
9. Playwright visual snapshots per page template at `1440x900` and `375x812`, light and dark.
   Snapshot updates require an entry in `docs/VISUAL_CHANGELOG.md` in the same commit.
10. Manual pass: 320/375/768/1024/1280/1920 widths, `prefers-reduced-motion`, keyboard only,
    screen reader on the primary task (find an offer → CTA; read an article).
11. `audits/phase-N/REPORT.md` is **generated** from the raw JSON of steps 2–9. There is no waiver
    field and no "fix next phase" field. One exit code decides merge.

Two rules that make a fake-green gate hard:

- **Real content from Phase 3 on.** Each template is gated against its heaviest real entry (most
  words, most images), never a lorem placeholder. A template whose only entry is placeholder text
  is not gate-eligible.
- **Guards must be provable.** Every zod refinement, plus the CSP directive list and each byte
  budget, has a planted violating specimen under `site/tests/guard-mutations/fixtures/` (outside
  `src/content/`). Once per gate, `scripts/gate/mutation-smoke.mjs` copies the repo to a temp dir,
  drops one bad fixture per collection, runs `astro build` there, and asserts a non-zero exit that
  names the offending field. A guard never proven red is not trusted.

Edge checks (only after the first Pages deploy exists): fetch the deployed preview and assert the
real `Content-Security-Policy` response header, not the source of `public/_headers`. Cloudflare can
add or merge headers; the file is not the artifact.

---

## 4. Phases

### Phase 0 · Initialization

Goal: a scaffolded, committed repo whose template builds untouched, with a recorded baseline.

- `git init` at repo root, remote `meshin-co/website`, branch `main`, first commit with `docs/`.
- `npm create astro@latest -- --template arthelokyo/astrowind site`; Node from `.nvmrc` (22).
- `npm i && npm run build` in `/site` — prove the template builds as shipped.
- Baseline Lighthouse of the untouched template → `audits/phase-0/baseline/`.
- `/.perfect-coder/config.yml`: `mode: shadow`, `languages: { typescript: strict }`.
- `AGENTS.md` (PRD Appendix I, adjusted for L1–L19), `CLAUDE.md` → pointer to `AGENTS.md`.
- `docs/DECISIONS.md` = PRD §2 plus the L-table above. `audits/`, `docs/VISUAL_CHANGELOG.md`.
- CI in build-only mode; gates switch on in Phase 1.

Exit: template builds, baseline captured, decisions committed. No CG (nothing of ours is built).

### Phase 1 · Skeleton and infrastructure

Goal: an empty site at 100×4 with strict CSP, real budgets, and CI that blocks regressions.

- Strip the template to zero per PRD §11.2 and L5–L7: remove `ClientRouter`, Partytown, Unpic,
  GA, `astro-seo` demo wiring, embeds, `flat-color-icons`, all demo pages and demo posts, all
  hosting files for other platforms. Build stays green after each removal.
- `src/config.yaml` (PRD §11.4), `src/navigation.ts` — header: Services, Approach, Resources,
  Blog, About + "Book a call"; footer: Services / Resources / Company / Legal + `sameAs` (L3).
- Fonts: Fraunces 600/700 + IBM Plex Sans 400/500 via the Astro Fonts API, latin subset, metric
  fallbacks. OKLCH tokens from PRD §10.2 in `CustomStyles.astro` and the Tailwind `@theme`.
- `Layout.astro` head per §11.5, skip link, `<main id="main">`, footer. Plausible only.
- `public/_headers` (PRD Appendix G, `form-action 'none'` since L6 removes forms), `robots.txt`,
  `security.txt`, `humans.txt`, favicons, temporary `og-default.png`.
- Gate scripts: `scripts/gate/routes.mjs`, budget measurement, `lighthouserc.cjs` per L13,
  `.github/workflows/ci.yml` with the full gate.
- Cloudflare Pages project `meshin-co` → `meshin.pages.dev`, `noindex` until Phase 5. **Ask the
  owner for `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` at the end of this phase**; until
  they arrive every gate runs against the local production build.
- Stub `/` and `/404` with final structure and `TODO(copy)` text.

CG-1 routes: `/`, `/404`. Watch: font-swap CLS, zero CSP console violations, JS ≤10 KB gz.

### Phase 2 · Design system and home page

Goal: the visual language is fixed in tokens and components; `/` is final.

- Frame per `frontend-excellence` §1: audience (PRD §6), everything indexable, "engineering brief"
  lane (PRD §10.1), SSG.
- Components (PRD §10.4) reusing AstroWind widgets: Hero, Signals, ServiceCards, StepsTimeline,
  ResourceCard, CaseMetrics, PostCard, AnswerBlock, KeyTakeaways, TOC, FAQ (`<details>`),
  AuthorBox, Sources, CTA, Header/Footer, SearchBox (Pagefind, lazy on focus).
- `/styleguide`, noindex, out of sitemap: every component in every state, both themes. This is the
  widget inventory the later gates diff against.
- States: hover, `focus-visible`, active, disabled, reduced motion, dark mode checked on its own.
- Build `/` to PRD §9.1 with Appendix A copy and L8 prices.
- First Playwright visual baselines.

CG-2 routes: `/`, `/styleguide`, `/404`. Load `design.md`, `components.md`, `responsive.md`.
Run polish-loop phases 3, 11, 12. Contrast checked in both themes.

### Phase 3 · Content model, templates, machine interfaces

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

### Phase 4 · Core content

Goal: the site is worth indexing.

- Finish all copy from PRD Appendix A using the returned checklist. Nothing invented: no client
  names, no metrics, no testimonials.
- Resource pages for the five L19 slugs, each linking to its future repo (L10).
- Articles for PRD §15 weeks 2–4, to the §9.6 template and Appendix J checklist.
- Glossary to 30 terms, FAQ to 25. `/resources/sample-readiness-report`.
- Citability pass on every article with the SEO skills.

CG-4: all new routes plus every earlier route re-run (regression, not just new work). Extra:
`cspell`, paragraph and measure check, ≥2 inbound internal links per article.

### Phase 5 · Launch

Goal: public, indexed, measured.

- Full 19-phase polish loop over every route; `pre-launch.md` checklist; self-improvement
  checklist all "yes".
- Attach apex `meshin.co` to Pages, `www` → apex 301, remove `noindex`, keep L4 TXT record.
- Sitemap to GSC and Bing, IndexNow ping, Plausible goals (`book_call`, `download_resource`),
  LinkedIn person and company pointing at the site.
- Baseline the 30 buyer prompts (PRD §17.3) → `audits/geo-baseline.md`.

CG-5 runs against the production URL, not a preview.

### Phase 6 · Growth (repeating, every two weeks)

Articles and resources per PRD §15; refresh old posts with `updatedDate` and "What changed";
monthly buyer prompts and `/now`; quarterly polish loop, dependency review, AstroWind v2 check.
RU section only after ≥10 English articles and the first lead. Every PR runs the same CG on its
changed routes.

---

## 5. Test strategy (L14)

Written first, red before green, per `perfect-coder` §3.

| Unit | Test proves | Not tested |
|---|---|---|
| zod refinements | Each boundary rejects just outside and accepts just inside (39/40/60/61 words, 155/156 chars, date order, 0/1 sources) | that zod itself works |
| content pipeline | A planted bad fixture makes `astro build` exit non-zero and name the field | per-file frontmatter shapes |
| `jsonld.ts` builders | Emitted graph has one node per `@id`, every reference resolves, no fabricated fields | exact JSON key order |
| machine interfaces | Every public collection appears in `llms.txt`, `llms-full.txt`, `feed.json`, sitemap; `.md` sidecar exists per page with a sidecar | byte-for-byte file content |
| OG images | Rendered text nodes carry the entry's real title and category; PNG within budget | pixel appearance |
| page templates | Playwright visual snapshot per template, two viewports, two themes | class names, node counts, entry counts |

No test asserts a config file exists or parses. Budgets and CSP are asserted against measured
bytes and real response headers.

---

## 6. Risk register

| Risk | Why it bites | Mitigation in this plan |
|---|---|---|
| Gate route list rots as pages are added | New templates ship unaudited while the dashboard shows 100 | CG step 2 derives routes from `dist/` |
| Placeholder content flatters CLS/LCP | Real variable-length copy in Phase 4 breaks a layout that was never stressed | Real heaviest entry per template from Phase 3 |
| Budgets proven once on the empty shell | Cumulative additions overflow by Phase 5 | CG step 6 re-measures every phase, including the lazy Pagefind chunk |
| CSP verified in source, weakened at the edge | Best Practices 100 is a pre-deploy claim only | Edge header check after first deploy |
| A guard that cannot fail | Refinements exist but never reject | Planted specimens + mutation smoke per gate |
| Owner facts unavailable | Invented credentials or metrics | L11, L12, copy checklist handoff, `TODO(owner)` |
| Word-count refinements gamed by padding | Schema-valid, semantically empty content | Human read-aloud check in CG step 10; citability pass in Phase 4 |
