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

### Requirement: The length floor is measured from what a person wrote

The floor and the target for the body of each written format SHALL be measured from the hand-written
entries of that format and recorded in `audits/entry-length.json`. The floor SHALL be the smallest
value any of them holds, taken separately for prose words, for `##` sections and for the words of
the thinnest section. The target SHALL be the middle half of their word counts.
`npm run gate:autowriter` SHALL re-measure the corpus and refuse a record that differs.

#### Scenario: The floor is the least a person wrote

- **WHEN** the record is derived from the hand-written entries of a format
- **THEN** every one of them clears the limits of its format and the word floor equals the word
  count of the shortest, because a floor that the owner's own work fails is a gate nobody trusts

#### Scenario: A person adds, removes or changes an entry

- **WHEN** a hand-written entry is added, removed or changed so that a recorded number moves
- **THEN** `npm run gate:autowriter` fails naming `audits/entry-length.json` and the command that
  re-measures it, so the floor moves only in a commit that carries the re-measured record

#### Scenario: A limit is edited by hand

- **WHEN** a limit in the record is changed and the corpus is not
- **THEN** the gate fails with `length-record-limits-stale`, because the limits are the derivation of
  the recorded distribution and nothing else

#### Scenario: A hand-written entry has no section

- **WHEN** a hand-written entry of a format has no `##` section or no words
- **THEN** the measurement refuses to derive limits and writes nothing, and the gate reports
  `length-record-unmeasurable`, because a floor built on that entry would admit an empty body or one
  unbroken block

#### Scenario: The record is missing

- **WHEN** `audits/entry-length.json` does not exist
- **THEN** the gate reports `length-record-missing` and the writer stops with a configuration error
  that names the file and the command that writes it, so neither reads the absence as a pass

### Requirement: A generated entry clears the floor

A generated entry SHALL have a body of at least the recorded floor in prose words and in `##`
sections, and no section under the recorded section floor. `site/scripts/writer-preflight.mjs` SHALL
refuse a draft that breaks one of the three before anything is written, and `npm run gate:autowriter`
SHALL refuse a committed generated entry that does, naming the entry and the rule: `body-too-short`,
`too-few-sections` or `section-too-thin`.

#### Scenario: The first draft is short

- **WHEN** the model returns a body of fewer words than the floor
- **THEN** preflight reports `body-too-short` with the words counted, the floor and the middle half,
  and the correction message asks for more sections that rest on the sources the model already
  cites, never for cut text or a repeated field

#### Scenario: The correction is still short

- **WHEN** the draft returned after the one correction round still breaks a length rule
- **THEN** the run stops with an output error naming the rule, and no entry is written

#### Scenario: A short body is stretched without a section

- **WHEN** a body of two short sections is stretched past the word floor with an unbroken preface
- **THEN** it still fails with `too-few-sections` and `section-too-thin`, because padding adds words
  and not sections

#### Scenario: One section is a stub

- **WHEN** a section holds fewer words than the thinnest section of any hand-written entry of the
  format
- **THEN** `section-too-thin` names that section's heading and its word count

#### Scenario: A committed entry is under the floor

- **WHEN** an entry that has a generation record is shorter than the floor
- **THEN** `npm run gate:autowriter` fails naming the entry's path and each rule it breaks

### Requirement: The prompt states the measured length once

The writer prompt SHALL state the target length of the body once, with every number read from
`audits/entry-length.json` when the prompt is built and none typed into
`site/scripts/writer-prompt-text.mjs`. It SHALL name the buyer prompt the entry serves, state the
three floors, and say that the length is reached with more sections, each under its own heading, and
not with longer sentences or a restated takeaway.

#### Scenario: The record changes

- **WHEN** a limit in the record is edited
- **THEN** the next prompt built for that format states the edited number, because no number is typed
  into the prompt

#### Scenario: The record holds no limits for the format

- **WHEN** the record has no limits for the format of the claim
- **THEN** building the prompt fails with a configuration error that names the record and the format,
  and no default length is used

#### Scenario: The prompt names the buyer prompt and the way to the length

- **WHEN** the prompt is built for a claim
- **THEN** the range of the claim's format appears once, beside the number and the text of the
  claim's buyer prompt, followed by the sentence that says more sections reach the length

#### Scenario: A term is not asked for the length of an article

- **WHEN** the claim is a glossary term
- **THEN** the prompt holds the range of the term and never the range of the article

### Requirement: The prompt names the shapes of prose that no copied block states

The writer prompt SHALL carry one bullet, after the length of the body, that names the shapes of
prose which a reader sees and no gate measures and which no block copied from a repository file
states. The bullet SHALL NOT state a rule that a copied block already carries, and a test SHALL hold
that each shape it leaves out is still stated in the file the prompt copies it from.

#### Scenario: The prompt is built for an article or a term

- **WHEN** the prompt is built for a claim of either format
- **THEN** one line begins with `- shape of the prose` and names a paragraph that ends by saying
  again what it said, three paragraphs in a row that open on the same word, and a section added only
  for balance

#### Scenario: A copied block stops stating a shape

- **WHEN** a phrase the test holds in `site/.agents/skills/write-copy.md` or
  `site/.agents/skills/write-for-humans.md` is removed from the file
- **THEN** the test fails naming the shape, because the bullet must now name it
