# governance/unattended-publishing Specification

## ADDED Requirements

### Requirement: The writer files each entry's records under the month of its claim

The attempt ledger, the topic claim, the generation record and the editorial disposition of one
generated entry SHALL each be filed as `<directory>/<year>/<month>/<file>.json`. The month SHALL be the
UTC month of the claim's `claimedAt`, never the time at which a file is read or written.

#### Scenario: A run crosses midnight

- **WHEN** an entry is claimed at 23:59:59 UTC on the last day of a month and its records are written
  after midnight
- **THEN** all four records are filed under the month of the claim, not under the month of the clock

#### Scenario: A reader runs a year later

- **WHEN** a record is read a year after it was written
- **THEN** the path derived from its own claim is the path where it already lies, and nothing moves it

#### Scenario: A directory stays small

- **WHEN** the writer runs once a day
- **THEN** one directory holds at most thirty-one entries of one family

### Requirement: One function builds the path of every record

One function SHALL turn a record family, a slug and a date into the path of a record, and every writer
SHALL call it. No other code SHALL spell a record directory.

#### Scenario: A date that is not a UTC instant

- **WHEN** the function is given a date that is not a UTC instant, or a slug that is not a slug
- **THEN** it refuses, and no record is filed in an odd place

### Requirement: The ledger and the generation record stay two files

The attempt ledger and the generation record SHALL stay separate files, because the spend each one
records is reconciled against the other.

#### Scenario: The ledger and the generation record disagree

- **WHEN** the cost the ledger records for an entry differs from the cost its generation record records
- **THEN** the spend reader names the entry and both figures, because the two files are written
  separately so that they can be compared

### Requirement: A record outside its month directory fails the gate

`npm run gate:autowriter` SHALL fail on any ledger, claim, generation record or generated disposition
that is not filed under `<year>/<month>`, and on any that is filed under a month other than the month of
its claim, and the finding SHALL name the file and the path it belongs at. The hand-written disposition
files, which are named for the layer of the site they cover and not for an entry, SHALL stay where they
are.

#### Scenario: A stray flat record

- **WHEN** a ledger lies directly in `audits/autowriter/`
- **THEN** the gate exits 1 with a `record-layout` finding that names the file and its month path

#### Scenario: A record in the wrong month

- **WHEN** a record is filed under a month other than the month of its claim
- **THEN** the gate exits 1 and the finding says which month the claim puts it in

#### Scenario: A slug is claimed again after its first claim lapsed

- **WHEN** a claim lapsed without an entry and the same slug is claimed again in a later month, so two
  claim files carry the slug, each filed under the month of its own claim
- **THEN** the gate reports no `record-layout` finding for either file, and a record of that slug is
  filed correctly under the month of either claim

#### Scenario: A hand-written disposition

- **WHEN** `audits/phase-4.7/dispositions/routes.json` lies flat, as it always has
- **THEN** the gate reports no finding for it, while a flat `generated-<slug>.json` is a finding

### Requirement: Every reader of the records finds a record at any depth and says how many it read

The gate, the spend reader, the topic picker, the editorial reader, the repair and the pull-request
watcher SHALL find a record wherever it lies under its family directory, and the summary of each reader
that has one SHALL state how many files it read, so that a layout change that left a reader finding
nothing shows as a count of zero and not as a pass.

#### Scenario: The same count before and after a move

- **WHEN** the records of one repository are read flat and then read again after they are moved into
  their months
- **THEN** every reader reports the same count both times

#### Scenario: A record written before the layout changed

- **WHEN** a generation record on a branch that has not merged names its ledger at the flat path
- **THEN** the spend reader counts its cost like any other, and a record the schema refuses is named
  with its path and fails the reader instead of being skipped

#### Scenario: The spend reader finds no ledger

- **WHEN** ledgers exist and the spend reader reports zero ledgers
- **THEN** the zero is printed in its output, so the ceiling that never fires is visible

#### Scenario: A claim is read for a slug that was claimed twice

