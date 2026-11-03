# governance/spend-reporting Specification

## ADDED Requirements

### Requirement: One report states what every generated entry cost

The pipeline SHALL keep `audits/spend-report.md`, regenerated from the generation records and the
ledgers by `site/scripts/spend-report.mjs` and never appended to. It SHALL hold one row per record
with its instant, format, slug, tokens, the cost of its writing calls and the cost of its repair
calls, and SHALL state the model and the rates each cost was computed at.

#### Scenario: Nothing has been generated

- **WHEN** no generation record exists
- **THEN** the report says in words that no entry has been generated, and holds no entry row, no
  entry total and no rate

#### Scenario: The same records are rendered twice

- **WHEN** the report is regenerated from an unchanged set of records with the instant stamped in
  the file
- **THEN** the file is byte for byte the same, and `npm run audit:spend` leaves a file that is
  already current untouched, so a later day changes nothing until a record changes

#### Scenario: The rates change between two entries

- **WHEN** a later entry was priced at rates different from an earlier one
- **THEN** the earlier entry keeps the cost its record stored, and the report lists both pairs of
  rates with the first and last entry each one priced

### Requirement: Three windows are totalled and each is defined in the file

The report SHALL total the entries of the newest run, the entries generated in the 30 × 24 hours
that end at the newest record's instant, and every entry recorded, and SHALL print each boundary as
an instant. It SHALL say that the 30 days are not the UTC calendar month of the monthly spend
ceiling.

#### Scenario: A run writes an article and a term

- **WHEN** one run writes both
- **THEN** the report lists both entries as the newest run and totals them by format

#### Scenario: An entry sits on the boundary

- **WHEN** an entry was generated exactly 30 × 24 hours before the newest record
- **THEN** it is outside the 30-day window, which opens after that instant

### Requirement: The month comes before the explanation of the file

The first section after the title and the two stamps SHALL be `This month`. The explanation of how the
file is made and what its words mean SHALL follow it, under its own heading `About this file`, and
SHALL keep the definitions the tables need.

#### Scenario: The report is opened

- **WHEN** the report is opened
- **THEN** the lines after the title and the two stamps are the heading `This month` and its
  sentence, and `About this file` is the second section

### Requirement: The report says what the month has spent against the ceiling

The report SHALL read the clock once, when it is written, and print that instant as `Generated-at:`
on the line after `Generated-from:`. Its first section, `This month`, SHALL open with one sentence
that names the UTC month of that instant, what was spent in it, the monthly ceiling and what is
left, or, at or over the ceiling, says that none is left and that the writer does not run for the
rest of the month.

#### Scenario: The month has room

- **WHEN** the committed records show 0.022748 USD spent in a month and the ceiling is 25 USD
- **THEN** the first section reads `2026-11 so far: 0.022748 USD spent of the 25.00 USD monthly ceiling, 24.977252 USD left.`

#### Scenario: The ceiling is reached

- **WHEN** the spend of the month equals or exceeds the ceiling
- **THEN** the sentence says that none is left and that the writer does not run for the rest of the
  month

#### Scenario: Nothing was spent

- **WHEN** no ledger and no record exists
- **THEN** the sentence still names the month and says 0.00 USD spent, in numbers and not in silence

#### Scenario: The month turns

- **WHEN** the records do not change across the end of a month
- **THEN** the file is not rewritten, and it still names the earlier month beside the instant it was
  stamped at, which says when the figure was true

#### Scenario: The figure says what it counts

- **WHEN** the report is read
- **THEN** `This month` says that the figure counts the ledgers and records committed in the
  repository, and that the ceiling job also counts the spend on branches that are not merged yet, so
  the figure it stops on can be higher

#### Scenario: The file reads no network

- **WHEN** the report is written
- **THEN** it reads the ledgers and records of the working tree and the clock, and no network

### Requirement: The Slack message carries the month sentence of the ceiling status

