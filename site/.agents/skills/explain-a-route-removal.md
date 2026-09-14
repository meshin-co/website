# Explain a Route Removal

The audited route list is derived from `dist/**/*.html`, never hand-authored (AGENTS.md hard
rules). `scripts/routes-gate.mjs` diffs the current derived list against the previous phase's
`audits/phase-N/routes.json` and fails the gate on any shrink it cannot account for.

## When a removal is legitimate

Only when the route is gone on purpose: a collection was retired (e.g. L21, speaking deleted
until a real talk exists), a duplicate route was collapsed, or a draft flipped from live to
`draft: true`. A route missing because a build broke, a content file was renamed without
updating a slug, or a throwaway preview page was deleted is not an explained removal — fix the
cause, do not paper over it here.

## The real file shape

`audits/phase-N/routes-removed.json` is a flat JSON array of route strings, nothing more:

    ["/speaking", "/speaking/example-talk"]

The gate's console message reads `add it to audits/phase-N/routes-removed.json with a reason` —
that wording is aspirational. `routes-gate.mjs` reads the array as `explainedSet` and never
stores or displays a reason field; there is no `{ route, reason }` object shape to write. Put the
actual reason in the commit message or the phase's `audits/phase-N/REPORT.md`, not in the file
itself.

## Procedure

1. Confirm the removal is intentional (see above).
2. Add the route string to `audits/phase-N/routes-removed.json` (create the array if the file is
   new for this phase).
3. Re-run `GATE_PHASE=phase-N npm run gate:routes`. `ROUTES UNEXPLAINED REMOVAL` clears; an entry
   for a route that is still built instead prints `ROUTES STALE EXPLANATION` — delete that entry,
   the route was never actually removed.
4. A stale explanation left in the file fails the gate exactly like an unexplained removal does;
   clean the file up in the same session that restores or renames the route.
