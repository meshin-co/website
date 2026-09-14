# Decision log

Closed. Do not reopen without a written replacement row.

Rows D1–D24 are the PRD §2 log, in English. Rows L1–L19 live in `docs/plan/reference/locked-decisions.md` and override
any D row they name. Where a D row below is marked *superseded*, read the L row instead.

| # | Topic | Decision | Why |
|---|---|---|---|
| D1 | Domain | `meshin.co` is the only canonical domain; `www` 301s to the apex | Owner holds it; LinkedIn points at it |
| D2 | Title | "Fractional Chief AI Officer". "CEO" only after a P&L engagement | A narrow wedge sells |
| D3 | Render | *Superseded by the PLAN §3 step-6 deviation*: `output: 'static'` (SSG), zero islands — the search index is build-time data fetched on first query, not a runtime | Indexability and budgets |
| D4 | View Transitions | `<ClientRouter />` removed from the layout | Incompatible with strict CSP; a content site does not need it |
| D5 | CSP | Strict CSP via `public/_headers`, no inline JS. JSON-LD is data, not executed script, so CSP does not block it | Best Practices 100 |
| D6 | Analytics | Plausible cloud, one async script under 1 KB | No cookies, so no consent banner |
| D7 | Fonts | Fraunces (display, 600/700) + IBM Plex Sans (text, 400/500) via the Astro Fonts API; monospace from the system stack | "Inter on white" is forbidden; ≤2 families, ≤4 weights |
| D8 | Color | OKLCH tokens, paper and ink plus one deep teal accent. Dark mode is its own palette, not an inversion | Design lane |
| D9 | Search | *Superseded by the PLAN §3 step-6 deviation and L26*: custom build-time index (`/search-index-{kind}.json` shards + `public/search/index-model.mjs`), fetched on first query | The Pagefind runtime failed in three wirings; sharded custom index is tested and cheaper |
| D10 | Calendar | Cal.com as a link in a new tab, never an embed | Zero third-party JS on the page |
| D11 | Forms | *Superseded by L6*: no form at all | Removes a vendor, a secret and the spam surface |
| D12 | Prices | *Superseded by L8*: not published; three fee shapes only (Assessment fixed fee · Sprint fixed scope · Retainer monthly) | Numbers are given on the fit call and written into the SOW |
| D13 | llms.txt | Own endpoints, no plugin | ~50 lines of code, full control |
| D14 | AI crawlers | Explicitly allowed: GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot, Bingbot | Visibility beats control |
| D15 | Hosting | *Extended by L16*: Cloudflare Pages, `meshin.pages.dev` first, apex at launch | TTFB, free, `_headers` support |
| D16 | Images | Local only, through `astro:assets`. Unpic and remote domains removed | Budget and control |
| D17 | Partytown | Removed | No third-party scripts besides Plausible |
| D18 | astro-compress | Kept as the template configures it (csso off, lightningcss on) | Already tuned for Tailwind v4 |
| D19 | Blog URLs | *Superseded by L31.* `/blog/{slug}`; categories at `/blog/category/{slug}`; tags at `/blog/tag/{slug}`, all indexed and sitemapped | Owner re-affirmed indexing tags twice under ADHD challenge |
| D20 | Russian version | Phase 6 at the earliest; English only until then | Focus |
| D21 | AstroWind v2 | Do not wait. Start on v1; migration is a separate project | v2 is a promise, not a release |
| D22 | Case studies | *Superseded by L10 and L11*: hub plus anonymized template, no metrics; artifact repos under `meshin-co` later | Honesty |
| D23 | Tone | Direct and engineering. No "leading", "expert", "passionate". Numbers and dates instead of adjectives | Buyer trust |
| D24 | Testimonials | None until real ones exist | Nothing invented |
