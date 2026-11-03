# Report what the writer spends, in one file and one message

## Why

Change `20-write-without-a-human` lets the site write to demand with no person in the loop. Every
run already records what it spent: one ledger per run in `audits/autowriter/` and one generation
record per entry in `audits/autowriter/generations/`, each call with its tokens, its rates and its
cost. The only figure built from those files is the monthly ceiling, which stops the run when the
calendar month reaches `loop.monthlySpendCeilingUsd` in `site/engine.config.json`. It says when to
stop. It does not say what one article or one glossary term costs, and the owner wants to see that
in two places: one file in the repository that always shows the current picture, and a Slack message
after every generation.

The figures must not come from a second calculation. `site/scripts/spend-sum.mjs` already holds the
rule for what a run cost, in integer micro-dollars, and `spendWarnings` already reports a ledger and
a record that disagree. A report with a sum of its own would read differently from the ceiling and
nobody could say which was right. So the report adds up only what the records store, through
`microOf`, and gives every disagreement the sentence `spendWarnings` already writes.

## What changes

**One report, regenerated from the records.** `audits/spend-report.md` is rewritten, never appended
to, by `npm run audit:spend`. It holds one row per generation record: the instant it was generated
in UTC, its format, its slug, its input and output tokens, its cost and its repair cost. The cost of
an entry is the sum of its writing calls, the draft and the correction, as each call stored it. A
repair call is not a writing call, so it is not in that cost: the row shows it in its own column
beside the cost, and the paid tables count it. Nothing is recomputed from the rates, so a change to
the rates never rewrites history. The file states each model and pair of rates the costs were
computed at, with the first and last entry each pair priced, so a rate change shows as a second row
with a date. The format is the record's own word, `article` or `term`.

**Three windows, each defined in the file.** _This entry_ is every entry of the newest run, which is
two entries when a run wrote an article and a term. _Last 30 days_ is the 30 × 24 hours that end at
the newest generation instant, with the start excluded and the end included, and the file prints
both instants. _All time_ is every record. The window ends at the newest record and not at the
clock, because regenerating the file from an unchanged set of records must give the same bytes on
any day, and a window that ended now would change the file at every midnight. The price is that the
file, read a month after the last run, still describes the 30 days before that run, and it says so.
The monthly ceiling counts UTC calendar months and counts every call the machine paid for, so the file
says in its own words that its 30 days and the ceiling's month are different numbers. The windows
total the writing calls of entries only, and the file says that too.

**The month, against the ceiling.** The windows say what an entry costs. They do not answer the
question the owner's decision hangs on: how much of this month's ceiling is spent. The file now opens
with it, before anything that explains the file, in one sentence: `2026-11 so far: 0.022748 USD spent
of the 25.00 USD monthly ceiling, 24.977252 USD left.`, or, at the ceiling, that none is left and the
writer does not run for the rest of the month. The explanation of how the file is made and what its
words mean follows it under `About this file`. The Slack message carries the same sentence as its
second block. Answering needs a date, so the file reads the clock once, when it is written, and stamps the instant as `Generated-at:`
beside `Generated-from:`, and the month is the month of that instant. `npm run audit:spend` leaves a
file that is already current alone, so the stamp moves only when a record does, and the file says
which instant its figure was true at. The Slack sentence is built from the ceiling status the ceiling
job computes (`monthLineOf` in `site/scripts/spend-ceiling.mjs`), so its figure is the one that stops
the writer, including spend on branches that are not merged yet. The file's figure counts the
committed records only, and says so.

**Every call the machine paid for, each in exactly one row.** A total of entries is true line by line
and wrong as a summary when runs that cost money ended with no entry, or when entries needed repairs.
So the report totals, for the month and for all time, four kinds of paid call and their sum: the
writing calls of entries, the repair calls, the runs that ended with no entry, and the spend of a
ledger that no generation record names. The last two were one figure, spend that no entry carries,
and that figure held money which no list explained: a ledger that spent and was warned about was in
the total and in no Notes figure. It is now a row of its own, the Warnings state what it costs
together, and a ledger with only repair attempts is stated in full. Each paid call is in exactly one
row, so the four add up to the sum, and the Notes total is the row of runs that ended with no entry.
`site/scripts/spend-sum.mjs` adds them by the rule the ceiling uses, so the two cannot disagree, and
the ceiling itself now counts every call a ledger or a record shows (change
`22-shard-the-writers-records` holds the accounting). The Slack message ends its all-time lines with
the sum and its four kinds in one labelled line.

**Slack after every generation.** After a successful write, `node scripts/spend-report.mjs notify`
posts one message: each entry just written with its tokens and cost, the month sentence, the 30-day
totals, the all-time totals with everything paid for, and a warnings line. It uses the sender in
`site/scripts/escalate-channels.mjs` and the redaction of `site/scripts/escalate.mjs`, and it reads
on a phone: lines of numbers with units, no table and no emphasis. When no record exists it posts
nothing, because a row of zeros reads as a measurement.

