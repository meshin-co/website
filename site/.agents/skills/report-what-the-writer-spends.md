# Report What the Writer Spends

The owner sees what the unattended writer costs in `audits/spend-report.md`, one file rewritten from the records, and in Slack
after every generation, both from one model. Changes `21-report-what-it-spends` and `22-shard-the-writers-records` hold the reasons.

## The file

`npm run audit:spend` runs `scripts/spend-report.mjs`. It reads the ledgers `audits/autowriter/<year>/<month>/<slug>.json`
and the generation records `audits/autowriter/generations/<year>/<month>/<slug>.json` from the working tree, builds the
figures in `scripts/spend-report-model.mjs` and renders them in `scripts/spend-report-text.mjs`. It reads no network and reads
the clock once: `Generated-at:` stamps that instant after `Generated-from:`. The same records and the same stamp give the
same bytes, and a file that is already current is left alone, so a later day changes nothing until a record does.

- `This month` comes first, above any explanation: one sentence from `monthLine` and the paid table from `monthlyBreakdown`
  (`scripts/spend-sum.mjs`); `About this file` is second. It counts the committed records, not the branches the ceiling job adds.
- One row per record: instant (UTC), format (`article` or `term`), slug, tokens, `Cost` and `Repair`. Cost is the entry's
  calls, `topic`, `draft` and `correction` (`recordMicro`). Repair is the record's repair calls (`recordRepairMicro`). Whole
  micro-dollars, shown as dollars. A record keeps the cost it stored, so a change of rate adds a row to Rates.
- Three windows, each defined in the file: this entry (the newest run, by run id), the last 30 days (30 x 24 hours ending at
  the newest record, start excluded) and all time. They count the writing calls of entries only and end at the newest
  record, not at the clock. They are not the ceiling's calendar month.
- The paid table, in `This month` and in `All time`, has four kinds of call, and each call is in exactly one: writing calls of
  entries (a category entry's `topic` call included), repair calls (the ledger's attempts, so a failed repair is in), runs that ended with no entry (the Notes) and spend
  with no generation record (the Warnings), then everything paid for. Each section states the total of its row. Proposals of a pick that wrote no entry have no ledger and so no row: only its step summary holds them (`write-on-a-category.md`).
- With no record the file says no entry was generated and holds no entry row, total or rate: no measurement, not zero. `This month` stays.

## Warnings and notes

A warning is a line a person has something to do about, and every entry that can be counted is still counted. These are
warnings: a ledger that spent and has no record while its verdict is `open` or `merged`, repair attempts alone included; a
record whose ledger is not in the repository; a ledger that records less writing spend than its records cost (the sentence
`spendWarnings` writes); a file that cannot be read or is off its schema.

A run that ended with no entry is settled, and nothing a person does clears its line. A ledger that spent and has no record,
with the verdict `stopped`, `escalated` or `discarded`, is a Note instead and is not counted as a warning. `hasEnded` in
`scripts/spend-sum.mjs` is the one test for the lists and the table: the Notes are the row Runs that ended with no entry, and
the ledgers a warning lists are the row Spend with no generation record, so a warned call is counted and never dropped.
A failed write ends `escalated`, because `scripts/escalate-run.mjs` overwrites `stopped`.

## Where it is written and checked

Every commit that changes a ledger or a record carries the file: the writer's one commit (`scripts/write-run.mjs`); a repair,
and the ledger-only commit of a repair that failed after it spent (`reportFiles` in `scripts/repair-finish.mjs`, the path
allowed by `scripts/repair-scope.mjs`); and the commit of a failed write, after its escalation (`write-daily.yml`). A hand
change such as a discard needs `npm run audit:spend`. The gate reads back two lines, `Generated-from:` and `Generated-at:`.

`npm run gate:autowriter` regenerates the file with the stamped instant and refuses `spend-report-missing` and `spend-report-differs`,
naming the first differing line or the missing `Generated-at` (`scripts/autowriter-spend-rules.mjs`). The specimens
(`scripts/autowriter-spend-specimens.mjs`) plant a record at the committed stamp that passes the ceiling, a forged spent figure, a deleted report and an unstamped one, and hold on any report. The fix is `npm run audit:spend`.

## The message

Every message is Block Kit `{ text, blocks }` (`scripts/slack-blocks.mjs`); `text` is the fallback a phone shows. Kinds: the entry
message (`node scripts/spend-report.mjs notify`, `scripts/spend-slack.mjs`), the no-entry message (`scripts/spend-ended.mjs` with
`ceiling`, `pick` or `write`; five steps of `write-daily.yml`; a failed pick posts none and escalates instead), the escalation message and the live-entry message.

- Month first: header `<month> spend against the monthly ceiling`, the Spent, Ceiling and Left table, and `monthLineOf` as line 1 of `text`.
- Compared numbers sit in code fences padded by `monoTable` (`scripts/slack-table.mjs`), no line over `PHONE_COLUMNS` = 34, our own limit.
  `fields` are two proportional columns of unknown width, so they hold links only. No native `table` block: webhook support is undocumented.
- Links are `<url|label>`: `#84`, `run 777`, the entry under `site.site`, `#41`. `scripts/github-links.mjs` builds them from
  `GITHUB_SERVER_URL`, `GITHUB_REPOSITORY` and `GITHUB_RUN_ID`; `PULL_REQUEST` is the number, and with none there is no link.
- `Warnings: 0 (...)` is a context line; N above 0 is a section with 3 listed, then `and K more in audits/spend-report.md`. No note appears.
- A missed message is not an escalation: `deliverNotice` (`scripts/slack-notice.mjs`) prints `::warning::<label>: slack NOT delivered: <reason>`, the webhook removed by `redactorFor`, and exits 0. Exit 1 and 2 stay for causes that are not delivery.
  A 4xx on the blocks is a formatting defect, not a missed message: `postSlackMessage` sends the `text` alone, ending in a line that says Slack refused the formatted version, and `deliverNotice` prints `::warning::<label>: slack delivered as plain text` with Slack's reason. Read that warning and fix the builder.
- Live entry (`scripts/live-entry.mjs`, `scripts/live-slack.mjs`; `publish-the-build.md`): once per entry, when its page answers 2xx on
  `site.site`. Links come from `scripts/entry-surfaces.mjs` over `owedFor` and `SURFACES` (`scripts/route-parity.mjs`), the prompt, when the claim has one, is `claim.prompt`
  of the record (`scripts/entries-in-build.mjs`), `scripts/live-state.mjs` remembers it. An unreachable page is a warning message and stays unannounced.

## A discarded attempt

When the owner closes an article pull request unmerged, its branch goes and takes the generation record with it, so the
ledger on `main` still reads `open` with no spend, and the ceiling would under-count. Record it:

1. Put the generation spend on the ledger with `ledgerWithGeneration` (`scripts/generation-record.mjs`), read from the
   record on `refs/pull/<number>/head`. Set `pullRequest` and the verdict `discarded` with its reason and the instant of the
   decision; like `stopped`, it needs both.
2. End the claim's hold by setting its `expiresAt` to that instant (`isHolding` in `scripts/autowriter-claims.mjs`).
3. Run `npm run audit:spend`: the ceiling counts the spend in the month of the decision, the report lists it under Notes.

The ledger keeps holding its slug (`scripts/topic-claims.mjs`). Removing it would erase its spend; no procedure frees a slug safely.
