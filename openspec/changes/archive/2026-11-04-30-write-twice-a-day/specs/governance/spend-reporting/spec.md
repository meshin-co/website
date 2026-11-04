## ADDED Requirements

### Requirement: A topic proposal is part of the entry's cost

The model call that proposes the topic of a category entry SHALL be recorded in the entry's
generation record with the role `topic`, and every proposal call the run made for that entry,
including the proposals that were refused, SHALL be recorded the same way. The monthly ceiling and
the spend report SHALL count those calls with the draft and correction calls of the entry.

#### Scenario: A category entry costs a proposal and a draft

- **WHEN** a category entry is written after one refused proposal, one accepted proposal and one
  draft
- **THEN** the generation record lists three calls, its totals equal their sum, the ledger's
  generation figure equals the same sum, and the monthly ceiling counts it

#### Scenario: Every proposal is refused

- **WHEN** a run proposes for every configured category and every proposal is refused or fails
- **THEN** the run ends without an entry, the spend of the proposals is printed in the run's
  summary, and no ledger exists to carry it because no entry has a slug
