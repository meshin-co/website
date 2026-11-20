# Blocked

Parked behind `44-retry-a-stopped-write`, whose task 8.4 reads 14 live UTC days of the retry it
introduced and cannot be ticked before 2026-11-21. A change with ticked boxes cannot be parked, so
this change is the one that waits.

Queue: `44-retry-a-stopped-write` is in flight, then `45-order-a-topic-by-hand`, then
`46-write-from-measured-keyword-demand`, then `47-license-the-resources-and-stop-promising-repositories`,
then `48-publish-the-evals-baseline-specification`, then this change, in the order they were opened.

Overlap: 44 and 45 each modify requirements of `governance/unattended-publishing`; 46 modifies
`content/generated-articles`; 47 and 48 touch `content/collection-schemas`. The delta written so far adds
requirements to `governance/unattended-publishing` and modifies none, so it overlaps nothing. Task 9.3 owes
the modifying deltas for `governance/unattended-publishing`, `governance/spend-reporting` and
`discovery/search-demand`; once they exist, the requirements they modify must be read after 44 and 45 have
archived, because those two rewrite the same capability.

Gap rows: G106 in `docs/plan/reference/known-gaps.md` records the window of this change, and G80 the
hold-up behind 44 that it shares with 45 to 48.
