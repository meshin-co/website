# Report What the Writer Spends

The owner sees what the unattended writer costs in two places: `audits/spend-report.md`, one file rewritten from the
records, and a Slack message after every generation. Both come from one model, so they cannot disagree. Change
`21-report-what-it-spends` holds the reasons.

## The file

`npm run audit:spend` runs `scripts/spend-report.mjs`. It reads the ledgers `audits/autowriter/<year>/<month>/<slug>.json`
and the generation records `audits/autowriter/generations/<year>/<month>/<slug>.json` from the working tree, with no clock
and no network, and rewrites the file from them. It is never appended to. The same records give the same bytes on any day.

- One row per record: instant (UTC), format (`article` or `term`), slug, input tokens, output tokens, cost.
- A cost is the entry's writing calls, `draft` and `correction`, read through `recordMicro` in `scripts/spend-sum.mjs`. It is
  added in whole micro-dollars and shown as dollars only. A repair call is not counted. Nothing is recomputed from the
  rates: a record keeps the cost it stored, so a change of rate adds a row to the rates table and rewrites no history.
- Three totals, each defined in the file. This entry is every entry of the newest run, found by its run id. The last 30 days
  are 30 x 24 hours: after the newest record's instant minus 30 days, through that instant. All time is every record. The
  window ends at the newest record and not at the clock, or the file would change at midnight. It is not the UTC calendar
  month of the monthly ceiling, and the file says so.
- With no record the file says that no entry has been generated and holds no row, total or rate. That is no measurement. It
  is not a cost of zero.
- Spend that no entry carries is not in the file: a skipped draft, a run that stopped first and a discarded attempt. The
  ceiling counts it.

`scripts/spend-report-model.mjs` reads the files and builds the figures. `scripts/spend-report-text.mjs` renders the file and
the Slack message from them.

## Warnings, not silent sums

Each of these becomes one line under Warnings, and every entry that can be counted is still counted:

- a ledger that records a generation no record names, unless its verdict is `stopped`; a `discarded` ledger has its own
  sentence, which says the record went with the attempt and the ceiling counts the cost;
- a record whose ledger is not in the repository;
- a ledger that records less writing spend than its records cost, in the sentence `spendWarnings` in `scripts/spend-sum.mjs`
  already writes;
- a file that cannot be read or is off its schema.

## Where it is written and checked

The writer's one commit holds the file (`scripts/write-run.mjs`). A repair adds repair calls and no writing call, so it leaves
the file as it was. `Generated-from:` is the one line the gate reads back. Every other byte is regenerated.

`npm run gate:autowriter` regenerates the file and refuses `spend-report-missing` and `spend-report-differs`, naming the first
line that differs (`scripts/autowriter-spend-rules.mjs`). The specimens are a record added without regenerating, a figure
edited by hand and a deleted report (`scripts/autowriter-spend-specimens.mjs`). The fix is `npm run audit:spend`.

## The message

`.github/workflows/write-daily.yml` runs `node scripts/spend-report.mjs notify --result "$WRITE_RESULT_FILE"` after a
successful write, with `SLACK_WEBHOOK_URL` as its only secret. It posts this entry, the 30 days and all time as plain lines of
numbers and units, through `postSlackText` in `scripts/escalate-channels.mjs`. It prints one receipt line, with the webhook
removed by `redactorFor` in `scripts/escalate.mjs`.

- It posts nothing from zero records. A slug that the write result names and no record holds posts nothing and exits 1,
  naming the slug.
- A missed message is not an escalation. The step exits 1 and prints one line. It writes no ledger, opens no issue, tries no
  second channel and stops no pull request. An escalation that reached no one is a `gate:autowriter` finding and would block a
  correct article, and the next message carries the cumulative totals.

## A discarded attempt

When the owner closes an article pull request unmerged, its branch goes and takes the generation record with it, so the
ledger on `main` still reads `open` with no spend, and the ceiling would under-count what the run cost. Record it:

1. Put the generation spend on the ledger with `ledgerWithGeneration` (`scripts/generation-record.mjs`), read from the
   record on the closed pull request (`refs/pull/<number>/head`). Set `pullRequest` and the verdict `discarded` with the
   reason and the instant of the decision. Like `stopped`, `discarded` needs both.
2. End the claim's hold by setting its `expiresAt` to that instant. The claim store has no release: a claim stops holding
   when `expiresAt` passes (`isHolding` in `scripts/autowriter-claims.mjs`), and the gate counts it under `lapsed`.
3. Run `npm run audit:spend`. `scripts/spend-ceiling.mjs` counts the spend in the month of the decision from the ledger
   alone, with no branch and no record.

The ledger keeps holding its slug (`scripts/topic-claims.mjs`), so the topic is not picked again. Removing the ledger to
free it would take its spend out of the monthly total.
