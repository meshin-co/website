# Run the Growth Loop

Phase 6 repeats every two weeks after launch. It is a fixed sequence, not a judgement call, and
it touches only the routes the new content creates or changes.

## The sequence

1. **Add the entry.** `add-collection-entry.md` for each new article or resource. Zod refuses an
   entry without `shortAnswer`, `updatedDate` and a source, so the build is the first gate.
2. **Write the copy.** `write-copy.md` before any string exists, `place-a-new-text.md` before a
   new page, and `disposition-a-text.md` for every string the pass touches. One concept stays
   defined on exactly one page (L50, L51, L53).
3. **Wire the machine layer.** `structured-data.md` and `machine-interfaces.md`. Both are build
   outputs: verify them in `dist/`, never in source.
4. **Regenerate the registers.** `semantic-registers.md`. The generator owns
   `docs/SEMANTIC-CORE.md`'s register blocks; hand-editing them fails `gate:registers`.
5. **Run the cheap gates on the changed routes.** `run-the-gate.md`, cheap half only: `html`,
   `links`, `content`, `orphans`, `machine`, `jsonld`, `registers`, `editorial`, `docs`, plus
   budgets. Minutes, not the full matrix.
6. **Run the full gate only when a template changed.** New content on an existing template does
   not change what Lighthouse measures; a template edit does. The rule is in
   `calibration-gate.md`, and the CI diff classifier applies the same distinction.
7. **Refresh the baselines** if the visual output moved, per `visual-baselines.md`, and optionally
   add a `docs/VISUAL_CHANGELOG.md` entry recording why.
8. **Re-baseline the buyer prompts** monthly, not fortnightly: `baseline-the-buyer-prompts.md`
   writes `audits/geo-baseline.md`, and the number only moves when routes or passages change.

## What ends a cycle

Every cheap gate at 0, the editorial ledger with no `unreviewed` row, and one commit per article
rather than one per fortnight. A cycle that cannot name the routes it changed has no business
running the gate.
