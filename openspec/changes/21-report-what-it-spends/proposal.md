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
in UTC, its format, its slug, its input and output tokens and its cost. The cost of an entry is the
sum of its writing calls, the draft and the correction, as each call stored it. A repair call is not
a writing call and is not counted, which is how the monthly ceiling reads a record too. Nothing is
recomputed from the rates, so a change to the rates never rewrites history. The file
states each model and pair of rates the costs were computed at, with the first and last entry each
pair priced, so a rate change shows as a second row with a date. The format is the record's own
word, `article` or `term`.

**Three windows, each defined in the file.** _This entry_ is every entry of the newest run, which is
two entries when a run wrote an article and a term. _Last 30 days_ is the 30 × 24 hours that end at
the newest generation instant, with the start excluded and the end included, and the file prints
both instants. _All time_ is every record. The window ends at the newest record and not at the
clock, because regenerating the file from an unchanged set of records must give the same bytes on
any day, and a window that ended now would change the file at every midnight. The price is that the
file, read a month after the last run, still describes the 30 days before that run, and it says so.
The monthly ceiling counts UTC calendar months and counts spend that no entry carries, so the file
says in its own words that its 30 days and the ceiling's month are different numbers.

**Slack after every generation.** After a successful write, `node scripts/spend-report.mjs notify`
posts one message: each entry just written with its tokens and cost, the 30-day totals and the
all-time totals. It uses the sender in `site/scripts/escalate-channels.mjs` and the redaction of
`site/scripts/escalate.mjs`, and it reads on a phone: lines of numbers with units, no table and no
emphasis. When no record exists it posts nothing, because a row of zeros reads as a measurement.

**The report travels with the entry.** The unattended writer's one commit gains the report, so a
pull request is never judged with a report that is a run behind. A repair adds repair calls to a
record and no writing call, and the report totals only writing calls, so a repair leaves the report
as it was and `site/scripts/repair-scope.mjs` needs no change. If a repair ever moved a figure,
`npm run gate:autowriter` would refuse the commit and name the line.

**A gate refuses a report that disagrees with its records.** `npm run gate:autowriter` regenerates
the report from the committed ledgers and records and refuses one that is missing or differs from the
regeneration, naming the first line that differs. One input is read back from the file: the
`Generated-from` line that `npm run gate:evidence` already requires of every Markdown file under
`audits/`, because a commit hash is not a function of the records. `gate:evidence` checks that the
hash names a real commit.

**An incomplete corpus is said, not summed.** A ledger that is still open or merged and records a
generation for which no record exists, a record whose ledger is not in the repository, a record and
ledger that disagree about the writing spend, and a file that cannot be read each become a warning in
the report. The Slack message states how many warnings there are, zero included, and carries the first
three. The writing-spend case is `spendWarnings`, called unchanged. The other three share its form.

**A warning is a line a person can act on.** A run that ended with no entry, because it stopped, was
escalated or was discarded by a person, is settled: no action clears its line, and a warning that
nothing clears would sit in every message until the real one hid behind it. The report lists such a
run under Notes, in its own sentence, says that a note is not a warning because nothing a person does
can clear it, and leaves it out of the warning count and out of the Slack message. The monthly ceiling
still counts its cost.

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

## What this does not change

The monthly ceiling, its calendar month, its notice and the ledger schema stand. No escalation kind,
channel or secret is added. The report reads only committed files, with no clock and no network.

Spend that no entry carries is not in the report: a draft the run wrote and then skipped, and a run
that stopped before any entry existed. The ceiling counts both. The report says so beside its
definitions, because a total that silently left them out would read as the whole cost.

The report is one file every run rewrites, so two pull requests open at once would conflict on it,
as they already would on the registers they share. `npm run audit:spend` regenerates it.