The Slack message SHALL carry the same sentence as its second block, built by `monthLineOf` in
`site/scripts/spend-ceiling.mjs` from the ceiling status of the run, so that its figure is the one
the ceiling job stops on, including the spend on branches that are not merged yet.

#### Scenario: The message carries the sentence

- **WHEN** a write produced an entry and the ceiling status says 0.022748 USD spent of 25 USD
- **THEN** the second block of the message reads `2026-11 so far: 0.022748 USD spent of the 25.00 USD monthly ceiling, 24.977252 USD left.`

### Requirement: The report totals every call the machine paid for, each in exactly one row

The report SHALL total, for the month and for all time, four kinds of paid call and their sum: the
writing calls of entries, the repair calls, the runs that ended with no entry, and the spend of a
ledger that no generation record names. A paid call SHALL be in exactly one of the four, so they add
up to the sum, and `site/scripts/spend-sum.mjs` SHALL be the only code that adds them, so that the
report and the ceiling cannot disagree.

#### Scenario: A repair failed

- **WHEN** a ledger holds an attempt whose repair ended with no repaired entry, so no record holds
  its calls
- **THEN** the paid tables count its cost under Repair calls and no entry row shows it

#### Scenario: A run ended with no entry

- **WHEN** one entry cost 0.05 USD and a run that ended with no entry cost 0.027 USD
- **THEN** the all-time entry total reads 0.05, the paid tables read 0.027 under Runs that ended with
  no entry and 0.077 for everything paid for, and the Notes say what the noted runs cost together

#### Scenario: A warned ledger is counted

- **WHEN** a ledger whose verdict is merged records a generation of 0.027 USD and no generation
  record names it
- **THEN** the paid tables count 0.027 USD under Spend with no generation record, the Warnings name
  the ledger and say that its cost is counted there, and the sum includes it

#### Scenario: A ledger holds only repair attempts

- **WHEN** a ledger records no generation, repair attempts of 0.2 USD and no generation record
- **THEN** the sentence that names it states the 0.2 USD, and the paid tables count it

#### Scenario: Each total is the cost of the lines its section lists

- **WHEN** the corpus holds runs that ended with no entry and warned ledgers
- **THEN** the Notes total is the all-time row Runs that ended with no entry, the total the Warnings
  state is the row Spend with no generation record, and the cost of the ledgers each section lists
  adds up to its row

### Requirement: A row shows its repair cost, and the Notes and the message total the rest

The row of an entry SHALL carry the cost of the repair calls its record holds in its own column,
beside the cost of its writing calls. The Notes section SHALL state what the noted runs cost
together, and the Slack message SHALL end its all-time lines with the sum and its four kinds in one
labelled line.

#### Scenario: An entry needed repairs

- **WHEN** a record holds repair calls that cost 0.015 USD and its ledger holds the matching attempt
- **THEN** its row shows the cost of its writing calls unchanged and 0.015 under Repair, and the paid
  tables count 0.015 once, under Repair calls

#### Scenario: The message ends its all-time lines with the sum and the four kinds

- **WHEN** a write produced an entry and the all-time spend is 0.086 USD of writing calls, 0.045 USD of repair calls, 0.0485 USD of runs that ended with no entry and 0.027 USD with no generation record
- **THEN** the all-time lines end with `Everything paid for: 0.2065 USD, of which writing calls 0.086 USD, repair calls 0.045 USD, runs that ended with no entry 0.0485 USD and spend with no generation record 0.027 USD.`

### Requirement: An incomplete corpus is reported, not summed in silence

When a ledger records a generation and no generation record carries its slug, when a record names a
ledger that does not exist, when a record and its ledger disagree about writing spend, or when a file
cannot be read, the report SHALL print one sentence naming the slug or the file and what is wrong, in
the form `spendWarnings` in `site/scripts/spend-sum.mjs` already uses for writing spend.

#### Scenario: A record is missing

- **WHEN** a ledger whose verdict is open or merged records a generation and no record carries its slug
- **THEN** the report names the slug and says no entry is counted for it, the entries that do exist
  are still totalled, and the ledger's spend is counted under Spend with no generation record

