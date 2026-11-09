# Blocked

Parked behind `44-retry-a-stopped-write`, whose task 8.4 reads 14 live UTC days of the retry it
introduced and cannot be ticked before 2026-11-21. A change with ticked boxes cannot be parked, so
this change is the one that waits. It also queues behind `45-order-a-topic-by-hand`, which waits for the
same reason, and both carry a delta to the origin requirement of `generated-articles`: archive 44,
then 45, then this one, so the origin list of this delta, which names `ordered`, replaces the one of 45.

Gap row: G80 in `docs/plan/reference/known-gaps.md`.
