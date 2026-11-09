# Run the Growth Loop

Phase 6 repeats every two weeks after launch. It is a fixed sequence, not a judgement call, and
it touches only the routes the new content creates or changes.

## The sequence

1. **Choose the article.** `choose-the-next-article.md`. Run `npm run gate:demand` first: a stale
   report is refreshed with `npm run audit:demand`. Take the signal and its number from
   `audits/search-demand.md`, before any entry or string exists, and put both in the commit message. When it holds no
   lead, a phrase of `audits/keyword-demand.md` that has an exact Bing impression and no route may be the choice,
   most impressions first, ahead of a category (L69).
2. **Add the entry.** `add-collection-entry.md` for each new article or resource. Zod refuses an
   entry without `shortAnswer`, `updatedDate` and a source, so the build is the first gate.
3. **Write the copy.** `write-copy.md` before any string exists, `place-a-new-text.md` before a
   new page, and `disposition-a-text.md` for every string the pass touches. One concept stays
   defined on exactly one page (L50, L51, L53).
4. **Wire the machine layer.** `structured-data.md` and `machine-interfaces.md`. Both are build
   outputs: verify them in `dist/`, never in source.
5. **Regenerate the registers.** `semantic-registers.md`. The generator owns
   `docs/SEMANTIC-CORE.md`'s register blocks; hand-editing them fails `gate:registers`.
6. **Run the cheap gates on the changed routes.** `run-the-gate.md`, cheap half only: `html`,
   `links`, `content`, `orphans`, `machine`, `jsonld`, `registers`, `editorial`, `docs`, plus
   budgets. Minutes, not the full matrix.
7. **Run the full gate only when a template changed.** New content on an existing template does
   not change what Lighthouse measures; a template edit does. The rule is in
   `calibration-gate.md`, and the CI diff classifier applies the same distinction.
8. **Refresh the baselines** if the visual output moved, per `visual-baselines.md`, and optionally
   add a `docs/VISUAL_CHANGELOG.md` entry recording why.
9. **Re-baseline the buyer prompts** monthly, not fortnightly: `baseline-the-buyer-prompts.md`
   writes `audits/geo-baseline.md`, and the number only moves when routes or passages change.

## What ends a cycle

Every cheap gate at 0, the editorial ledger with no `unreviewed` row, and one commit per article
rather than one per fortnight, its message naming the signal and the number that chose it. A cycle
that cannot name the routes it changed has no business running the gate.
