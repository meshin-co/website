# Spend report: what writing each entry cost

Generated-from: d6af106
Generated-at: 2026-11-24T06:24:36.499Z

## This month

2026-11 so far: 2.532098 USD spent of the 25.00 USD monthly ceiling, 22.467902 USD left.

The figure is the spend of the UTC calendar month of 2026-11-24T06:24:36.499Z, the instant stamped in Generated-at. It counts the ledgers and records committed in this repository: every call they show, whether it wrote an entry, repaired one or ended with no entry. The ceiling job also counts the spend on branches that are not merged yet, so the figure it stops on can be higher. This file does not change at the turn of the month: after the last run it still says what 2026-11 had spent at that instant.

| What was paid for               | Cost (USD) |
| ------------------------------- | ---------- |
| Writing calls of entries        | 1.945752   |
| Repair calls                    | 0.00       |
| Runs that ended with no entry   | 0.533207   |
| Spend with no generation record | 0.053139   |
| Everything paid for             | 2.532098   |

## About this file

This file is written by `npm run audit:spend` from the generation records and the ledgers under `audits/autowriter`. It is rewritten from them every time and never appended to. It reads no network. It reads the clock once, when it is written, and stamps that instant in Generated-at, so the same records and the same stamp give the same file. `npm run gate:autowriter` regenerates it with the stamp it finds and fails when this file differs.

Cost means the cost of the writing calls of an entry: its draft and its correction, each as its record stored it, added in whole micro-dollars. Repair is the cost of the repair calls that the record of the entry holds, and is not part of Cost. A draft that a run wrote and then skipped, a run that stopped before any entry existed and an attempt that a person discarded have no entry, so no row holds them. The ledgers record that spend, and the monthly spend ceiling counts it. The paid tables count every call the ledgers and the records show, and each call is in exactly one row: the writing calls of entries; every repair call, including a repair that failed; the runs that ended with no entry, which the Notes name; and the spend of a ledger that no generation record names, which the Warnings or the Waiting for a record section names. The four rows add up to the last row.

## This entry

The newest run: the run of the newest record, which was generated at 2026-11-22T15:45:19.079Z. A run that wrote an article and a term lists both.

| Generated (UTC)          | Format  | Slug                                                | Input tokens | Output tokens | Cost (USD) | Repair (USD) |
| ------------------------ | ------- | --------------------------------------------------- | ------------ | ------------- | ---------- | ------------ |
| 2026-11-22T15:45:19.079Z | article | how-to-deploy-ai-agent-updates-with-canary-releases | 36,262       | 7,082         | 0.071672   | 0.00         |

## Last 30 days

The 30 days of 24 hours each that end at the newest record: after 2026-10-23T15:45:19.079Z and through 2026-11-22T15:45:19.079Z. The start is excluded and the end is included, so an entry generated exactly at the start is outside the window. The window ends at the newest record and not at the clock, so this file does not change at midnight. Read long after the last run, it still describes the 30 days before that run. These 30 days are not the UTC calendar month of the monthly spend ceiling in `site/engine.config.json`: that ceiling counts calendar months and counts every call the machine paid for, not only the writing calls of entries. This table counts the writing calls of entries only.

| Format  | Entries | Input tokens | Output tokens | Cost (USD) |
| ------- | ------- | ------------ | ------------- | ---------- |
| all     | 33      | 844,892      | 220,172       | 1.945752   |
| article | 33      | 844,892      | 220,172       | 1.945752   |

## All time

Every entry recorded: from 2026-11-03T05:36:35.954Z, the oldest record, through 2026-11-22T15:45:19.079Z, the newest. The first table counts the writing calls of entries only. The second table adds every other call the machine paid for, so its last row is the whole spend the ledgers and records show.

| Format  | Entries | Input tokens | Output tokens | Cost (USD) |
| ------- | ------- | ------------ | ------------- | ---------- |
| all     | 33      | 844,892      | 220,172       | 1.945752   |
| article | 33      | 844,892      | 220,172       | 1.945752   |

