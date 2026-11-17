# Blocked

Parked behind `44-retry-a-stopped-write`, whose task 8.4 reads 14 live UTC days of the retry it
introduced and cannot be ticked before 2026-11-21. A change with ticked boxes cannot be parked, so
this change waits with the three before it.

Queue: `44-retry-a-stopped-write` is in flight, then `45-order-a-topic-by-hand`, then
`46-write-from-measured-keyword-demand`, then `47-license-the-resources-and-stop-promising-repositories`,
then this change. The delta here adds a requirement to `content/collection-schemas`, the same capability
47 modifies, so this change follows 47 and nothing in the other two deltas forces the rest of the order.

Gap rows: G92 and G93 in `docs/plan/reference/known-gaps.md` record what this change leaves open, and
G80 the hold-up behind 44 that it shares with 45, 46 and 47.
