# discovery/search-demand Specification

## Purpose

Governs the Search Console report the repository keeps of the searches that reach the site, and the
offline gate that refuses it when it is stale or incomplete. One local command, `npm run audit:demand`,
fetches the numbers with a read-only key that stays out of git and out of CI, and
`npm run gate:demand` runs in CI with no secret. The report is the input the growth loop chooses its
next article from, so a buyer prompt with no impression reads `unproven` and is never presented as
won.

## Requirements

### Requirement: Measured demand is a committed artefact

`npm run audit:demand` SHALL query Search Console for a 90-day window and write
`audits/search-demand.md`, naming the window, the day it was taken and the property. The raw API
response SHALL NOT be committed, because the command reproduces it.

#### Scenario: The report is read by a human choosing the next article

- **WHEN** the report is written
- **THEN** it carries the totals, every query that produced an impression with its impressions,
  clicks, position and CTR, the pages that carried them, and a table joining each of the 30 buyer
  prompts in `docs/SEMANTIC-CORE.md` to what was measured for it

#### Scenario: The key is missing

- **WHEN** `GSC_SERVICE_ACCOUNT_JSON` is absent or unparseable
- **THEN** the command fails naming the variable and the file it belongs in, and writes no report,
  because an empty report reads exactly like a site nobody searched for

#### Scenario: The property returns no rows

- **WHEN** the window contains no impressions at all
- **THEN** the report states that in words and the totals read zero, rather than omitting the
  section

### Requirement: A report that is stale or incomplete fails the gate

`npm run gate:demand` SHALL run offline against the committed report and SHALL fail when the report
is older than 35 days, when a buyer prompt from the core has no row in it, or when a document
claims a prompt is won while the report records no impressions for that prompt.

#### Scenario: The report ages out

- **WHEN** the report was taken more than 35 days ago
- **THEN** the gate fails naming the date and the command that refreshes it

#### Scenario: A prompt is added to the core

- **WHEN** a 31st buyer prompt is added and the report predates it
- **THEN** the gate fails naming the prompt with no row

#### Scenario: A claim outruns the data

- **WHEN** a document states a prompt is won and the report shows zero impressions for it
- **THEN** the gate fails naming both the document and the measured number
