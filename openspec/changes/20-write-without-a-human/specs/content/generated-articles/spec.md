# content/generated-articles Specification

## ADDED Requirements

### Requirement: The format follows the query

A generated entry SHALL take the format that answers its target query: a definitional query becomes
a glossary term, an interrogative query becomes a FAQ answer, and a procedural query becomes a blog
article. The format decision and the query that drove it SHALL be recorded in the run's claim.

#### Scenario: The concept already has a page

- **WHEN** the selected query names a concept that already owns a row in the concept register
- **THEN** no new entry is created and the run strengthens the existing route instead, because one
  concept is defined on exactly one page

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
