# Calibration Gate (CG) — one procedure, run at the end of every phase

Steps 1–11 all run. A step that cannot run yet (edge checks before the first deploy) is skipped
only by the rule that names it, never by judgement.

1. `npm run build && npm run check` — zero errors, zero warnings.
2. `site/scripts/routes-gate.mjs` — enumerate every `dist/**/*.html`, write
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
   `cal.com`, `github.com/meshin-co`, `apps.apple.com`, `^https://meshin.co`) · byte budgets in range.
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
  `src/content/`). Once per gate, `site/scripts/mutation-smoke.mjs` copies the repo to a temp dir,
  drops one bad fixture per collection, runs `astro build` there, and asserts a non-zero exit that
  names the offending field. A guard never proven red is not trusted.

Edge checks (only after the first Pages deploy exists): fetch the deployed preview and assert the
real `Content-Security-Policy` response header, not the source of `public/_headers`. Cloudflare can
add or merge headers; the file is not the artifact.

---