#### Scenario: A run stopped before it wrote anything

- **WHEN** a ledger is stopped, holds a generation and has no record
- **THEN** the report prints no warning and lists the run under Notes, because no entry was ever meant
  to exist

### Requirement: A line is a warning only when a person has something to do about it

The report SHALL list under Warnings only a line that a person can act on, and the Slack message SHALL
state the number of those lines, zero included, followed in brackets by what the number means. A
ledger that spent and has no record, once its run ended with the verdict `stopped`, `escalated` or
`discarded`, SHALL be listed under Notes in its own sentence, and no warning count or warning line
SHALL include it. `site/scripts/spend-report-model.mjs` sorts each line.

#### Scenario: A discarded attempt and nothing else wrong

- **WHEN** a ledger is discarded, holds a generation and has no record, and every other ledger and
  record agrees
- **THEN** the report states the discard and its cost under Notes, the entries are still totalled, and
  the Slack message says `Warnings: 0`

#### Scenario: A failed write that the workflow escalated

- **WHEN** `site/scripts/escalate-run.mjs` has turned the stopped ledger of a failed write into
  `escalated`
- **THEN** its sentence is a note, because the run is settled and nothing a person does clears it

#### Scenario: A real mismatch

- **WHEN** a ledger records less writing spend than its record costs
- **THEN** the report lists it under Warnings, the record cost is still counted, and the Slack message
  counts it

#### Scenario: A message with no warning does not say the day was healthy

- **WHEN** every ledger agrees with its generation record
- **THEN** the Slack message says `Warnings: 0` and, in brackets, that every ledger agrees with its
  generation record and that this does not say that every run produced an entry

### Requirement: The report is committed with every change to the spend

Every commit that adds a call to a ledger or a record SHALL hold the regenerated report: the
unattended writer's one commit (`site/scripts/write-run.mjs`), a repair commit and the ledger-only
commit of a repair that spent and failed (`site/scripts/repair-finish.mjs`), and the commit of a
failed write (`.github/workflows/write-daily.yml`). Without it `npm run gate:autowriter` fails on
that branch or on `main`.

#### Scenario: A run writes an entry

- **WHEN** the writer commits an article
- **THEN** the same commit holds the report with a row for that article

#### Scenario: A repair adds a call

- **WHEN** a repair attempt adds a repair call to a record and an attempt to its ledger
- **THEN** the same commit holds the report regenerated from them, whose Repair column and paid
  tables count the repair

#### Scenario: A repair fails after it spent

- **WHEN** a repair made model calls and ended in an error
- **THEN** the commit that records its spend holds the regenerated report beside the ledger

#### Scenario: A write fails after it spent money

- **WHEN** the workflow commits the ledger that holds the spend of a failed write
- **THEN** the same commit holds the report regenerated from that ledger

### Requirement: Slack receives the numbers after every generation

After a successful write the daily workflow, `.github/workflows/write-daily.yml`, SHALL post one
message through the sender of `site/scripts/escalate-channels.mjs`: the cost of each entry just
written, the month sentence, the 30-day totals, the all-time totals with everything paid for, and
the warnings line, as lines of numbers and units. It SHALL post nothing built from zero records, and
no output of the step SHALL contain the webhook.

#### Scenario: Slack accepts the message

- **WHEN** the webhook answers with a 2xx status
- **THEN** the step exits zero and prints one line saying the message was delivered, with the status

#### Scenario: The write result names an entry no record holds

- **WHEN** the result of the write lists a slug and no generation record carries it
- **THEN** nothing is posted and the step exits non-zero naming the slug

#### Scenario: The ceiling status cannot be read

- **WHEN** the ceiling status of the run cannot be read
- **THEN** nothing is posted and the step exits non-zero with the reason

### Requirement: A day that ends with no entry still posts to Slack

When a daily run ends without an entry, `.github/workflows/write-daily.yml` SHALL post one message of
two lines through `node scripts/spend-ended.mjs`: that no entry was written on that UTC date, why,
and what the run cost, then the month sentence. The four endings are the ceiling reached, a picker
that chose nothing or chose to strengthen a page, a write that ended with no entry, and a write that
failed.

