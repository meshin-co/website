# discovery/machine-interfaces Specification

## ADDED Requirements

### Requirement: Every route is owed the surfaces its kind implies, and the gate names each one it lacks

A built route SHALL be classified as exactly one of an entry, a collection hub, a public static page,
a tag index, a taxonomy archive, a pagination page, a declared exception or a withheld route, and
SHALL carry every machine surface that kind is owed. `npm run gate:parity` SHALL fail, naming the
route and the surface, for each owed surface a route lacks, and SHALL print how many routes it derived
and how many owed cells it checked and found present.

#### Scenario: An entry drops out of its search shard

- **WHEN** a built entry has no entry in the search shard of its collection
- **THEN** `npm run gate:parity` prints `PARITY <route> is owed a search entry: /search-index-<kind>.json holds no entry for it` and exits 1

#### Scenario: An entry loses its social card

- **WHEN** the card file an entry's `og:image` points at is not in the build, or is not a 1200 by 630 PNG
- **THEN** `npm run gate:parity` names the entry and `a social card` and exits 1

#### Scenario: An entry is not the newest of its collection

- **WHEN** an entry is not the newest of its collection and is absent from the merged feed
- **THEN** `npm run gate:parity` stays silent about it, because only the newest entry of a collection is owed a place in the merged feed

#### Scenario: A hand-written and a generated entry of one collection

- **WHEN** two entries of the same collection are built, one hand-written and one generated
- **THEN** each is owed the same surfaces and a surface missing from either is named

### Requirement: A route's kind is derived, never listed

The kind of a route SHALL be derived from its shape under a collection base taken from the content
configuration and from whether its built page is noindex. No list of routes SHALL decide what a
route is owed, so a new collection or a new entry is owed every surface on the day it exists.

#### Scenario: A collection is added

- **WHEN** a new collection with a base and a live entry is built
- **THEN** its hub and entry are owed their surfaces with no edit to any list in the gate

#### Scenario: A noindex page nobody declared

- **WHEN** a built page is noindex and is neither a declared exception, a withheld hub of an empty collection nor an entry whose source marks it noindex
- **THEN** `npm run gate:parity` prints that the route is noindex and nothing declares it, and exits 1

### Requirement: The routes that carry less are declared once, with a reason, and counted

`site/src/utils/route-exceptions.mjs` SHALL declare each route that is deliberately outside the
indexed machine surfaces, and each collection that deliberately holds no live entry, with a reason.
The gate SHALL print their count and names. A declared exception whose route no longer builds or whose
page is indexable, and a declared empty collection that holds an entry or does not exist, SHALL each
be a finding. A collection with no live entry that is not declared empty SHALL be a finding.

#### Scenario: A declared exception disappears

- **WHEN** `/styleguide` is declared an exception and no page builds at `/styleguide`
- **THEN** `npm run gate:parity` prints that the exception names no built page and exits 1

#### Scenario: The first case study is published

- **WHEN** the `case` collection is declared empty and a live `case` entry builds
- **THEN** the gate prints that the collection is declared empty but holds a live entry and exits 1

### Requirement: A check that examines nothing is a finding

`npm run gate:machine` SHALL NOT report a collection with no live entry as a skipped check. It SHALL
count the collections declared empty and name them on stdout, SHALL fail on a collection with no live
entry that is not declared empty, and SHALL fail when no sitemap lastmod was expected. `npm run gate:parity` SHALL fail when no route in the build is
owed a surface.

#### Scenario: A collection has no live entry and is declared empty

- **WHEN** `case` has no live entry and is declared empty with a reason
- **THEN** `npm run gate:machine` prints `1 of 6 collections have no live entry and are declared empty with a reason (case)` and exits 0

#### Scenario: A collection has no live entry and nobody declared it

- **WHEN** a collection other than `case` has no live entry
- **THEN** `npm run gate:machine` prints a finding naming the collection and the register to declare it in, and exits 1

#### Scenario: Nothing in the build is owed a surface

- **WHEN** the build holds no route that any kind owes a surface
- **THEN** `npm run gate:parity` prints that route parity examined nothing and exits 1
