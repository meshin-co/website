# Run the Calibration Gate

Run at the end of every phase and before any merge to main. The procedure is
`docs/plan/reference/calibration-gate.md`, steps 1–11; this is the command-level runbook.

## Order, each step green before the next, run from `site/`

1. `npm run build` — chains `astro build`, `scripts/gen-headers.mjs dist` (CSP and cache headers)
   and `scripts/gate.mjs dist budgets.json` (byte budgets, route derivation).
2. `npm run check` — astro check, eslint, prettier. Run it before every push, including a
   Markdown-only commit: prettier checks `.md`, and `npm test` says nothing about formatting.
3. `npm test` — unit tests for `scripts/`, `src/utils/` and `src/data/`.
4. `npm run gate:html`, then `npm run gate:links` — html-validate, then linkinator; third-party
   hosts are skipped by `THIRD_PARTY_HOSTS` in `scripts/links-gate.mjs`.
5. `npm run gate:content` — content Half A plus the semantic-core drift check (content-gate.md).
6. `npm run gate:orphans` — every route needs an inbound link; the exempt list in
   `scripts/orphan-gate.mjs` is closed and carries a reason per entry. Generated tables come from
   `scripts/markdown-table.mjs`, already prettier-shaped; a script that can be both imported and run
   decides which it is through `scripts/invoked-directly.mjs`, which resolves symlinks.
7. `npm run gate:machine`, then `npm run gate:jsonld` — machine-interface coverage (every
   indexable route must appear in `llms.txt` or a `/llms/` file) and JSON-LD graph integrity (structured-data.md).
8. `npm run gate:skills` — skills lint: every path real, no forbidden claims, length caps.
9. `npm run gate:routes` — compares the build against `audits/routes.json`, fails on an unexplained
   removal or a stale `routes-removed.json` entry, and never writes the ledger; `npm run assets:routes` does.
10. `npm run test:smoke` — every guard family plants a violating specimen in a repo copy and
    must fail naming the offending field (CG §3). About 5 min.
11. `GATE_PHASE=<bucket> npm run gate:lh` — mobile then desktop, 3 runs each, median, served by
    `scripts/gate-server.mjs`. A run naming no bucket refuses. About 30 min; CI runs it sharded.
12. `npm run gate:visual` — Playwright snapshots and axe, both themes (visual-baselines.md).
13. `node scripts/report.mjs <bucket> ../audits/phase-<bucket>` — generates REPORT.md from the raw
    JSON above, into the folder step 11 wrote: `collect-reports.mjs` files every run under
    `audits/phase-$GATE_PHASE/`. No waiver field, no "fix next phase".
14. `npm run gate:brand` — no code outside `src/data/` types the brand name; it derives via
    `src/utils/brand.mjs` or `SITE.name` from `astrowind:config`.
15. `npm run gate:paid` — no route loads a third-party origin `scripts/third-party.mjs` does not
    declare free, and no page's analytics copy disagrees with the beacon the build ships (L58).

## Lighthouse is the local half, and a push proves it ran

Steps 11–13 above run on a quiet machine, never in CI (L59). The procedure, the record it writes
and the pre-push refusal: `prove-lighthouse-ran-locally.md`.

## In CI the same cheap gates run in parallel

`build` runs once and uploads `dist`; `types-and-units`, `guard-mutations`, `cheap-gates` and
`visual-and-axe` (3 Playwright shards) fan out from it; a docs-only commit runs `types-and-units`
alone. One shard by hand: `GATE_PHASE=<bucket> LHCI_FORM_FACTOR=mobile LH_SHARD_INDEX=1
LH_SHARD_TOTAL=4 npm run gate:lh:one`; shards deal routes round-robin (`scripts/lh-shards.cjs`),
bind port `4330 + index - 1`, write `shard-<index>/`.

## Representative Lighthouse set

Lighthouse audits every unique page plus ONE leaf per repeated template family — the heaviest by
built bytes, since leaves differ only in content. `auditableRoutes()` in `scripts/lh-routes.cjs`
derives the set from `dist/**/*.html`, never from `gate-routes.json`; `/styleguide` is excluded.
Visual snapshots follow the same families (`scripts/templates.mjs`).

## Known traps (docs/FRONTEND-EXCELLENCE-ISSUES.md)

- lhci has no `settings.preset`; form factors come from `formFactor` plus `screenEmulation` in
  `lighthouserc.cjs`.
- Two Lighthouse runs must never share an output directory. `gate:lh` clears it between form
  factors; a shard writes its own directory and binds its own port.
- Assert the North Star numbers, not 0.9x thresholds. A run at 97–99 re-runs three times, then the
  phase fails (L13).
- A category score of 100 does not mean the metric assertions passed: `report.mjs` enforces the
  LCP, CLS and TBT budgets from `lighthouserc.cjs` on each route's median run, and lhci asserts the
  best run by default, so every rule in `lighthouserc.cjs` goes through `onMedian`.
- A scratch route left in the build widens every downstream gate; delete throwaways first.
- Lighthouse measures the machine. Run shards alone, logs outside `/tmp`: on 2026-10-02 four
  desktop shards beside a baseline regeneration took 2h37m and all failed, then passed singly in
  four minutes each. Under load it reads as a regression (0.99, TBT over budget).
- `Generated-from:` must name a commit that exists in a fresh clone. A squash merge replaces every
  commit on the branch, so a report naming the branch commit it came from fails `gate:evidence` on
  `main` the moment that branch is merged and deleted. This cost two red runs on 2026-10-24. Name
  the commit the branch started from, or repoint the line in a follow-up commit.

## Manual pass (calibration gate step 10)

320/375/768/1024/1280/1920 widths, `prefers-reduced-motion`, keyboard only, screen reader on the
primary task (find an offer → CTA; read an article) — the check word-count guards cannot fake.
