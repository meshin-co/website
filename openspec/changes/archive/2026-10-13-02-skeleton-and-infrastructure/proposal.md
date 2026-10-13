# Phase 1 · Skeleton and infrastructure

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
- Gate scripts: `site/scripts/routes-gate.mjs`, budget measurement, `lighthouserc.cjs` per L13,
  `.github/workflows/ci.yml` with the full gate.
- Cloudflare Pages project `meshin-co` → `meshin.pages.dev`, `noindex` until Phase 5. **Ask the
  owner for `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` at the end of this phase**; until
  they arrive every gate runs against the local production build.
- Stub `/` and `/404` with final structure and `TODO(copy)` text.

CG-1 routes: `/`, `/404`. Watch: font-swap CLS, zero CSP console violations, JS ≤10 KB gz.
