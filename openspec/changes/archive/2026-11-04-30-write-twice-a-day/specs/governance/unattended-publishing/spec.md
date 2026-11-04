## MODIFIED Requirements

### Requirement: A run claims its topic before it spends

The pipeline SHALL commit a claim to the default branch before the writing model is called. The
claim SHALL name the slug, the title, the format, the target query, the impressions and position
that justified it (zero impressions and no position for an entry chosen from a category), the
prompt it serves when it serves one, the origin of its topic, the run id and an expiry. A topic
SHALL NOT be selected while an unexpired claim holds its title or its slug.

#### Scenario: A run dies between selection and drafting

- **WHEN** a scheduled run stops after the claim is committed and before a branch exists
- **THEN** the claim remains on the default branch as a readable orphan, and the next run either
  adopts it or lets it expire, rather than reselecting the same topic blindly

#### Scenario: The title already exists

- **WHEN** the candidate title matches a title in the generated layer of `docs/SEMANTIC-CORE.md`
  or an unexpired claim, compared after case folding and punctuation normalisation
- **THEN** the candidate is refused and the next candidate is taken, and the refusal is recorded in
  the run's ledger with the title it collided with

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

- **WHEN** the writer runs at the configured times, two a day as shipped
- **THEN** one directory holds the records of one month only, so at most thirty-one days of runs, and
  an older month never adds to it

## ADDED Requirements

### Requirement: The schedule is configuration and the workflow is generated from it

The times at which the writer runs SHALL be a list of UTC clock times in the engine configuration,
at least one, each a zero-padded `HH:MM` in 24 hours, none repeated. The schedule block of the
writer's workflow SHALL be generated from the list, and a gate SHALL fail when the committed
workflow differs from a regeneration. No code SHALL assume that a run started at the time it names.

#### Scenario: A cron line is edited by hand

- **WHEN** a cron line of the workflow is changed, added or removed without changing the list
- **THEN** the schedule gate fails, names the line or the time that differs and says which command
  regenerates the block

#### Scenario: The list is empty

- **WHEN** the configured list holds no time
- **THEN** the configuration is refused at load with a message that says the writer is paused by
  disabling the workflow or leaving a required secret unset, and a cron block never disappears
  without anyone being told

#### Scenario: A time is malformed or repeated

- **WHEN** an entry is not a zero-padded `HH:MM` between `00:00` and `23:59`, or appears twice
- **THEN** the configuration is refused at load, naming the entry and its position in the list

#### Scenario: A run starts late

- **WHEN** GitHub starts a scheduled run many minutes after the time it names
- **THEN** the run behaves exactly as it would at the named time, because no script reads the
  configured times except the ones that generate and check the schedule

### Requirement: Two runs cannot claim the same topic

Overlapping runs SHALL be serialised by one concurrency group that never cancels a running run.
Each run SHALL start from the current tip of the default branch, so that a run which queued behind
another sees its claim and refuses the topic at selection, whichever month the claim was made in.
When a run nevertheless selects from a stale tree a topic whose claim exists at the same path, the
claim commit SHALL conflict, push nothing and stop the run before the writer step.

#### Scenario: A slow first run is still writing when the second starts

- **WHEN** the second run starts from a tree that does not hold the first run's claim and selects
  the same topic
- **THEN** the claim commit conflicts on the claim path, nothing is pushed, exactly one claim
  exists on the default branch, and the run stops before the writer step calls any model

#### Scenario: The second run starts from the current tip

- **WHEN** the first run's claim is already on the default branch
- **THEN** the second run refuses that topic at selection and takes a different one

#### Scenario: The first claim was made in the previous month

- **WHEN** a claim was committed in one calendar month and a run in the next month selects the
  same slug
- **THEN** the selection refuses it, because a claim or a ledger for the slug exists in some month
