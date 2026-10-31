# content/content-gate Specification

## ADDED Requirements

### Requirement: Every indexable route offers the next step

A built route a visitor can land on from search SHALL carry a booking call to action inside its
`<main>`, not only in the header or footer. The gate SHALL fail naming every indexable route without
one. Utility routes that are `noindex` by design are exempt.

#### Scenario: A glossary term is the landing page

- **WHEN** an answer engine sends a visitor to a glossary term
- **THEN** the page body offers the fit call, because the header button is not a call to action a
  reader arrives at

#### Scenario: A template stops rendering the band

- **WHEN** a template's closing booking band is removed
- **THEN** `npm run gate:content` fails naming the routes that lost it

### Requirement: A claim about an artefact resolves

Copy SHALL NOT describe a deliverable the page does not hold, and SHALL NOT label an artefact with a
licence no file states. A resource entry SHALL carry a `license` only when a licence text exists for
it.

#### Scenario: A licence is asserted with nothing behind it

- **WHEN** a resource entry declares `license: MIT` while no licence text ships
- **THEN** the build fails, because an unbacked licence is the most expensive claim a practice
  selling trust can make
