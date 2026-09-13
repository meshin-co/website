# Launch Checklist (Phase 5)

The plan of record is `docs/PLAN.md` Phase 5. CG-5 runs against the production URL, not a
preview. Nothing here happens before 4.5b is green.

## Before the flip

- Full polish loop over every route; the pre-launch and self-improvement checklists read all
  "yes".
- Whole-site visual baselines regenerated once at the end of 4.5b, with
  `docs/VISUAL_CHANGELOG.md` entries per template family.

## The flip

1. Attach the apex `meshin.co` to the Cloudflare Pages project; `www` 301s to the apex; keep
   the L4 verification TXT record, DNS-only.
2. Remove the preview noindex that Phase 1 put on `meshin.pages.dev`, then verify the live
   robots meta and response headers on the production URL — the deployed header is the
   artifact, not the source file. The machine-surface noindex rules in
   `scripts/gen-headers.mjs` (feeds, llms files, sidecars, search shards) stay.
3. Submit the sitemap to Google Search Console and Bing.

## After the flip

- IndexNow: CI pings whenever the built route set changes (`scripts/indexnow-ping.mjs`,
  wired in `.github/workflows/ci.yml`); confirm the key file answers on the production host.
- Plausible: create the goals `book_call` and `download_resource`, and the AI-referrals
  segment from `docs/COPY-CHECKLIST.md` §9 — referrers chatgpt.com, perplexity.ai,
  copilot.microsoft.com, gemini.google.com — so answer-engine citations get a feedback loop.
- LinkedIn person and company pages point at the site.
- Baseline the 30 buyer prompts (`docs/PRD.md` §17.3) into a geo report under
  `audits/phase-N/` once the phase directory exists.

## Standing rules that survive launch

No prices on the site (L8); no invented facts — `docs/COPY-CHECKLIST.md` rows only; every
future change re-runs the same gate on its changed routes (Phase 6).
