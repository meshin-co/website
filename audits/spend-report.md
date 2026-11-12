# Spend report: what writing each entry cost

Generated-from: e32108df5d9bbf93421fbdc5eef34712c49f894b
Generated-at: 2026-11-12T16:17:57.323Z

## This month

2026-11 so far: 0.986518 USD spent of the 25.00 USD monthly ceiling, 24.013482 USD left.

The figure is the spend of the UTC calendar month of 2026-11-12T16:17:57.323Z, the instant stamped in Generated-at. It counts the ledgers and records committed in this repository: every call they show, whether it wrote an entry, repaired one or ended with no entry. The ceiling job also counts the spend on branches that are not merged yet, so the figure it stops on can be higher. This file does not change at the turn of the month: after the last run it still says what 2026-11 had spent at that instant.

| What was paid for               | Cost (USD) |
| ------------------------------- | ---------- |
| Writing calls of entries        | 0.538988   |
| Repair calls                    | 0.00       |
| Runs that ended with no entry   | 0.432568   |
| Spend with no generation record | 0.014962   |
| Everything paid for             | 0.986518   |

## About this file

This file is written by `npm run audit:spend` from the generation records and the ledgers under `audits/autowriter`. It is rewritten from them every time and never appended to. It reads no network. It reads the clock once, when it is written, and stamps that instant in Generated-at, so the same records and the same stamp give the same file. `npm run gate:autowriter` regenerates it with the stamp it finds and fails when this file differs.

Cost means the cost of the writing calls of an entry: its draft and its correction, each as its record stored it, added in whole micro-dollars. Repair is the cost of the repair calls that the record of the entry holds, and is not part of Cost. A draft that a run wrote and then skipped, a run that stopped before any entry existed and an attempt that a person discarded have no entry, so no row holds them. The ledgers record that spend, and the monthly spend ceiling counts it. The paid tables count every call the ledgers and the records show, and each call is in exactly one row: the writing calls of entries; every repair call, including a repair that failed; the runs that ended with no entry, which the Notes name; and the spend of a ledger that no generation record names, which the Warnings name. The four rows add up to the last row.

## This entry

The newest run: the run of the newest record, which was generated at 2026-11-12T16:17:57.319Z. A run that wrote an article and a term lists both.

| Generated (UTC)          | Format  | Slug                                  | Input tokens | Output tokens | Cost (USD) | Repair (USD) |
| ------------------------ | ------- | ------------------------------------- | ------------ | ------------- | ---------- | ------------ |
| 2026-11-12T16:17:57.319Z | article | how-can-boards-verify-ai-cost-savings | 14,568       | 4,151         | 0.035323   | 0.00         |

## Last 30 days

The 30 days of 24 hours each that end at the newest record: after 2026-10-13T16:17:57.319Z and through 2026-11-12T16:17:57.319Z. The start is excluded and the end is included, so an entry generated exactly at the start is outside the window. The window ends at the newest record and not at the clock, so this file does not change at midnight. Read long after the last run, it still describes the 30 days before that run. These 30 days are not the UTC calendar month of the monthly spend ceiling in `site/engine.config.json`: that ceiling counts calendar months and counts every call the machine paid for, not only the writing calls of entries. This table counts the writing calls of entries only.

| Format  | Entries | Input tokens | Output tokens | Cost (USD) |
| ------- | ------- | ------------ | ------------- | ---------- |
| all     | 11      | 219,313      | 63,935        | 0.538988   |
| article | 11      | 219,313      | 63,935        | 0.538988   |

## All time

Every entry recorded: from 2026-11-03T05:36:35.954Z, the oldest record, through 2026-11-12T16:17:57.319Z, the newest. The first table counts the writing calls of entries only. The second table adds every other call the machine paid for, so its last row is the whole spend the ledgers and records show.

| Format  | Entries | Input tokens | Output tokens | Cost (USD) |
| ------- | ------- | ------------ | ------------- | ---------- |
| all     | 11      | 219,313      | 63,935        | 0.538988   |
| article | 11      | 219,313      | 63,935        | 0.538988   |

| What was paid for               | Cost (USD) |
| ------------------------------- | ---------- |
| Writing calls of entries        | 0.538988   |
| Repair calls                    | 0.00       |
| Runs that ended with no entry   | 0.432568   |
| Spend with no generation record | 0.014962   |
| Everything paid for             | 0.986518   |

## Every entry

One row per generation record, newest first. The cost is the cost of its writing calls, and Repair is the cost of its repair calls.

