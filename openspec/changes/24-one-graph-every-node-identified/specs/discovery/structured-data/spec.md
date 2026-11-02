# discovery/structured-data Specification

## RENAMED Requirements

- FROM: `### Requirement: Every page of a known family ships at least one parseable ld+json block`
- TO: `### Requirement: Every page of a known family ships exactly one parseable ld+json graph`

## MODIFIED Requirements

### Requirement: Every page of a known family ships exactly one parseable ld+json graph

Every route of a known family SHALL ship exactly one `application/ld+json` script, and its document SHALL parse as JSON and hold the page's nodes under one `@graph`. A second script, a block that fails to parse and a document with no `@graph` are failures, never skipped. `npm run gate:jsonld` enforces this, and the `jsonld-breadcrumbs-in-a-second-script` family of `npm run test:smoke` plants a second script and requires the failure.

#### Scenario: A component writes a script of its own

- **WHEN** the breadcrumbs of `/about` move into a second ld+json script
- **THEN** `npm run gate:jsonld` prints `JSONLD /about carries 2 ld+json scripts, expected one` and exits 1

#### Scenario: A page ships no graph

- **WHEN** `/now` ships without an ld+json script
- **THEN** `npm run gate:jsonld` prints `JSONLD /now carries no ld+json graph` and exits 1

#### Scenario: A block is not valid JSON

- **WHEN** an ld+json block on `/now` opens with `{,`
- **THEN** `npm run gate:jsonld` exits 1 with `Error: jsonld: could not parse an ld+json block`

### Requirement: Every @id reference resolves to a node on the same page

Every reference on a page, meaning an object whose only key is `@id`, SHALL name a node declared in that page's own graph. `npm run gate:jsonld` enforces this on every built page, the `jsonld-reference-resolves-nowhere` family of `npm run test:smoke` plants a reference to nothing, and `site/src/utils/jsonld.test.mjs` and `site/src/utils/jsonld-graph.test.mjs` hold the composed graphs of the builders and of every page family to the same rule under `npm run test`.

#### Scenario: A node points at an undeclared id

- **WHEN** the Person node on `/about` points `worksFor` at `https://meshin.co/#company`
- **THEN** `npm run gate:jsonld` prints `JSONLD /about references undeclared https://meshin.co/#company` and exits 1

#### Scenario: A page points at breadcrumbs it does not carry

- **WHEN** the ProfilePage node on `/about` points `breadcrumb` at `https://meshin.co/about#breadcrumbs`
- **THEN** `npm run gate:jsonld` prints `JSONLD /about references undeclared https://meshin.co/about#breadcrumbs` and exits 1

#### Scenario: A composed graph leaves a reference dangling

- **WHEN** the builders compose a page graph whose Service node references an id the graph does not declare
- **THEN** `npm run test` fails the test `a whole page graph has no reference pointing outside itself`

### Requirement: No @id is declared twice on a page

No `@id` SHALL be declared by two nodes on the same page, counted across all of that page's ld+json blocks. `npm run gate:jsonld` enforces this, the `jsonld-id-declared-twice` family of `npm run test:smoke` plants a second Person node and requires the failure, and `site/src/utils/jsonld.test.mjs` checks under `npm run test` that the Organization, Person and WebSite builders carry distinct ids.

#### Scenario: A page declares the same node twice

- **WHEN** a second Person node with `https://meshin.co/#person` is added to `/about`
- **THEN** `npm run gate:jsonld` prints `JSONLD /about declares https://meshin.co/#person twice` and exits 1

## ADDED Requirements

### Requirement: Only the three utility routes may ship no graph

`GRAPH_EXEMPT` in `site/scripts/jsonld-gate.mjs` SHALL name every route allowed to ship no graph, with the reason each ships none: `/404` the error page, `/search` results the browser fills in, `/styleguide` an internal component reference. A route off the list that ships none fails. A listed route that does ship a graph is held to the id rules of any page. `npm run gate:jsonld` enforces this.

#### Scenario: A listed route ships a graph that declares an id twice

- **WHEN** `/styleguide` gains a graph holding two nodes with one `@id`
- **THEN** `npm run gate:jsonld` prints `JSONLD /styleguide declares https://meshin.co/#org twice` and exits 1

#### Scenario: The listed routes ship no graph

- **WHEN** `/404`, `/search` and `/styleguide` carry no ld+json script
- **THEN** `npm run gate:jsonld` reports `3 exempt (/404, /search, /styleguide)` in its summary line and exits 0

### Requirement: Every node in a page's graph carries an @id

Every node under a page's `@graph` SHALL carry a non-empty string `@id`. The FAQPage a post or service embeds takes `${site}${path}#faqpage` and the BreadcrumbList takes `${site}${path}#breadcrumb` for the page its trail ends at, the shape the other nodes use, so an id is a function of the origin and the route alone. `npm run gate:jsonld` enforces the first sentence, and the `jsonld-node-without-an-id` family of `npm run test:smoke` plants a BreadcrumbList with no id and requires the failure.

#### Scenario: A node has no id

- **WHEN** the BreadcrumbList node on `/about` loses its `@id`
- **THEN** `npm run gate:jsonld` prints `JSONLD /about has a BreadcrumbList node with no @id` and exits 1

#### Scenario: A builder drops an id

- **WHEN** `breadcrumbNode` stops setting `@id`
- **THEN** `npm run test` fails the test `a breadcrumb list takes its id from the page its trail ends at, whatever the trail above it`

### Requirement: The page node reaches its breadcrumbs and its FAQ

Every page node except the home page's SHALL carry `breadcrumb`, a reference to the page's BreadcrumbList, and a WebPage that hosts an FAQ SHALL carry `hasPart` to that FAQPage, which points back with `isPartOf`, so a consumer walks from the page node to both. `site/src/utils/jsonld-graph.test.mjs` holds every page family to this under `npm run test`, and a link to nothing fails `npm run gate:jsonld`.

#### Scenario: A page node loses its breadcrumb link

- **WHEN** `webPageNode` stops writing `breadcrumb`
- **THEN** `npm run test` fails the test `from the page node a consumer reaches the breadcrumbs of every page below the home page, ending at that page`

#### Scenario: A hosting page loses its FAQ link

- **WHEN** `webPageNode` stops writing `hasPart` for a page told it hosts an FAQ
- **THEN** `npm run test` fails the test `from the page node a consumer reaches the faq of a post and of a service, and the faq points back`

### Requirement: A run that read no graph fails

`npm run gate:jsonld` SHALL print how many routes carry a graph and how many scripts and nodes it read, and SHALL fail a run in which no route carried a graph, so an empty or misread build cannot read as a pass. The `jsonld-gate-that-read-nothing` family of `npm run test:smoke` plants an empty build and requires the failure.

#### Scenario: The build holds no graph

- **WHEN** `dist` holds no page that carries an ld+json graph
- **THEN** `npm run gate:jsonld` prints `JSONLD no route carried a graph, so nothing was checked` and exits 1
