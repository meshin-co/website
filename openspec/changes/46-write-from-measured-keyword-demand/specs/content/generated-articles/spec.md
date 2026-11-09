## RENAMED Requirements

- FROM: `### Requirement: The topic comes from a ladder of three rungs`
- TO: `### Requirement: The topic comes from a ladder of four rungs`

## MODIFIED Requirements

### Requirement: The topic comes from a ladder of four rungs

The picker SHALL try four rungs in order and stop at the first that yields an article topic: an
unproven buyer prompt that no refusal removes, then a measured query that no buyer prompt names and
no page answers, then a keyword candidate of `audits/keyword-demand.md` whose concept no register row owns, then a category of the
configured rotation, for which one model call proposes the target query. The run SHALL end without
an entry only when no rung yields a topic. The order is enforced by `site/scripts/topic-selection.mjs`.

#### Scenario: No buyer prompt survives

- **WHEN** every buyer prompt is proven or refused and the report holds a measured query that reads
  as a question or a how-to and that no buyer prompt names and no page answers
- **THEN** the run writes on the one with the most impressions, and its claim and record are marked `weak-demand` with the
  reasons it is weak, computed from the row: it has no buyer prompt, its impressions equal the floor,
  or its position lies beyond the strengthen band

#### Scenario: Search Console gives no lead and a keyword candidate exists

- **WHEN** no buyer prompt survives, the demand report holds no usable query, and
  `audits/keyword-demand.md` lists a candidate whose concept no register row owns
- **THEN** the run writes on that candidate and not on a category, and its claim and record are marked
  `keyword`

#### Scenario: The report is empty and categories are configured

- **WHEN** the demand report holds no usable row and no keyword candidate survives
- **THEN** the run writes on a category, and its claim and record are marked `category`

#### Scenario: Nothing can be written

- **WHEN** no buyer prompt survives, the report holds no usable query, no keyword candidate survives,
  and the category list is empty
- **THEN** the run ends with no entry through the existing no-entry path and its Slack message,
  because the writer would otherwise have nothing to write about

#### Scenario: Every proposal is refused

- **WHEN** every configured category was tried and every proposal was refused or failed
- **THEN** the run ends with no entry through the same path, and the trail of the decision names
  each refusal

#### Scenario: A weak or category entry has no buyer prompt

- **WHEN** an entry is written from the second, third or fourth rung
- **THEN** its claim carries no prompt, the writer's prompt names the query and the origin instead
  of a buyer prompt, and the buyer prompts section of `docs/SEMANTIC-CORE.md` is left unchanged

### Requirement: Every entry records where its topic came from

Every claim and every generation record SHALL carry an origin, one of `demand`, `weak-demand`,
`keyword`, `category` or `ordered`, and a claim written before the ladder existed SHALL read as
`demand`. An entry of origin `weak-demand` SHALL list the reasons it is weak. An entry of origin
`keyword` SHALL carry its phrase and a demand of its exact impressions with a null position. An entry
of origin `category` SHALL name its category. An entry of origin `ordered` SHALL carry the buyer prompt
it was ordered by when the order named a number, and none when the order named a title. No entry of
origin `weak-demand`, `keyword` or `category` SHALL carry a buyer prompt.

#### Scenario: The owner counts what was written blind

- **WHEN** the owner reads the generation records
- **THEN** the number of entries of each origin, their cost and the categories of the blind entries
  are countable from the records alone

#### Scenario: A category claim names a prompt

- **WHEN** a committed claim of origin `category` carries a buyer prompt or lacks its category
- **THEN** the autowriter gate fails and names the claim

#### Scenario: An ordered entry is told apart from an automatic one

- **WHEN** the owner reads the generation records after ordering a topic by hand
- **THEN** that entry reads `ordered` and no automatic entry does, so the two are counted separately

#### Scenario: A keyword claim names a prompt

- **WHEN** a committed claim of origin `keyword` carries a buyer prompt, a category, or no phrase
- **THEN** the autowriter gate fails and names the claim

## ADDED Requirements

### Requirement: A measured keyword candidate takes the slot ahead of the category rotation

When no Search Console signal yields a lead, the picker SHALL walk the candidates of
`audits/keyword-demand.md`, most exact Bing impressions first, in the order of
`site/scripts/topic-keywords.mjs`, and take the first whose concept no register row owns, calling no
model. A candidate whose concept a register row owns SHALL become a strengthening advisory naming
that route, not a page. Any other refusal SHALL skip it. A missing or empty report SHALL yield no
candidates and no error.

#### Scenario: A candidate names no register concept

- **WHEN** the report lists a phrase of 803 exact impressions whose concept no register row owns, and no
  Search Console signal yields a lead
- **THEN** the run chooses it, its claim reads origin `keyword` with a demand of 803 impressions and a
  null position, and no model is called to propose it

#### Scenario: A candidate names a concept the register owns

- **WHEN** the candidate with the most exact impressions is `ai governance framework` and the register
  assigns AI governance to `/glossary/ai-governance`
- **THEN** no page is written for it, a strengthening advisory names `/glossary/ai-governance` with the
  phrase and its exact impressions, and the walk goes on to the next candidate

#### Scenario: A candidate is refused for another reason

- **WHEN** a route in the family, a claim or a repeat check already holds a candidate
- **THEN** the picker records why in its trail, takes the next candidate, and the run does not end on
  the refusal

#### Scenario: Every candidate is refused or advised

- **WHEN** every candidate is either an advisory or skipped, as all 7 candidates of the first live
  report are
- **THEN** the picker descends to the category rotation, and the run ends without an entry only when
  that rung yields nothing too

#### Scenario: The keyword report is absent or empty

- **WHEN** `audits/keyword-demand.md` does not exist, cannot be read, or lists no candidates
- **THEN** the picker behaves exactly as it did before the keyword rung existed and reports no error
