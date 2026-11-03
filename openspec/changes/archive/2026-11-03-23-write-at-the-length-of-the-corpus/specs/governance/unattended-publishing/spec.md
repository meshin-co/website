# governance/unattended-publishing Specification

## ADDED Requirements

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
