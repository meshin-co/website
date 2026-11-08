# Order a topic by hand

## Why

`workflow_dispatch:` of `.github/workflows/write-daily.yml` took no inputs, so the owner had no way
to ask the writer for a subject. The only levers were editing `docs/SEMANTIC-CORE.md` or
`loop.categoryRotation` and waiting for the next scheduled run.

The measurement in `investigation/09-what-the-demand-instruments-see.md` makes the gap matter. Across
all 13 versions of `audits/search-demand.md` the demand half of the picker produced 0 candidates on
every single one, because Search Console reports only queries the site already ranks for. The writer
has therefore fallen through to the semantic core on all six of its runs. Until a second demand
instrument exists, a hand order is the owner's only way to aim it.

## What changes

A fourth topic origin, `ordered`. One dispatch input names either a buyer-prompt number or an
article title; the picker resolves it, checks it exactly as it checks an automatic choice, and
writes it. A refused order ends the run with nothing written and no other topic tried, because
silently writing something else would be worse than writing nothing.

## Why this change is parked

`openspec/changes/44-retry-a-stopped-write` is in flight with 23 of 25 tasks ticked, and its last
task cannot be ticked before 2026-11-21: it reads 14 live UTC days of the retry it introduced. A
change with ticked boxes cannot be parked, so this one is, and the code it describes ships ahead of
its own spec delta. Row G80 of `docs/plan/reference/known-gaps.md` records that window and what
reads wrong inside it.
