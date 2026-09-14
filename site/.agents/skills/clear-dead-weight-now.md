# Clear Dead Weight Now

Found dead weight is removed in the session that found it, never deferred to a note, a TODO, or
a follow-up phase (PLAN.md L40). "Dead weight" means: a component or export nothing imports, a
stale visual baseline for a route or state that no longer exists, a JSON-LD builder no page
calls, an npm script nothing invokes, or any file whose only purpose was a step already
superseded.

## Why immediate, not deferred

A note ("clean this up later") is a promise a later phase almost never keeps, and every phase
after the one that found it pays the carrying cost: extra stylesheet or bundle bytes, a longer
`npm run check`, a wider surface `gate:skills` and the byte-budget gate have to reason about, and
a reader who has to work out whether the stale thing is still load-bearing before touching
anything near it.

## Procedure

1. When you notice something unreferenced while doing other work, confirm it is actually dead:
   grep for imports/callers, check it is not a generated artifact, check it is not the one-off
   asset-regeneration class of script (`scripts/generate-favicons.mjs`,
   `scripts/generate-og-default.mjs`) that is legitimately invoked by hand rather than from code.
2. Delete it in the same change, inside your own file ownership. If the dead file is outside your
   ownership for this wave, name it to the owning agent over `hub` instead of deleting it
   yourself — the rule is "cleared this session," not "cleared by whoever finds it regardless of
   ownership."
3. State what you removed and why in your report; do not silently shrink a diff without saying
   so.

## Scope

This rule is about things nothing references, not about things that are merely small, ugly, or
overengineered. Do not use it to justify a rewrite or a restructuring outside the task at hand —
that is scope creep with a different name.
