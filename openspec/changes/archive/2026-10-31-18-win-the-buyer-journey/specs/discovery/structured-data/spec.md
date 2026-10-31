# discovery/structured-data Specification

## ADDED Requirements

### Requirement: One date per page, stated the same way everywhere

A route's modification date SHALL be the same value in its JSON-LD `dateModified`, its sitemap
`lastmod` and its `.md` sidecar. The date SHALL come from an editorial fact about the content, never
from the depth of the clone the build ran in. `npm run gate:machine` SHALL fail naming every route
whose three dates disagree (`site/scripts/date-agreement.mjs`).

#### Scenario: A static page is edited

- **WHEN** `/security` is edited and published
- **THEN** its JSON-LD, sitemap entry and sidecar all state that edit's date

#### Scenario: A shallow clone collapses the history

- **WHEN** the build runs in a clone with one commit of history
- **THEN** the dates do not all become the deploy time: the gate fails rather than publishing a
  freshness signal the content did not earn
