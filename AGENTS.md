# meshin.co

Astro 7 static site for a Fractional Chief AI Officer practice. The Astro app is in `site/`.

## Read order

1. `docs/PLAN.md` — the phased build plan and the locked decisions (L1–L35). Start here.
2. `docs/PRD.md` — the full requirements spec. `docs/PLAN.md` §1 overrides it where they differ.
3. `docs/DECISIONS.md` — the closed decision log.
4. `site/.agents/skills/` — the repeatable procedures for this repo: running the gate, adding a
   collection entry, restoring a collection, regenerating visual baselines, the judge panel, the
   content gate, the machine interfaces and the launch checklist. Read the matching one before
   doing that job by hand.
5. `docs/SEMANTIC-CORE.md` — which title, meta description and target query each route family
   carries and why, plus the 30 buyer prompts mapped to the routes that must win them. Read it
   before writing or editing any page copy, title or meta description.
6. `skill://frontend-excellence` — all UI work. Load at most 3 references at a time via its
   routing tables.
7. `skill://perfect-coder` — all source code. Minimal viable change, test-first, per-language
   size caps.

## Hard rules

- Every phase ends with the Calibration Gate in `docs/PLAN.md` §3. No merge without a green gate
  and a generated `audits/phase-N/REPORT.md`. There is no waiver path and no "fix next phase".
- Lighthouse must read 100/100/100/100 on mobile and desktop for every audited route. A run at
  97–99 is re-run up to three times, then it is a failure.
- Blocking budgets, measured from the shipped build and never from a config file: JS ≤10 KB gz,
  CSS ≤20 KB gz, page ≤250 KB without images, fonts ≤120 KB across 2 families and 4 weights,
  CLS ≤0.02, LCP ≤1.8 s mobile.
- Client JavaScript is limited to Plausible, the theme toggle, and the lazy search-index
  fetch on first query (custom build-time index, `public/search/index-model.mjs`; no
  third-party search runtime). No `ClientRouter`, no islands, no third-party embeds, no
  cookies.
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
- Design lane: "engineering brief" — Fraunces, IBM Plex Sans and IBM Plex Mono (3 families,
  98 KB gz, a documented deviation from the 2-family rule), paper and ink with one deep teal
  accent in OKLCH. No gradients, no stock imagery, no purple. No numbered section labels and no
  figure-number chips anywhere.
- Structured data: one JSON-LD `@graph` per page from `site/src/utils/jsonld.mjs`. Every node has
  an `@id`, every referenced `@id` resolves, and CI validates it.
- Machine interfaces (`/llms.txt`, `/llms-full.txt`, `/llms/{collection}.txt`, `/{page}.md`,
  `/feed.json`, `/rss.xml` plus six per-collection feeds, `/og/*.png`, search shards, sitemap)
  are build outputs. Verify them in `dist/`, not in source.
- Ask Context7 about Astro 7, Tailwind v4 and satori APIs before relying on memory.

## Commands

```
cd site
npm run build      # production build, the only build Lighthouse may measure
npm run check      # astro check, eslint, prettier
npm run preview    # serve dist for local gate runs
npm run gate:lh    # both form factors, all audited routes, ~30 min
npm run test:smoke # every guard family proven able to fail, ~40 s
```

CI runs the same gates as a parallel graph: one build, then check+units,
guard-mutations, cheap gates, Playwright (3 shards) and Lighthouse
(2 form factors x 4 route shards) in parallel, merged by `gate-report`.
A single shard locally: `LHCI_FORM_FACTOR=mobile LH_SHARD_INDEX=1 LH_SHARD_TOTAL=4 npm run gate:lh:one`.
