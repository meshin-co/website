# Run the Calibration Gate

Run at the end of every phase and before any merge to main. The procedure is `docs/plan/reference/calibration-gate.md`,
steps 1–11; this file is the command-level runbook. One exit code decides the merge.

## Order

Run from `site/`. Each step green before the next.

1. `npm run build` — chains `astro build`, `scripts/gen-headers.mjs dist` (CSP and cache headers)
   and `scripts/gate.mjs dist budgets.json` (byte budgets, route derivation).
2. `npm run check` — astro check, eslint, prettier. Run it before every push, including a
   Markdown-only commit: prettier checks `.md`, and `npm test` says nothing about formatting.
3. `npm test` — unit tests for `scripts/`, `src/utils/` and `src/data/`.
4. `npm run gate:html`, then `npm run gate:links` — html-validate, then linkinator with the
   plausible.io, linkedin.com, cal.com, github.com/meshin-co and meshin.co skips.
5. `npm run gate:content` — content Half A plus the semantic-core drift check
   (content-gate.md).
6. `npm run gate:orphans` — every route needs an inbound link; the exempt list in
   `scripts/orphan-gate.mjs` is closed and carries a reason per entry.
7. `npm run gate:machine`, then `npm run gate:jsonld` — machine-interface coverage (every
   indexable route must appear in `llms.txt`) and JSON-LD graph integrity (structured-data.md).
8. `npm run gate:skills` — skills lint: every path real, no forbidden claims, length caps.
9. `GATE_PHASE=phase-N npm run gate:routes` — writes `audits/phase-N/routes.json`, fails on an
   unexplained shrink or a stale `routes-removed.json` entry.
10. `npm run test:smoke` — every guard family plants a violating specimen in a repo copy and
    must fail naming the offending field (CG §3). About 40 s.
11. `npm run gate:lh` — Lighthouse mobile then desktop, 3 runs each, median, served through
    `scripts/gate-server.mjs` so the measurement carries production gzip and the real
    `_headers`. About 30 min locally; see the CI section for the parallel form.
12. `npm run gate:visual` — Playwright snapshots and axe, both themes (visual-baselines.md).
13. `node scripts/report.mjs <phase> ../audits/phase-<phase>` — generates REPORT.md from the raw
    JSON of the steps above. No waiver field, no "fix next phase".
14. `npm run gate:brand` — no code outside `src/data/` types the brand name; it derives via
    `src/utils/brand.mjs` or `SITE.name` from `astrowind:config`.

## In CI the same gates run in parallel

`build` runs once and uploads `dist`; `types-and-units`, `guard-mutations`, `cheap-gates`,
`visual-and-axe` (3 Playwright shards) and `lighthouse` (2 form factors x 4 route shards) fan out
from that artifact, and `gate-report` merges them. Whole gate: about 8 minutes. A docs-only commit
runs `types-and-units` alone (`changes` job classifies the diff).

One shard by hand:
`LHCI_FORM_FACTOR=mobile LH_SHARD_INDEX=1 LH_SHARD_TOTAL=4 npm run gate:lh:one`. Shards deal
routes round-robin (`scripts/lh-shards.cjs`), each binds port `4330 + index - 1` and writes
`lh-<factor>/shard-<index>/`. The report fails any audited route with no run or fewer than 3.

## Representative Lighthouse set

Lighthouse audits every unique page plus ONE leaf per repeated template family — the heaviest
by built bytes — because leaves of one template differ only in content, not in what Lighthouse
measures. The set is derived by `lighthouseSet()` in `scripts/gate.mjs`, exported into the
build output as `gate-routes.json`, and never hand-authored. Visual snapshots follow the same
family logic via `scripts/templates.mjs`.

## Known traps (docs/FRONTEND-EXCELLENCE-ISSUES.md)

- lhci has no `settings.preset`; form factors come from `formFactor` plus `screenEmulation`
  in `lighthouserc.cjs`.
- Two Lighthouse runs must never share an output directory. `gate:lh` clears it between form
  factors; a shard writes its own directory and binds its own port.
- Assert the North Star numbers, not 0.9x thresholds. A run at 97–99 re-runs three times, then
  the phase fails (L13).
- Plausible is blocked inside lab runs and verified by a separate live check. Blocking it still
  charges the simulated graph: see `diagnose-a-lighthouse-lcp-plateau.md`.
- A category score of 100 does not mean the metric assertions passed. `report.mjs` enforces the
  LCP, CLS and TBT budgets it reads from `lighthouserc.cjs` on each route's median run.
- A scratch page left in the build silently widens every downstream gate; delete throwaway
  routes before the audited build.
- perfect-coder strict mode refuses test, config and data-only files with no sibling test: create
  those with a shell heredoc (`docs/PERFECT-CODER-ISSUES.md`).

## Manual pass (calibration gate step 10)

320/375/768/1024/1280/1920 widths, `prefers-reduced-motion`, keyboard only, screen reader on the
primary task (find an offer → CTA; read an article). The read-aloud pass is the check word-count
guards cannot fake.
