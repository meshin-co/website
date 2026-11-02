# content/generated-articles Specification

## Purpose

Governs the entries the unattended writer produces: one blog post per run, the glossary terms that
measured demand says are missing, and the claim, the provenance record, the claim-to-source table
and the sentence-length band each of them carries. One adapter stands between the pipeline and the
writing vendor, `site/scripts/write-entry.mjs` runs it, and `npm run gate:autowriter` judges what it
left behind, offline and with no secret. A concept that already owns a register row is never
written twice: that is a strengthen report for a human, because rewriting published copy is not an
unattended act.

## Requirements

### Requirement: A run writes one post, and the terms the glossary is missing

Every scheduled run SHALL produce exactly one blog post, chosen from the committed demand report
and recorded in a claim with the measurement that justified it. The same run SHALL also write a
glossary term for each concept that measured demand names and the glossary does not define, up to
a configured cap, when the term arm is enabled in configuration. Each entry SHALL carry its own
claim and its own generation record.

#### Scenario: Demand names no concept the glossary lacks

- **WHEN** every concept in the report already owns a row in the concept register
- **THEN** the run writes its post and no term, because one concept is defined on exactly one page
  and a second page for it would compete with the first

#### Scenario: The term arm is switched off

- **WHEN** configuration disables the term arm, as a site with no glossary would
- **THEN** the run writes its post alone, and the missing concepts are named in the digest rather
  than written

#### Scenario: Demand names more missing concepts than the cap allows

- **WHEN** the number of missing concepts exceeds the configured cap for one run
- **THEN** the run writes up to the cap, chosen by measured impressions, and names the remainder in
  the digest, so an unattended night cannot add an unbounded number of pages

#### Scenario: A concept already has a page

- **WHEN** the selected query names a concept that already owns a row in the concept register
- **THEN** no entry is created for it and the run reports a strengthen decision for a human,
  because rewriting published copy is not an unattended act

### Requirement: A generated entry carries its provenance

Every generated entry SHALL be accompanied, in the same commit, by a generation record naming the
provider, the model id as resolved at call time, the response id, a digest of the prompt, the demand
row that selected the topic, the tree fingerprint, the token counts and the computed cost. The
record SHALL NOT contain any secret value.

#### Scenario: A reader disputes a sentence a month later

- **WHEN** someone asks where a published sentence came from
- **THEN** the generation record names the model and the prompt digest, and the claim-to-source
  table names the source each load-bearing sentence rests on

#### Scenario: The record is scanned for leaks

- **WHEN** the generation record is serialised
- **THEN** it carries variable names and digests only, and a test asserts that no configured secret
  value appears anywhere in it

### Requirement: Every load-bearing claim resolves to a source

The writer SHALL emit, in the same call, a table binding each load-bearing sentence to the source it
rests on, and SHALL mark a sentence that rests on no source as the author's own reading. Every
source referenced SHALL appear in the entry's sources with a retrieval date.

#### Scenario: A claim names no source

- **WHEN** a sentence asserts a fact and the table binds it to nothing
- **THEN** the gate fails naming the sentence, because a sourced count is not a sourced claim

### Requirement: The configured model is checked before the first call

The adapter SHALL validate the configured model id against the vendor's own model list on the first
call of a run.

#### Scenario: The model variable holds a name the vendor does not serve

- **WHEN** the configured model id is absent from the vendor's list
- **THEN** the run fails naming the variable and the value it held, before any article is written

#### Scenario: The model is scheduled to be withdrawn

- **WHEN** the vendor's list carries a shutdown date for the configured model
- **THEN** the run proceeds and the digest names the model and the date, so the variable is changed
  before the morning it stops working rather than after

### Requirement: Generated prose does not collapse into the gates

Generated prose SHALL sit inside the sentence-length band measured from the hand-written corpus, and
the measured band SHALL be recorded alongside the threshold it produced.

#### Scenario: The writer games the duplicate-sentence rule

- **WHEN** an entry's sentences cluster just below the length at which the cross-route duplicate
  rule binds
- **THEN** the gate fails naming the measured distribution and the band, because clearing a rule by
  shortening every sentence is not writing
