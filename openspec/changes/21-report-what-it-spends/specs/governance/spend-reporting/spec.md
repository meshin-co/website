# governance/spend-reporting Specification

## ADDED Requirements

### Requirement: One report states what every generated entry cost

The pipeline SHALL keep `audits/spend-report.md`, regenerated from the generation records by
`site/scripts/spend-report.mjs` and never appended to. It SHALL hold one row per record with its
instant, format, slug, tokens and cost, and SHALL state the model and the rates each cost was
computed at.

#### Scenario: Nothing has been generated

- **WHEN** no generation record exists
- **THEN** the report says in words that no entry has been generated, and holds no row, no total and
  no rate

#### Scenario: The same records are rendered twice

- **WHEN** the report is regenerated from an unchanged set of records, on another day or from
  another commit
- **THEN** the file is byte for byte the same

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

### Requirement: An incomplete corpus is reported, not summed in silence

When a ledger records a generation and no generation record carries its slug, when a record names a
ledger that does not exist, when a record and its ledger disagree about writing spend, or when a file
cannot be read, the report SHALL print one sentence naming the slug or the file and what is wrong, in
the form `spendWarnings` in `site/scripts/spend-sum.mjs` already uses for writing spend.

#### Scenario: A record is missing

- **WHEN** a ledger that is not stopped records a generation and no record carries its slug
- **THEN** the report names the slug and says no entry is counted for it, and the entries that do
  exist are still totalled

#### Scenario: A run stopped before it wrote anything

- **WHEN** a ledger is stopped, holds a generation and has no record
- **THEN** the report prints no warning, because no entry was ever meant to exist

### Requirement: The report is committed with the entry it counts

The unattended writer's one commit SHALL include the regenerated report, written by
`site/scripts/write-run.mjs`. A repair adds repair calls to a record and no writing call, so it SHALL
leave the report as it was.

#### Scenario: A run writes an entry

- **WHEN** the writer commits an article
- **THEN** the same commit holds the report with a row for that article

#### Scenario: A repair adds a call

- **WHEN** a repair attempt adds a repair call to a record
- **THEN** the report regenerated from that record is byte for byte the report before the repair

### Requirement: Slack receives the numbers after every generation

After a successful write the daily workflow, `.github/workflows/write-daily.yml`, SHALL post one
message through the sender of `site/scripts/escalate-channels.mjs`: the cost of each entry just
written, the 30-day totals and the all-time totals, as lines of numbers and units. It SHALL post
nothing built from zero records, and no output of the step SHALL contain the webhook.

#### Scenario: Slack accepts the message

- **WHEN** the webhook answers with a 2xx status
- **THEN** the step exits zero and prints one line saying the message was delivered, with the status

#### Scenario: The write result names an entry no record holds

- **WHEN** the result of the write lists a slug and no generation record carries it
- **THEN** nothing is posted and the step exits non-zero naming the slug

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

`npm run gate:autowriter` SHALL regenerate the report from `audits/autowriter` and refuse a missing
report and a report that differs from the regeneration, naming the first line that differs.

#### Scenario: A record is added and the report is not

- **WHEN** a generation record is committed and `audits/spend-report.md` is left as it was
- **THEN** the gate exits non-zero with `spend-report-differs`

#### Scenario: A figure is edited by hand

- **WHEN** a figure in the committed report is changed and no record changed
- **THEN** the gate exits non-zero with `spend-report-differs` and names the line

#### Scenario: The report is deleted

- **WHEN** `audits/spend-report.md` does not exist
- **THEN** the gate exits non-zero with `spend-report-missing`, even when no record exists
