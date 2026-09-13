# Run the Calibration Gate

Run at the end of every phase and before any merge to main. The procedure is `docs/PLAN.md` §3,
steps 1–11; this file is the command-level runbook. One exit code decides the merge.

## Order

Run from `site/`. Each step green before the next.

1. `npm run build` — chains `astro build`, `scripts/gen-headers.mjs dist` (writes the CSP and
   cache headers into the output) and `scripts/gate.mjs dist budgets.json` (byte budgets, route
   derivation).
2. `npm run check` — astro check, eslint, prettier.
3. `npm test` — unit tests for `scripts/`, `src/utils/` and `src/data/`.
4. `npm run gate:html`, then `npm run gate:links` — html-validate, then linkinator with the
   plausible.io, linkedin.com, cal.com, github.com/meshin-co and meshin.co skips.
5. `npm run gate:machine`, then `npm run gate:jsonld` — machine-interface coverage and JSON-LD
   graph integrity (machine-interfaces.md).
6. `node scripts/content-gate.mjs dist` — content Half A (content-gate.md).
7. `node scripts/check-skills.mjs` — skills lint: every path real, no forbidden claims,
   length caps.
8. `npm run gate:lh` — Lighthouse mobile then desktop, 3 runs each, median; the collector
   asserts the runs really happened before trusting any score.
9. `npm run gate:visual` — Playwright snapshots and axe, both themes (visual-baselines.md).
10. `node scripts/report.mjs` — generates the phase REPORT.md under `audits/phase-N/` from the
    raw JSON of steps 2–9. No waiver field, no "fix next phase".

## Representative Lighthouse set

Lighthouse audits every unique page plus ONE leaf per repeated template family — the heaviest
by built bytes — because leaves of one template differ only in content, not in what Lighthouse
measures. The set is derived by `lighthouseSet()` in `scripts/gate.mjs`, exported into the
build output as `gate-routes.json`, and never hand-authored. Visual snapshots follow the same
family logic via `scripts/templates.mjs`.

## Known traps (docs/FRONTEND-EXCELLENCE-ISSUES.md)

- lhci has no `settings.preset`; form factors come from `formFactor` plus `screenEmulation`
  in `lighthouserc.cjs`.
- Mobile and desktop runs must not share an output directory; `gate:lh` clears the Lighthouse
  output dir between them and collects each factor separately — keep that structure.
- Assert the North Star numbers, not 0.9x thresholds. A run at 97–99 re-runs up to three
  times, then the phase fails (L13).
- Plausible is blocked inside lab runs and verified by a separate live check.
- A scratch page left in the build silently widens every downstream gate; delete throwaway
  routes before the audited build.

## Manual pass (PLAN §3 step 10)

320/375/768/1024/1280/1920 widths, `prefers-reduced-motion`, keyboard only, screen reader on
the primary task (find an offer → CTA; read an article). The read-aloud pass is the check
that word-count guards cannot fake.

## perfect-coder friction (docs/PERFECT-CODER-ISSUES.md)

Strict mode refuses test, config and data-only files it cannot see a sibling test for — create
those with a shell heredoc and continue; plugin state is home-side and never committed.
