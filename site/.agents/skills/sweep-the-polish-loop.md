# Sweep the Polish Loop

`npm run audit:polish` drives a real Chromium over every route in `dist/gate-routes.json` at
320, 375, 768, 1024, 1280 and 1920 px and writes `audits/phase-5/polish-sweep.md`. Run it against
the gate server, never a dev server: a stale module graph reports a shipped style as absent.

    GATE_SERVER_PORT=4340 node scripts/gate-server.mjs dist &
    npm run audit:polish

## What it checks, and what it deliberately does not

Four mechanical checks: horizontal overflow of the document (tolerance 2 px for rounding),
interactive targets under 24 px, text clipped by its own box, and duplicate element ids. Contrast,
landmarks, focus order and ARIA are the axe pass in `npm test`; they are not repeated here.

The floor is **24 px, the WCAG 2.5.8 AA minimum**, not the 44 px AAA figure. The first run used 44
and produced 22,964 findings, nearly all of them inline links in sentences, which 2.5.8 exempts.
Visually hidden elements and links inline in prose are excluded, each with a test.

Logic lives in `scripts/polish-sweep.mjs` (classification and rendering, where the tests point);
`scripts/run-polish-sweep.mjs` drives the browser.

## Reading a result

A finding names the route, the width, the rule and the measurement. Fix the component, not the
route: every one of the 23,595 first-run findings collapsed into eight components.

First clean run 2026-09-15: 0 findings over 105 routes and 6 widths. Real defects it caught:
two blog posts overflowed at 320 px because a mobile single-column grid track sized to the
min-content of a wide table — the `lg:` columns used `minmax(0,…)` but the mobile track did not,
fixed with `min-w-0` on the prose column; and eight components shipped tap targets between 12 and
23 px tall.