| What was paid for               | Cost (USD) |
| ------------------------------- | ---------- |
| Writing calls of entries        | 1.945752   |
| Repair calls                    | 0.00       |
| Runs that ended with no entry   | 0.533207   |
| Spend with no generation record | 0.053139   |
| Everything paid for             | 2.532098   |

## Every entry

One row per generation record, newest first. The cost is the cost of its writing calls, and Repair is the cost of its repair calls.

| Generated (UTC)          | Format  | Slug                                                       | Input tokens | Output tokens | Cost (USD) | Repair (USD) |
| ------------------------ | ------- | ---------------------------------------------------------- | ------------ | ------------- | ---------- | ------------ |
| 2026-11-22T15:45:19.079Z | article | how-to-deploy-ai-agent-updates-with-canary-releases        | 36,262       | 7,082         | 0.071672   | 0.00         |
| 2026-11-22T07:30:59.132Z | article | how-to-pause-and-resume-long-running-ai-agents             | 36,047       | 7,726         | 0.074677   | 0.00         |
| 2026-11-21T15:43:27.456Z | article | how-to-retire-an-ai-tool-when-its-vendor-contract-ends     | 45,921       | 10,576        | 0.098801   | 0.00         |
| 2026-11-21T07:45:46.404Z | article | how-to-assign-roles-and-escalation-paths-for-ai-incidents  | 28,807       | 7,142         | 0.064517   | 0.00         |
| 2026-11-20T16:28:04.204Z | article | how-to-let-customers-appeal-ai-assisted-decisions          | 32,723       | 7,801         | 0.071728   | 0.00         |
| 2026-11-19T18:43:26.770Z | article | how-to-rank-ai-use-cases-by-risk                           | 31,878       | 6,992         | 0.066838   | 0.00         |
| 2026-11-19T07:59:01.743Z | article | how-to-require-approval-for-ai-agent-payments              | 31,834       | 7,146         | 0.067564   | 0.00         |
| 2026-11-18T17:18:52.270Z | article | when-should-a-business-disclose-ai-use-to-customers        | 32,193       | 8,581         | 0.075098   | 0.00         |
| 2026-11-18T07:59:41.627Z | article | how-to-audit-employee-compliance-with-ai-usage-rules       | 26,914       | 7,493         | 0.064379   | 0.00         |
| 2026-11-17T17:10:58.618Z | article | how-to-run-an-ai-agent-in-shadow-mode                      | 34,030       | 7,447         | 0.071265   | 0.00         |
| 2026-11-17T08:32:51.545Z | article | how-to-load-test-an-ai-agent-before-launch                 | 13,032       | 4,102         | 0.033542   | 0.00         |
| 2026-11-16T18:29:44.351Z | article | how-should-boards-divide-ai-oversight-among-committees     | 26,475       | 7,303         | 0.06299    | 0.00         |
| 2026-11-16T07:18:38.674Z | article | how-to-run-a-quarterly-ai-tool-access-review               | 26,099       | 7,205         | 0.062124   | 0.00         |
| 2026-11-15T16:39:27.883Z | article | how-to-stop-ai-agents-getting-stuck-in-loops               | 29,438       | 7,039         | 0.064633   | 0.00         |
| 2026-11-15T07:12:38.252Z | article | how-to-set-a-per-task-spending-limit-for-an-ai-agent       | 11,523       | 3,745         | 0.030248   | 0.00         |
| 2026-11-14T07:03:07.699Z | article | how-to-review-ai-generated-customer-support-replies        | 32,726       | 7,880         | 0.072126   | 0.00         |
| 2026-11-13T15:46:23.162Z | article | how-to-review-ai-vendor-model-updates-after-deployment     | 32,592       | 7,954         | 0.072362   | 0.00         |
| 2026-11-13T10:02:48.593Z | article | how-to-sandbox-ai-agent-code-execution                     | 25,624       | 6,404         | 0.057644   | 0.00         |
| 2026-11-12T16:17:57.319Z | article | how-can-boards-verify-ai-cost-savings                      | 14,568       | 4,151         | 0.035323   | 0.00         |
| 2026-11-12T07:45:04.214Z | article | how-to-decide-which-employee-data-can-be-used-in-ai-tools  | 28,742       | 7,219         | 0.064837   | 0.00         |
| 2026-11-11T16:09:32.631Z | article | how-to-allocate-shared-ai-tool-costs-across-departments    | 12,402       | 3,656         | 0.030682   | 0.00         |
| 2026-11-11T09:56:11.065Z | article | how-to-set-ai-chat-retention-rules                         | 26,012       | 8,390         | 0.067962   | 0.00         |
| 2026-11-10T15:51:31.151Z | article | what-should-a-board-request-in-a-quarterly-ai-risk-report  | 24,305       | 7,354         | 0.061075   | 0.00         |
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
| gpt-6.1-terra | 1                            | 5                             | 33      | 2026-11-03T05:36:35.954Z | 2026-11-22T15:45:19.079Z |

