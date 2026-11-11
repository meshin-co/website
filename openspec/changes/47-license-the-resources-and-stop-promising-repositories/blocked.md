# Blocked

Parked behind `44-retry-a-stopped-write`, whose task 8.4 reads 14 live UTC days of the retry it
introduced and cannot be ticked before 2026-11-21. A change with ticked boxes cannot be parked, so
this change is the one that waits.

Queue: `44-retry-a-stopped-write` is in flight, then `45-order-a-topic-by-hand`, then
`46-write-from-measured-keyword-demand`, then this change. 45 and 46 both change the origin requirement of
`generated-articles`, and 46 replaces the origin list of 45, so their order is fixed. The delta here changes
a requirement of `content/collection-schemas`, which none of the three touches, so the order of this change
behind them is the order in which it was opened and nothing in the deltas forces it.

Gap rows: G86 in `docs/plan/reference/known-gaps.md` records the window of this change, and G80 the
hold-up behind 44 that it shares with 45 and 46.
