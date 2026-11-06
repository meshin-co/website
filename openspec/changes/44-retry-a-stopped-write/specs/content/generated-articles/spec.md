## MODIFIED Requirements

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

- **WHEN** the draft returned after the last of the `loop.correctionRounds` correction rounds still breaks a length rule
- **THEN** the run stops with an output error naming the rule and the number of corrections it made, and no entry is written

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
