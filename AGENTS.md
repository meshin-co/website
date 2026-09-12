# meshin.co

Astro 7 static site for a Fractional Chief AI Officer practice. The Astro app is in `site/`.

## Read order

1. `docs/PLAN.md` — the phased build plan and the locked decisions (L1–L19). Start here.
2. `docs/PRD.md` — the full requirements spec. `docs/PLAN.md` §1 overrides it where they differ.
3. `docs/DECISIONS.md` — the closed decision log.
4. `skill://frontend-excellence` — all UI work. Load at most 3 references at a time via its
   routing tables.
5. `skill://perfect-coder` — all source code. Minimal viable change, test-first, per-language
   size caps.

## Hard rules

- Every phase ends with the Calibration Gate in `docs/PLAN.md` §3. No merge without a green gate
  and a generated `audits/phase-N/REPORT.md`. There is no waiver path and no "fix next phase".
- Lighthouse must read 100/100/100/100 on mobile and desktop for every audited route. A run at
  97–99 is re-run up to three times, then it is a failure.
- Blocking budgets, measured from the shipped build and never from a config file: JS ≤10 KB gz,
  CSS ≤20 KB gz, page ≤250 KB without images, fonts ≤120 KB across 2 families and 4 weights,
  CLS ≤0.02, LCP ≤1.8 s mobile.
- Client JavaScript is limited to Plausible, the theme toggle, and Pagefind loaded on search
  focus. No `ClientRouter`, no islands beyond Pagefind, no third-party embeds, no cookies.
- No contact form, no Pages Function, no Resend. `/contact` is an email address plus a Cal.com
  button. No newsletter anywhere.
- The route lists are derived from `dist/**/*.html`, never hand-authored. Cheap gates (content, links, budgets,
  machine interfaces, JSON-LD) run on every route. Lighthouse audits every unique page plus ONE leaf per repeated
  template family — the heaviest by built bytes — because leaves of one template differ only in content, not in
  what Lighthouse measures.
- From Phase 3 on, every template is gated against its heaviest real content entry, never
  placeholder text.
- Every guard (zod refinement, CSP directive list, byte budget) has a planted violating specimen
  and is proven to fail before it is trusted.
- Content rules: every post, glossary term and service carries `shortAnswer`, `updatedDate` and at
  least one source. Zod enforces it and the build fails otherwise.
- Never invent an owner fact, a client name, a metric, a testimonial or a credential. Unknown
  facts become `TODO(owner)` and go on the copy checklist.
- Copy tone: direct and engineering. Numbers and dates instead of adjectives. No "leading",
  "expert", "passionate".
- Design lane: "engineering brief" — Fraunces plus IBM Plex Sans, paper and ink with one deep
  teal accent in OKLCH. No gradients, no stock imagery, no purple.
- Structured data: one JSON-LD `@graph` per page from `src/utils/jsonld.ts`. Every node has an
  `@id`, every referenced `@id` resolves, and CI validates it.
- Machine interfaces (`/llms.txt`, `/llms-full.txt`, `/{page}.md`, `/feed.json`, `/rss.xml`,
  `/og/*.png`, sitemap) are build outputs. Verify them in `dist/`, not in source.
- Ask Context7 about Astro 7, Tailwind v4, Pagefind and satori APIs before relying on memory.

## Commands

```
cd site
npm run build      # production build, the only build Lighthouse may measure
npm run check      # astro check, eslint, prettier
npm run preview    # serve dist for local gate runs
```
