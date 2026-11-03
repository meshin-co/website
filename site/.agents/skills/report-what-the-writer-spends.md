# Report What the Writer Spends

The owner sees what the unattended writer costs in two places: `audits/spend-report.md`, one file rewritten from the
records, and a Slack message after every generation. Both come from one model. Changes `21-report-what-it-spends` and
`22-shard-the-writers-records` hold the reasons.

## The file

`npm run audit:spend` runs `scripts/spend-report.mjs`. It reads the ledgers `audits/autowriter/<year>/<month>/<slug>.json`
and the generation records `audits/autowriter/generations/<year>/<month>/<slug>.json` from the working tree, builds the
figures in `scripts/spend-report-model.mjs` and renders them in `scripts/spend-report-text.mjs`. It reads no network and reads
the clock once: `Generated-at:` stamps that instant after `Generated-from:`. The same records and the same stamp give the
same bytes, and a file that is already current is left alone, so a later day changes nothing until a record does.

- `This month` comes first: one sentence from `monthLine` (the month of the stamp, spent, ceiling, left, or none left) and a
  table of what was paid for, from `monthlyBreakdown` in `scripts/spend-sum.mjs`. It counts the committed records. The
  ceiling job also counts unmerged branches, so its figure can be higher, and the file says so.
- One row per record: instant (UTC), format (`article` or `term`), slug, tokens, `Cost` and `Repair`. Cost is the writing
  calls, `draft` and `correction` (`recordMicro`). Repair is the record's repair calls (`recordRepairMicro`). Whole
  micro-dollars, shown as dollars. A record keeps the cost it stored, so a change of rate adds a row to Rates.
- Three windows, each defined in the file: this entry (the newest run, by run id), the last 30 days (30 x 24 hours ending at
  the newest record, start excluded) and all time. They count the writing calls of entries only and end at the newest
  record, not at the clock. They are not the ceiling's calendar month.
- `All time` adds the paid table over every month: writing calls of entries, repair calls (the ledger's attempts, so a failed
  repair is in), spend that no entry carries (a skipped draft, a run that stopped first, a discarded attempt) and everything
  paid for. Notes names each run that ended with no entry, and what they cost together.
- With no record the file says that no entry has been generated and holds no entry row, total or rate. That is no
  measurement, not a cost of zero. `This month` stays.

## Warnings and notes

A warning is a line a person has something to do about, and every entry that can be counted is still counted. These are
warnings: a ledger that records a generation no record names while its verdict is `open` or `merged`; a record whose ledger
is not in the repository; a ledger that records less writing spend than its records cost (the sentence `spendWarnings`
writes); a file that cannot be read or is off its schema.

A run that ended with no entry is settled, and nothing a person does clears its line. A ledger that spent and has no record,
with the verdict `stopped`, `escalated` or `discarded`, is a Note instead and is not counted as a warning. A failed write
ends `escalated`, because `scripts/escalate-run.mjs` overwrites `stopped`.

## Where it is written and checked

Every commit that changes a ledger or a record carries the file: the writer's one commit (`scripts/write-run.mjs`); a repair,
and the ledger-only commit of a repair that failed after it spent (`reportFiles` in `scripts/repair-finish.mjs`, the path
allowed by `scripts/repair-scope.mjs`); and the commit of a failed write, after its escalation (`write-daily.yml`). A hand
change such as a discard needs `npm run audit:spend`. The gate reads back two lines, `Generated-from:` and `Generated-at:`.

`npm run gate:autowriter` regenerates the file with the stamped instant and refuses `spend-report-missing` and
`spend-report-differs`, naming the first line that differs or the missing `Generated-at` (`scripts/autowriter-spend-rules.mjs`).
The specimens are a record added without regenerating, a figure edited by hand, a deleted report and a report without its
instant (`scripts/autowriter-spend-specimens.mjs`). The fix is `npm run audit:spend`.

## The message

`write-daily.yml` runs `node scripts/spend-report.mjs notify --result "$WRITE_RESULT_FILE"` after a successful write, with
`SLACK_WEBHOOK_URL` as its only secret. It posts this entry, the month sentence from `monthLineOf` in `scripts/spend-ceiling.mjs`
(the ceiling status, so the figure the ceiling stops on), the 30 days, all time with `Everything paid for`, and
`Warnings: N (what N means)`; `Warnings: 0` says every ledger agrees with its record, not that every run made an entry. It
sends plain lines through `postSlackText` in `scripts/escalate-channels.mjs` and prints one receipt line, the webhook removed
by `redactorFor` in `scripts/escalate.mjs`.

- It posts nothing from zero records, for a slug no record holds or when the ceiling status cannot be read (exit 1). A missed
  message is not an escalation: the step exits 1 and prints one line, writes no ledger, opens no issue and tries no second
  channel. The next message carries the cumulative totals.
- A day with no entry posts two lines through `node scripts/spend-ended.mjs` (`ceiling`, `pick`, `write`): why, what the run
  cost from its ledger, then the month sentence. Five steps of `write-daily.yml` call it; a failed pick posts nothing.

## A discarded attempt

When the owner closes an article pull request unmerged, its branch goes and takes the generation record with it, so the
ledger on `main` still reads `open` with no spend, and the ceiling would under-count. Record it:

1. Put the generation spend on the ledger with `ledgerWithGeneration` (`scripts/generation-record.mjs`), read from the
   record on `refs/pull/<number>/head`. Set `pullRequest` and the verdict `discarded` with its reason and the instant of the
   decision; like `stopped`, it needs both.
2. End the claim's hold by setting its `expiresAt` to that instant (`isHolding` in `scripts/autowriter-claims.mjs`).
3. Run `npm run audit:spend`. The ceiling counts the spend in the month of the decision from the ledger alone, and the
   report lists the attempt under Notes.

The ledger keeps holding its slug (`scripts/topic-claims.mjs`). Removing it would erase its spend; no procedure frees a slug safely.
