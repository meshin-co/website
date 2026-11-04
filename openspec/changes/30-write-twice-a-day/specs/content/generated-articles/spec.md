## MODIFIED Requirements

### Requirement: A run writes one post, and the terms the glossary is missing

Every scheduled run SHALL produce exactly one blog post, taken from the ladder in the next
requirement and recorded in a claim with the measurement that justified it, which is none when the
category rung chose it. The same run SHALL also write a glossary term for each concept that
measured demand names and the glossary does not define, up to a configured cap, when the term arm
is enabled in configuration and a buyer prompt is available to carry it, the term's own or that of the
post. Each entry SHALL carry its own claim and its own generation record.

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
- **THEN** no entry is created for that query and the ladder descends to the next candidate; a measured
  strengthen candidate stays in the digest for a human, and the decision is `strengthen` only when no
  rung can write

#### Scenario: A term has no buyer prompt to carry

- **WHEN** the post of the run has no buyer prompt, because it came from a weak query or a
  category, and a missing term does not map to a prompt of its own either
- **THEN** the term is named in the digest with the reason that it has no prompt, and it is not
  written

### Requirement: A generated entry carries its provenance

Every generated entry SHALL be accompanied, in the same commit, by a generation record naming the
provider, the model id as resolved at call time, the response id, a digest of the prompt, the origin
of the topic and, when a demand row selected it, that row, the tree fingerprint, the token counts
and the computed cost. The record SHALL NOT contain any secret value.

#### Scenario: A reader disputes a sentence a month later

- **WHEN** someone asks where a published sentence came from
- **THEN** the generation record names the model and the prompt digest, and the claim-to-source
  table names the source each load-bearing sentence rests on

#### Scenario: The record is scanned for leaks

- **WHEN** the generation record is serialised
- **THEN** it carries variable names and digests only, and a test asserts that no configured secret
  value appears anywhere in it

## ADDED Requirements

### Requirement: The topic comes from a ladder of three rungs

The picker SHALL try three rungs in order and stop at the first that yields an article topic: an
unproven buyer prompt that no refusal removes, then a measured query that no buyer prompt names and
no page answers, then a category of the configured rotation, for which one model call proposes the
target query. The run SHALL end without an entry only when no rung yields a topic.

#### Scenario: No buyer prompt survives

- **WHEN** every buyer prompt is proven or refused and the report holds a measured query that reads
  as a question or a how-to and that no buyer prompt names and no page answers
- **THEN** the run writes on the one with the most impressions, and its claim and record are marked `weak-demand` with the
  reasons it is weak, computed from the row: it has no buyer prompt, its impressions equal the floor,
  or its position lies beyond the strengthen band

#### Scenario: The report is empty and categories are configured

- **WHEN** the demand report holds no usable row, as it does for a site with almost no traffic
- **THEN** the run writes on a category, and its claim and record are marked `category`

#### Scenario: Nothing can be written

- **WHEN** no buyer prompt survives, the report holds no usable query, and the category list is
  empty
- **THEN** the run ends with no entry through the existing no-entry path and its Slack message,
  because the writer would otherwise have nothing to write about

#### Scenario: Every proposal is refused

- **WHEN** every configured category was tried and every proposal was refused or failed
- **THEN** the run ends with no entry through the same path, and the trail of the decision names
  each refusal

#### Scenario: A weak or category entry has no buyer prompt

- **WHEN** an entry is written from the second or third rung
- **THEN** its claim carries no prompt, the writer's prompt names the query and the origin instead
  of a buyer prompt, and the buyer prompts section of `docs/SEMANTIC-CORE.md` is left unchanged

### Requirement: A category entry is a specific article and never a repeat

The next category SHALL be derived from the corpus and never stored: the configured category with
the fewest published entries and unexpired category claims, ties broken by the oldest newest entry,
then by the order of the configuration. A proposal SHALL be refused when its query names a concept
the register assigns to another page, when its slug or title is already published or claimed, or
when the stems of its title and query overlap an existing article's by at least half of the smaller
set.

#### Scenario: The same category comes up again

- **WHEN** a category with a published entry comes up and the model proposes a rewording of that
  entry's subject
- **THEN** the proposal is refused as the same subject, the model is asked again once with the
  refusal, and a different proposal is written or the next category is tried

#### Scenario: An entry is deleted or a branch is abandoned

- **WHEN** a published entry is removed or a claim lapses
- **THEN** the rotation changes by itself on the next run, because it counts what the corpus
  holds and keeps no counter

#### Scenario: Two runs are in flight

- **WHEN** a category entry is claimed and not yet published
- **THEN** the claim counts toward its category, so the next run takes a different category

#### Scenario: A proposal defines a registered concept

- **WHEN** the proposed query names a concept that the register assigns to another page
- **THEN** the proposal is refused before any claim is committed, so no concept is defined twice

### Requirement: Every entry records where its topic came from

Every claim and every generation record SHALL carry an origin, one of `demand`, `weak-demand` or
`category`, and a claim written before the ladder existed SHALL read as `demand`. An entry of origin
`weak-demand` SHALL list the reasons it is weak. An entry of origin `category` SHALL name its
category. Neither SHALL carry a buyer prompt.

#### Scenario: The owner counts what was written blind

- **WHEN** the owner reads the generation records
- **THEN** the number of entries of each origin, their cost and the categories of the blind entries
  are countable from the records alone

#### Scenario: A category claim names a prompt

- **WHEN** a committed claim of origin `category` carries a buyer prompt or lacks its category
- **THEN** the autowriter gate fails and names the claim