## Waiting for a record

These ledgers have no generation record yet, and a claim that is still in force says one is expected: the run that holds the topic has not merged its entry. Together they cost 0.053139 USD, and the paid tables already count that spend under Spend with no generation record. Nothing is wrong and no person has to act: a line leaves this list when its record reaches the tree, and moves to Warnings if its claim lapses first.

- how-to-configure-a-circuit-breaker-for-llm-api-failures: its ledger records a generation of 0.015949 USD (verdict: open) and no generation record names it yet; its claim holds the topic until 2026-12-04T10:29:13.638Z, so the record is still expected
- how-to-create-an-ai-training-plan-by-employee-role: its ledger records a generation of 0.01273 USD (verdict: open) and no generation record names it yet; its claim holds the topic until 2026-12-07T19:30:46.468Z, so the record is still expected
- how-to-prioritize-competing-ai-project-requests: its ledger records a generation of 0.00811 USD (verdict: open) and no generation record names it yet; its claim holds the topic until 2026-12-07T11:16:43.028Z, so the record is still expected
- how-to-rotate-ai-agent-credentials-without-downtime: its ledger records a generation of 0.01635 USD (verdict: open) and no generation record names it yet; its claim holds the topic until 2026-12-08T06:24:06.999Z, so the record is still expected

## Notes

These runs ended with no entry and together cost 0.533207 USD. That spend is in no entry row; the paid tables count it under Runs that ended with no entry. A note is not a warning: nothing a person does can clear it, because a run that ended will never gain a record.

- agentic-automation-consultant-for-b2b: this run ended on 2026-11-06 with the verdict escalated and left no generation record, so no entry is counted for it; its ledger records 0.061445 USD for the generation, and the monthly spend ceiling counts that cost
- ai-incident-response-plan-template: this run ended on 2026-11-06 with the verdict escalated and left no generation record, so no entry is counted for it; its ledger records 0.060008 USD for the generation, and the monthly spend ceiling counts that cost
- fractional-caio-vs-full-time-caio-cost: a person discarded this attempt on 2026-11-02 and its generation record went with it, so no entry is counted for it and its cost cannot be checked against a record; its ledger records 0.022748 USD for the generation, and the monthly spend ceiling counts that cost
- how-to-prevent-customer-data-from-entering-public-ai-tools: this run ended on 2026-11-09 with the verdict escalated and left no generation record, so no entry is counted for it; its ledger records 0.062991 USD for the generation, and the monthly spend ceiling counts that cost
- how-to-set-up-an-ai-launch-approval-process: this run ended on 2026-11-09 with the verdict escalated and left no generation record, so no entry is counted for it; its ledger records 0.061215 USD for the generation, and the monthly spend ceiling counts that cost
- iso-42001-gap-assessment: this run ended on 2026-11-06 with the verdict escalated and left no generation record, so no entry is counted for it; its ledger records 0.059851 USD for the generation, and the monthly spend ceiling counts that cost
- what-does-a-chief-ai-officer-do-in-a-50-person-company: this run ended on 2026-11-07 with the verdict escalated and left no generation record, so no entry is counted for it; its ledger records 0.10431 USD for the generation, and the monthly spend ceiling counts that cost
- who-owns-an-ai-system-after-launch-it-or-the-business: this run ended on 2026-11-13 with the verdict escalated and left no generation record, so no entry is counted for it; its ledger records 0.100639 USD for the generation, and the monthly spend ceiling counts that cost