#### Scenario: The ceiling is reached

- **WHEN** the ceiling job stops the run
- **THEN** the message says that the month's spend reached the ceiling so the writer did not run,
  that the run cost 0.00 USD, and the month sentence says that none is left

#### Scenario: The picker chooses nothing

- **WHEN** the picker decides `none`, or decides `strengthen`
- **THEN** the message names the reason or the page chosen, and the run cost 0.00 USD

#### Scenario: Every draft was skipped

- **WHEN** the write step succeeds and lists no entry
- **THEN** the message names each skipped draft with its reason, and the run cost is the sum of the
  generation and the attempts in the ledger

#### Scenario: The write failed

- **WHEN** the write step fails after it spent
- **THEN** the message names the slug and the kind of failure, its cost is the ledger's, and it is
  posted after the escalation and after the ledger and the report were committed

#### Scenario: A step before the picker decided fails

- **WHEN** the demand refresh or the pick step itself fails
- **THEN** this message is not posted: the refresh has its own escalation, and a failed pick ends the
  job red, which is the signal

#### Scenario: The message carries nothing secret

- **WHEN** any of the four endings posts
- **THEN** the cost is read from the ledger of the run, and no line carries the failure text, the
  spend the writer printed or the webhook

#### Scenario: Slack refuses the message

- **WHEN** the webhook answers 404, or the request fails
- **THEN** the step ends non-zero with one receipt line, and no issue is opened and no ledger is
  written

### Requirement: A missed message is a red step and nothing more

A failed delivery of the statistics message SHALL end its step non-zero with one receipt line in the
words `describeDelivery` in `site/scripts/escalate.mjs` uses, and SHALL NOT open an issue, try another
channel, write a ledger or stop the pull request. An escalation that reached no one is a failure
`npm run gate:autowriter` refuses, and a missed statistic is not that.

#### Scenario: Slack refuses the message

- **WHEN** the webhook answers 404, or the request fails
- **THEN** the step exits non-zero and prints one line with the status and the reason, with the
  webhook removed, and no issue is opened and no ledger is written

### Requirement: A report that disagrees with its records is refused

`npm run gate:autowriter` SHALL regenerate the report from `audits/autowriter` with the instant
stamped in the committed file, and SHALL refuse a missing report, a report with no readable
`Generated-at` line and a report that differs from the regeneration, naming the first line that
differs or the missing line.

#### Scenario: A record is added and the report is not

- **WHEN** a generation record is committed and `audits/spend-report.md` is left as it was
- **THEN** the gate exits non-zero with `spend-report-differs`

#### Scenario: A figure is edited by hand

- **WHEN** a figure in the committed report is changed and no record changed
- **THEN** the gate exits non-zero with `spend-report-differs` and names the line

#### Scenario: The instant is removed

- **WHEN** the `Generated-at` line is deleted from the committed report
- **THEN** the gate exits non-zero with `spend-report-differs` and names `Generated-at`

#### Scenario: The report is deleted

- **WHEN** `audits/spend-report.md` does not exist
- **THEN** the gate exits non-zero with `spend-report-missing`, even when no record exists

### Requirement: The proof of the report guard does not depend on what the report says today

Each planted specimen of the report guard SHALL pin a token that the gate prints for every state of
the committed report, and a specimen that adds a record SHALL date it at the stamp of the committed
report, so that the proof holds for a report with no entry, a report with notes and a report with
entries alike.

#### Scenario: The first entry is merged

- **WHEN** the committed report goes from the variant with no entry to one that lists an entry
- **THEN** every specimen of the report guard still turns `gate:autowriter` red on the plant and
  leaves it green without it

#### Scenario: The report is stamped in another month

- **WHEN** the committed report is stamped in a month other than the one the specimen was written in
- **THEN** the specimen that adds a record files it in the month of the stamp, and the gate is red on it
