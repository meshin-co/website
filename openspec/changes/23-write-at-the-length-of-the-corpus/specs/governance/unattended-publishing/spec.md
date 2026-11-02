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
