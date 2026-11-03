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