- **WHEN** a reader looks up the claim of a slug that has a lapsed claim in an earlier month and a live
  claim in a later one
- **THEN** it takes the claim of the later month, and it still refuses a claim filed outside its month
  directory beside another, because it could not tell which file is the claim

### Requirement: The monthly spend counts every call the machine paid for

The monthly spend SHALL be the sum, in whole micro-dollars, of three parts, each dated by its own
instant: the writing calls of each run, the repair calls, and the spend of a ledger that no record
names. `site/scripts/spend-sum.mjs` SHALL be the only code that adds them, so that the report and the
ceiling job count the same parts. The report states the third part as two figures by the verdict of
the ledger, and the sum does not change.

#### Scenario: An entry needed repairs

- **WHEN** a ledger holds a generation of 1.00 USD and one attempt of 0.50 USD
- **THEN** the month that holds both counts 1.50 USD

#### Scenario: A repair failed

- **WHEN** a ledger holds an attempt whose repair produced no repaired entry, so no record holds its
  calls
- **THEN** its cost is counted and no warning is raised, because that is what a failed repair costs

#### Scenario: A record shows more than its ledger

- **WHEN** the writing calls of a record cost more than the generation of its ledger, or the record
  holds repair calls that cost more than the attempts of its ledger
- **THEN** the larger cost is counted and one sentence names the slug and both figures

### Requirement: Each generation record is paired with the ledger it names

`site/scripts/spend-sum.mjs` SHALL pair each generation record with the ledger it names, so that the
record of a glossary term joins the run that wrote it and is not read as a ledger of its own. A record
whose ledger is not in the repository SHALL be counted from the record alone, and the spend reader
SHALL say so in one sentence naming the slug and the missing ledger.

#### Scenario: A term is written in the run of an article

- **WHEN** the generation record of a glossary term names the ledger of the article's run
- **THEN** the term joins that run and adds its writing calls to it, and the spend reader does not read
  the term as a ledger

#### Scenario: A record whose ledger is gone

- **WHEN** a generation record names a ledger that does not exist
- **THEN** its calls are counted from the record, and one sentence names the slug and the missing ledger

### Requirement: A repair that spent money and failed records its spend

A repair that made at least one model call and ended in any error SHALL make one local commit that
holds the ledger of the entry, with one attempt added that carries the spend, and the spend report that
counts it, and nothing else. The sha of that commit SHALL be put on the error it throws, so that the
workflow pushes it. A repair that made no model call SHALL make no commit.

#### Scenario: The model answered and the rewrite broke the build

- **WHEN** a repair made two model calls and the assembled entry fails to build
- **THEN** the ledger gains an attempt whose cost is the cost of those two calls, in a commit that holds
  the ledger and the report, and the monthly spend counts it

#### Scenario: The repair refuses before any call

- **WHEN** a repair refuses before it calls the model
- **THEN** no commit is made and no attempt is added

#### Scenario: The commit says what it is

- **WHEN** a repair that spent has ended in an error
- **THEN** the subject of its commit is `fix(autowriter): record the spend of a repair of <slug> that ended as <outcome>`, it carries a `Provenance:` trailer that names the generation record and no `Gates:` line, and the entry and the generation record do not change

#### Scenario: The spend cannot be recorded

- **WHEN** the commit fails, the attempt cap is reached or the ledger would be invalid
- **THEN** the error that the repair throws is the original one, and its message ends with `; the spend of this repair could not be recorded: <reason>`

### Requirement: A held slug is refused without an unsafe remedy

When the slug of a topic already has a ledger, claiming the topic SHALL be refused, and the reason SHALL NOT
tell anyone to remove the ledger, because the ledger records spend that the monthly ceiling counts. The
reason SHALL say that an earlier run owns the slug and that no procedure frees a slug safely.

#### Scenario: A slug that an earlier run owns

- **WHEN** a topic names a slug that already has a ledger
- **THEN** the refusal names the ledger, says that an earlier run owns the slug, and does not tell anyone to
  remove it