**The report travels with every change to the spend.** The unattended writer's one commit gains the
report, so a pull request is never judged with a report that is a run behind. A repair adds repair
calls to a record and an attempt to its ledger, and the report now shows both, so a repair commit
regenerates the report too (`site/scripts/repair-finish.mjs`, with `site/scripts/repair-scope.mjs`
allowing the path), and so does the ledger-only commit that records the spend of a repair that
failed. Without that, the first repair of a pull request would turn `npm run gate:autowriter` red.

**A gate refuses a report that disagrees with its records.** `npm run gate:autowriter` regenerates
the report from the committed ledgers and records and refuses one that is missing or differs from the
regeneration, naming the first line that differs. Two inputs are read back from the file: the
`Generated-from` line that `npm run gate:evidence` already requires of every Markdown file under
`audits/`, because a commit hash is not a function of the records, and the `Generated-at` line,
because an instant is not either. `gate:evidence` checks that the hash names a real commit. A file
with no readable `Generated-at` line is refused as differing.

**An incomplete corpus is said, not summed.** A ledger that is still open or merged and records a
generation for which no record exists, a record whose ledger is not in the repository, a record and
ledger that disagree about the writing spend, and a file that cannot be read each become a warning in
the report. The Slack message states how many warnings there are, zero included, says in the same
line what the number means, and carries the first three. `Warnings: 0` means that every ledger
agrees with its generation record. It does not say that every run produced an entry, and the line
says so. The writing-spend case is `spendWarnings`, called unchanged. The other three share its form.

**A warning is a line a person can act on.** A run that ended with no entry, because it stopped, was
escalated or was discarded by a person, is settled: no action clears its line, and a warning that
nothing clears would sit in every message until the real one hid behind it. The report lists such a
run under Notes, in its own sentence, says that a note is not a warning because nothing a person does
can clear it, and leaves it out of the warning count and the warning lines of the Slack message. The
monthly ceiling still counts its cost, so do the paid tables, and the Notes total says what such
runs cost together.

**A day with no entry is not silent.** The statistics message follows a write that made an entry, so
a week of runs that ended without one would be a silent week, and silence reads as health. When a run
ends without an entry, `node scripts/spend-ended.mjs` posts two lines: that no entry was written on
that UTC date, why, and what the run cost, then the month sentence. The four endings are the ceiling
reached, a picker that chose nothing or chose to strengthen a page, a write that ended with no entry
and a write that failed. The cost is the ledger's, read after the ledger and the report were
committed, and the message never carries the failure text or the spend the writer printed. A run that
fails before the picker decided, in the demand refresh or in the pick step, does not post it: the
refresh has its own escalation and a failed pick ends the job red.

## A missed message is not an escalation

An escalation exists for a failure that needs a person before the pipeline may go on. Its receipts
are written into the ledger, `npm run gate:autowriter` refuses a ledger whose escalation reached no
one, and the watcher stops on it. Treating a missed statistics post the same way would let a Slack
outage block the merge of an article that is correct. Nothing is lost either: the report holds the
same figures and the next message carries the cumulative totals.

So the post is its own step, after the pull request step, and it runs even when the push failed,
because the money was spent either way. It does one thing when Slack does not take the message: it
ends red. Its output is one receipt line in the words an escalation receipt uses, channel, HTTP
status and reason, with the webhook removed by the same redactor the escalation path uses; the step
summary repeats it and GitHub's failed-run notice reaches the owner. It opens no issue, tries no
second channel, stops no pull request and writes no ledger. The ledger is the one thing it leaves
alone for three reasons. It is committed with the entry before the message is sent. A second commit
would push to a branch the watcher is already judging. And a failed receipt there would be an
escalation that reached no one, which the gate refuses.

## Follow-ups, deliberately not built here

Three gaps are real and are named so that they are not lost. Each is its own change, because each needs
a design that this one has no room for.

- **A view per day.** The report totals by entry, by 30 days and by month. It cannot say what any one
  day cost, so a day with a spike hides inside its month.
- **A burn rate against the ceiling.** The month sentence says what is left, not how fast it is going. A
  month that spent half of the ceiling in its first three days reads the same as a calm one until the
  ceiling is reached.
- **Spend on branches that are not merged yet, in the file.** The ceiling job counts it and the Slack
  sentence carries that figure, but the file counts the committed records only and says so, so the file
  and the message can show different figures for the same month.

## What this does not change

The monthly ceiling, its calendar month, its notice and the ledger schema stand. No escalation kind,
channel or secret is added. The report reads the ledgers and records of the working tree, reads the
clock once and reads no network.

The windows still total the writing calls of entries only. The paid tables carry what the windows
leave out: every repair call, a draft the run wrote and then skipped, a run that stopped before any
entry existed, a discarded attempt, and the spend of a ledger that no generation record names.

The report is one file every run rewrites, so two pull requests open at once would conflict on it,
as they already would on the registers they share. `npm run audit:spend` regenerates it.
