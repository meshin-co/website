# Explain a Route Removal

The audited route list is derived from `dist/**/*.html`, never hand-authored (AGENTS.md hard
rules). `audits/routes.json` is the ledger: the route set the repository currently claims.
`npm run gate:routes` (`scripts/routes-gate.mjs`) compares the build against it, never writes it,
and fails on any removal it cannot account for. `npm run assets:routes` writes the ledger from the
build. Run it in the commit that changes the route set, additions included: a route the ledger
never recorded can disappear without failing the gate.

## When a removal is legitimate

Only when the route is gone on purpose: a collection was retired (e.g. L21, speaking deleted
until a real talk exists), a duplicate route was collapsed, or a draft flipped from live to
`draft: true`. A route missing because a build broke, a content file was renamed without
updating a slug, or a throwaway preview page was deleted is not an explained removal — fix the
cause, do not paper over it here.

## The real file shape

`audits/routes-removed.json` is a flat JSON array of route strings, nothing more:

    ["/speaking", "/speaking/example-talk"]

`routes-gate.mjs` reads the array as `explainedSet` and never stores or displays a reason field;
there is no `{ route, reason }` object shape to write. Put the actual reason in the commit
message, not in the file itself.

## Procedure

1. Confirm the removal is intentional (see above).
2. Add the route string to `audits/routes-removed.json`.
3. Re-run `npm run gate:routes`. `ROUTES UNEXPLAINED REMOVAL` clears; an entry for a route that is
   still built instead prints `ROUTES STALE EXPLANATION` — delete that entry, the route was never
   actually removed.
4. Run `npm run assets:routes` and commit the new `audits/routes.json` together with the
   explanation and the work that removed the route.
5. A stale explanation left in the file fails the gate exactly like an unexplained removal does;
   clean the file up in the same session that restores or renames the route.