| Generated (UTC)          | Format  | Slug                                                       | Input tokens | Output tokens | Cost (USD) | Repair (USD) |
| ------------------------ | ------- | ---------------------------------------------------------- | ------------ | ------------- | ---------- | ------------ |
| 2026-11-12T16:17:57.319Z | article | how-can-boards-verify-ai-cost-savings                      | 14,568       | 4,151         | 0.035323   | 0.00         |
| 2026-11-10T07:47:36.707Z | article | how-to-prevent-duplicate-ai-agent-actions-on-retries       | 25,588       | 6,612         | 0.058648   | 0.00         |
| 2026-11-09T07:11:10.445Z | article | how-to-trace-ai-agent-tool-calls-in-production             | 12,147       | 3,395         | 0.029122   | 0.00         |
| 2026-11-08T15:07:20.941Z | article | how-to-roll-back-an-ai-agent-deployment                    | 40,988       | 9,188         | 0.086928   | 0.00         |
| 2026-11-08T06:43:13.618Z | article | board-memo-ai-strategy-one-page                            | 10,370       | 3,371         | 0.027225   | 0.00         |
| 2026-11-07T11:51:35.921Z | article | ai-readiness-scorecard-five-drivers                        | 23,885       | 7,330         | 0.060535   | 0.00         |
| 2026-11-06T17:41:31.723Z | article | fractional-caio-pricing                                    | 10,373       | 3,301         | 0.026878   | 0.00         |
| 2026-11-05T11:03:18.146Z | article | build-vs-buy-ai-3-year-tco                                 | 23,994       | 7,793         | 0.062959   | 0.00         |
| 2026-11-05T05:59:43.308Z | article | ai-vendor-assessment-questionnaire-template                | 23,974       | 7,495         | 0.061449   | 0.00         |
| 2026-11-03T10:59:27.266Z | article | named-person-responsible-for-ai-risk-in-vendor-procurement | 10,130       | 4,190         | 0.03108    | 0.00         |
| 2026-11-03T05:36:35.954Z | article | ai-readiness-assessment-template-for-smb                   | 23,296       | 7,109         | 0.058841   | 0.00         |

## Rates

The model and the two rates, in USD per million tokens, that each cost was computed at. An earlier entry keeps the cost its record stored, so a change of rate adds a row and rewrites no history. First and Last are the instants of the first and the last entry priced at that rate.

| Model         | Input USD per million tokens | Output USD per million tokens | Entries | First                    | Last                     |
| ------------- | ---------------------------- | ----------------------------- | ------- | ------------------------ | ------------------------ |
| gpt-6.1-terra | 1                            | 5                             | 11      | 2026-11-03T05:36:35.954Z | 2026-11-12T16:17:57.319Z |

## Warnings

Each line below needs a person to look at it: it says what could not be counted or checked, or what does not add up. Every entry that can be counted is still counted above. The ledgers below that no generation record names are counted in the paid tables, under Spend with no generation record: 0.014962 USD together.

- how-to-allocate-shared-ai-tool-costs-across-departments: its ledger records a generation of 0.002838 USD (verdict: open) but no generation record names this ledger, so no entry is counted for it
- how-to-decide-which-employee-data-can-be-used-in-ai-tools: its ledger records a generation of 0.007573 USD (verdict: open) but no generation record names this ledger, so no entry is counted for it
- how-to-set-ai-chat-retention-rules: its ledger records a generation of 0.00316 USD (verdict: open) but no generation record names this ledger, so no entry is counted for it
- what-should-a-board-request-in-a-quarterly-ai-risk-report: its ledger records a generation of 0.001391 USD (verdict: open) but no generation record names this ledger, so no entry is counted for it

## Notes

These runs ended with no entry and together cost 0.432568 USD. That spend is in no entry row; the paid tables count it under Runs that ended with no entry. A note is not a warning: nothing a person does can clear it, because a run that ended will never gain a record.

- agentic-automation-consultant-for-b2b: this run ended on 2026-11-06 with the verdict escalated and left no generation record, so no entry is counted for it; its ledger records 0.061445 USD for the generation, and the monthly spend ceiling counts that cost
- ai-incident-response-plan-template: this run ended on 2026-11-06 with the verdict escalated and left no generation record, so no entry is counted for it; its ledger records 0.060008 USD for the generation, and the monthly spend ceiling counts that cost
- fractional-caio-vs-full-time-caio-cost: a person discarded this attempt on 2026-11-02 and its generation record went with it, so no entry is counted for it and its cost cannot be checked against a record; its ledger records 0.022748 USD for the generation, and the monthly spend ceiling counts that cost
- how-to-prevent-customer-data-from-entering-public-ai-tools: this run ended on 2026-11-09 with the verdict escalated and left no generation record, so no entry is counted for it; its ledger records 0.062991 USD for the generation, and the monthly spend ceiling counts that cost
- how-to-set-up-an-ai-launch-approval-process: this run ended on 2026-11-09 with the verdict escalated and left no generation record, so no entry is counted for it; its ledger records 0.061215 USD for the generation, and the monthly spend ceiling counts that cost
- iso-42001-gap-assessment: this run ended on 2026-11-06 with the verdict escalated and left no generation record, so no entry is counted for it; its ledger records 0.059851 USD for the generation, and the monthly spend ceiling counts that cost
- what-does-a-chief-ai-officer-do-in-a-50-person-company: this run ended on 2026-11-07 with the verdict escalated and left no generation record, so no entry is counted for it; its ledger records 0.10431 USD for the generation, and the monthly spend ceiling counts that cost
