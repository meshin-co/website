# governance/unattended-publishing Specification

## Purpose

Governs what the machine may publish without a person and the bounds that make it safe to leave
alone: a claim committed before the model is called, a watcher that judges a pull request by the job
that failed and merges only after a quarantine window, a repair loop bounded to the article's own
text, a monthly spend ceiling, and a daily workflow that stops when its demand refresh fails.
Automation never runs the disposition seal and never writes the Lighthouse record, so a merged
article leaves a measurement debt for the owner. `npm run gate:autowriter` judges the ledgers and
the pipeline's own commits afterwards.

## Requirements

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

### Requirement: The watcher classifies by the failing job

The watcher SHALL read the checks of the pull request's head commit for the pull-request event's
own workflow run and SHALL identify the single job whose conclusion is `failure`. A `cancelled`
conclusion on a sibling job SHALL NOT by itself be treated as a stop, because the repository
cancels its own run whenever a job fails.

#### Scenario: One gate fails and the run cancels itself

- **WHEN** a content gate fails and the cancelling job terminates the remaining jobs
- **THEN** the watcher reports the failing gate by name and classifies the cause from its findings,
  rather than reporting the cancelling job or treating every cancelled sibling as unrepairable

#### Scenario: The head commit carries no checks

- **WHEN** the head commit of the branch has zero check runs, or a content gate reports `skipped`
- **THEN** the watcher stops and escalates, and SHALL NOT merge, because an absent check is not a
  passing one

#### Scenario: Checks are unsettled

- **WHEN** some checks are still running
- **THEN** the watcher dispatches a successor and exits, and SHALL NOT hold a job open waiting

### Requirement: Merge happens only after a quarantine window

The watcher SHALL merge only when every expected check for the head commit has concluded
successfully and the quarantine window stated in the configuration has elapsed since the pull
request was opened. The quarantine SHALL be measurable from the pull request alone.

#### Scenario: The owner intervenes during quarantine

- **WHEN** the owner closes the pull request, pushes to its branch or applies the configured hold
  label before the window elapses
- **THEN** the watcher stops without merging and records the reason

### Requirement: Repair is bounded to the article's own text

Automated repair SHALL change only the article entry's prose and frontmatter, SHALL make at most
the configured number of attempts, and SHALL write its attempt ledger inside the repair commit.
A failure SHALL be fingerprinted by its rule and path only.

#### Scenario: The same rule fails twice

- **WHEN** a repair attempt produces a failure whose rule and path match an earlier attempt
- **THEN** the loop escalates immediately rather than spending the remaining attempts

#### Scenario: A failure the article did not cause

- **WHEN** the failing job is not a content gate, or the finding names a path outside the article
  and its ledgers
- **THEN** the loop opens an issue, notifies Slack and stops, leaving the branch for a human

### Requirement: Automation cannot certify what no human read

The pipeline SHALL NOT run the disposition seal, and SHALL NOT write the recorded Lighthouse
measurement. A merged article SHALL record the measurement debt it leaves.

#### Scenario: The editorial gate reports stale dispositions

- **WHEN** a repair attempt faces a stale disposition
- **THEN** it rewrites the disposition's reason for the text it just wrote, and any attempt to
  reach the seal path fails

### Requirement: Spend is recorded and capped

Every run SHALL record its token counts and computed cost in its ledger. When the configured
monthly ceiling is reached the workflow SHALL stop and notify, rather than continuing at reduced
quality or silently.

#### Scenario: The ceiling is reached mid-month

- **WHEN** the recorded spend for the current month reaches the ceiling
- **THEN** the daily run exits without calling the model, posts one message naming the ceiling and
  the spend, and does not post again until the next month

### Requirement: A failed demand refresh stops the run

The daily workflow SHALL refresh the committed demand report before selection and SHALL escalate
when the refresh fails, rather than selecting from the previous report.

#### Scenario: The credential is dead

- **WHEN** the Search Console request fails to authenticate
- **THEN** the run stops, notifies Slack naming the secret, and leaves the committed report
  untouched and visibly unrefreshed

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

### Requirement: The pipeline cannot move the floor it is judged by

The pipeline SHALL NOT change `audits/entry-length.json`. `site/scripts/autowriter-refusals.mjs`
SHALL refuse the path in every commit the pipeline assembles, including a spelling with a dot
segment or other capitals, and `npm run gate:autowriter` SHALL refuse a pipeline commit already in
history that touched it.

