# delivery/link-integrity Specification

## ADDED Requirements

### Requirement: A route earns an inbound link from a page, not from the chrome

Every indexable route SHALL be linked from at least one other route's `<main>` by a link that is not
a header, footer, breadcrumb or hub listing. The gate SHALL fail naming every route reachable only
through site chrome, because a page a crawler reaches only through a list ranks on nothing.

#### Scenario: A page sits in its hub list and nowhere else

- **WHEN** a FAQ or resource is linked only from its own hub index
- **THEN** `npm run gate:orphans` fails naming it, even though the existing orphan check passes

#### Scenario: A contextual link is added

- **WHEN** another page links that route from its prose
- **THEN** the gate passes, and the link is the one a reader would follow
