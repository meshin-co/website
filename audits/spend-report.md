# Spend report: what writing each entry cost

Generated-from: 3fa620f

This file is written by `npm run audit:spend` from the generation records and the ledgers under `audits/autowriter`. It is rewritten from them every time and never appended to. It reads no clock and no network, so the same records give the same file on any day. `npm run gate:autowriter` regenerates it and fails when this file differs.

Cost means the cost of the writing calls of an entry: its draft and its correction, each as its record stored it, added in whole micro-dollars. A repair call is not a writing call and is not counted here. A draft that a run wrote and then skipped, and a run that stopped before any entry existed, have no entry and are not counted here either. The ledgers record that spend, and the monthly spend ceiling counts it.

## No entry yet

No generation record could be counted, so this file holds no row, no total and no rate. That is the absence of a measurement. It is not a cost of zero.

## Warnings

These lines say what could not be counted or checked. Every entry that can be counted is still counted above.

- fractional-caio-vs-full-time-caio-cost: a person discarded this attempt on 2026-11-02 and its generation record went with it, so no entry is counted for it and its cost cannot be checked against a record; its ledger records 0.022748 USD for the generation, and the monthly spend ceiling counts that cost