#### Scenario: A run writes the record

- **WHEN** a commit the pipeline assembles, whether the entry commit, the repair commit or a commit
  to the default branch, carries `audits/entry-length.json`
- **THEN** the commit is refused naming the row `entry-length` and its reason, before git is
  touched

#### Scenario: The path is spelled another way

- **WHEN** the path carries a dot segment or different capitals
- **THEN** it is refused as the same file, and a path that only resembles it, such as a `.bak` copy
  or the same file name under another directory, is not

#### Scenario: A pipeline commit already touched the record

- **WHEN** a commit the pipeline authored carries a generation record and also changes the record
- **THEN** `npm run gate:autowriter` fails with `refused-path-committed` on that generation record,
  naming the commit

### Requirement: The length measurement leaves out what the pipeline wrote

The measurement that writes `audits/entry-length.json` SHALL leave out every entry that has a
generation record, so that a generated entry never feeds the floor it is judged against.
`npm run gate:autowriter` SHALL re-measure the entries a person wrote with the same exclusion and
refuse a record that differs.

#### Scenario: A short generated entry joins the corpus

- **WHEN** a generated entry shorter than the floor is committed with its generation record
- **THEN** a fresh measurement leaves it out, the record stays fresh and the floor stays where it
  was, and the entry is judged against that floor and fails

#### Scenario: The record is re-measured with the generated entry counted

- **WHEN** the record is written by a measurement that counts a generated entry shorter than the
  floor
- **THEN** `npm run gate:autowriter` fails with `length-record-corpus-stale`,
  `length-record-distribution-stale` and `length-record-limits-stale` on the record, because a fresh
  measurement leaves that entry out

#### Scenario: The measurement says what it left out

- **WHEN** the measurement runs over a corpus that holds entries with generation records
- **THEN** it prints how many entries it left out and their slugs, so a reader can see that the floor
  rests on entries a person wrote

### Requirement: The pipeline cannot remove the evidence the measurements exclude by

The pipeline SHALL NOT remove a generation record, because the sentence band and the entry length
record leave out every entry that has one. `site/scripts/autowriter-refusals.mjs` SHALL refuse a
removal as `generation-record-removed`, `site/scripts/commit-to-main.mjs` SHALL refuse it before
anything is committed, and `npm run gate:autowriter` SHALL refuse one already in history. Adding or
changing a record SHALL stay allowed.

#### Scenario: A pipeline commit removes a record

- **WHEN** a commit by the bot, or a commit that names the record in a `Provenance:` line, removes a
  generation record
- **THEN** `npm run gate:autowriter` fails with `generation-record-removed-committed` on the removed
  record, with the detail `removed <record path> (generation-record-removed: <reason>)` and the first
  12 hex characters of the commit

#### Scenario: A pipeline commit renames or moves a record

- **WHEN** a commit by the pipeline renames a generation record, moves it out of the directory, moves
  it under another name in the directory or moves it to a deeper directory
- **THEN** the commit is read with renames off, as a removal of the old path and an addition of the new
  one, and the removal is refused as `generation-record-removed`

#### Scenario: A pipeline commit changes or adds a record

- **WHEN** a commit by the pipeline changes a generation record, or adds one, including by moving a
  file into the directory from elsewhere
- **THEN** it is not refused for the record, because the pipeline writes them

#### Scenario: A person removes a record

- **WHEN** a commit by a person removes a generation record
- **THEN** the history rule does not refuse it, because a person may delete one in a diff anyone can
  read, and the re-measure the removal forces shows in the same diff

#### Scenario: The removal reaches the default branch through the commit sink

- **WHEN** `site/scripts/commit-to-main.mjs` is given the path of a generation record that is gone
  from the working tree
- **THEN** it refuses the commit naming `generation-record-removed` and its reason, unstages the
  listed paths, and commits and pushes nothing

#### Scenario: The refusal matches a path pattern

- **WHEN** a path is a `.json` file under `audits/autowriter/generations`, flat, in the `<year>/<month>`
  directory of its claim or below it, spelled with a dot segment, a backslash or other capitals
- **THEN** it is refused as a record on its old path, and a path in a sibling directory such as
  `audits/autowriter/generations-old` or a file of another extension is not a record

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
