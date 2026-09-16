# Phase 6 · Growth (repeating, every two weeks)

Articles and resources per PRD §15; refresh old posts with `updatedDate` and "What changed";
monthly buyer prompts and `/now`; quarterly polish loop, dependency review, AstroWind v2 check.
English only: no second language, ever (L54).

## The procedure

`site/.agents/skills/run-the-growth-loop.md` is the ordered sequence: add the entry, write the
copy, wire the machine layer, regenerate the registers, run the cheap gates on the changed routes,
and run the full gate only when a template changed. Follow it; a cycle that improvises is a cycle
whose evidence nobody can reproduce.

## What each cycle must produce

- One commit per article or resource, never one per fortnight.
- Every cheap gate at 0, including `npm run gate:docs`, and no `unreviewed` row in the editorial
  ledger.
- A `docs/VISUAL_CHANGELOG.md` entry in the same commit as any visual change.
- `audits/geo-baseline.md` refreshed monthly, not fortnightly: the number only moves when a route
  or a passage changes.

## What ends the phase

Nothing. Phase 6 repeats. It has no `.done.md`, and the index row stays `planned` until the first
cycle runs, then becomes `active` and stays there.

---
