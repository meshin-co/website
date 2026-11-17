# Blocked

Parked behind `44-retry-a-stopped-write`, whose task 8.4 reads 14 live UTC days of the retry it
introduced and cannot be ticked before 2026-11-21. A change with ticked boxes cannot be parked, so
this change is the one that waits.

Queue: `44-retry-a-stopped-write` is in flight, then `45-order-a-topic-by-hand`, then
`46-write-from-measured-keyword-demand`, then `47-license-the-resources-and-stop-promising-repositories`,
then `48-publish-the-evals-baseline-specification`, then this change. The delta here adds requirements to
`governance/unattended-publishing`, the capability 45 modifies a requirement of, and it adds, so nothing in
45 to 48 forces an order and this change follows them in the order in which it was opened. Its modifying
deltas for `governance/spend-reporting`, `discovery/search-demand` and the existing requirements of
`governance/unattended-publishing` are not written yet (task 9.3).

Gap rows: G106 in `docs/plan/reference/known-gaps.md` records the window of this change, and G80 the
hold-up behind 44 that it shares with 45 to 48.
