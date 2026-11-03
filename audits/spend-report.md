# Spend report: what writing each entry cost

Generated-from: 3fa620f
Generated-at: 2026-11-03T01:59:21.912Z

## This month

2026-11 so far: 0.022748 USD spent of the 25.00 USD monthly ceiling, 24.977252 USD left.

The figure is the spend of the UTC calendar month of 2026-11-03T01:59:21.912Z, the instant stamped in Generated-at. It counts the ledgers and records committed in this repository: every call they show, whether it wrote an entry, repaired one or ended with no entry. The ceiling job also counts the spend on branches that are not merged yet, so the figure it stops on can be higher. This file does not change at the turn of the month: after the last run it still says what 2026-11 had spent at that instant.

| What was paid for               | Cost (USD) |
| ------------------------------- | ---------- |
| Writing calls of entries        | 0.00       |
| Repair calls                    | 0.00       |
| Runs that ended with no entry   | 0.022748   |
| Spend with no generation record | 0.00       |
| Everything paid for             | 0.022748   |

## About this file

This file is written by `npm run audit:spend` from the generation records and the ledgers under `audits/autowriter`. It is rewritten from them every time and never appended to. It reads no network. It reads the clock once, when it is written, and stamps that instant in Generated-at, so the same records and the same stamp give the same file. `npm run gate:autowriter` regenerates it with the stamp it finds and fails when this file differs.

Cost means the cost of the writing calls of an entry: its draft and its correction, each as its record stored it, added in whole micro-dollars. Repair is the cost of the repair calls that the record of the entry holds, and is not part of Cost. A draft that a run wrote and then skipped, a run that stopped before any entry existed and an attempt that a person discarded have no entry, so no row holds them. The ledgers record that spend, and the monthly spend ceiling counts it. The paid tables count every call the ledgers and the records show, and each call is in exactly one row: the writing calls of entries; every repair call, including a repair that failed; the runs that ended with no entry, which the Notes name; and the spend of a ledger that no generation record names, which the Warnings name. The four rows add up to the last row.

## No entry yet

No generation record could be counted, so this file holds no entry row, no entry total and no rate. That is the absence of a measurement. It is not a cost of zero. The figures of the month above count every call the ledgers show.

## Notes

These runs ended with no entry and together cost 0.022748 USD. That spend is in no entry row; the paid tables count it under Runs that ended with no entry. A note is not a warning: nothing a person does can clear it, because a run that ended will never gain a record.

- fractional-caio-vs-full-time-caio-cost: a person discarded this attempt on 2026-11-02 and its generation record went with it, so no entry is counted for it and its cost cannot be checked against a record; its ledger records 0.022748 USD for the generation, and the monthly spend ceiling counts that cost
