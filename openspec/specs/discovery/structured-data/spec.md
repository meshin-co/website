# discovery/structured-data Specification

## Purpose

Governs the JSON-LD graphs the built pages ship for search engines and answer engines: which route families must carry a graph, which node types each family needs, how `@id` references resolve, and which properties every node a page owns must hold. `npm run gate:jsonld` reads every built page and prints each finding as a `JSONLD` line before it exits 1, and `site/src/utils/jsonld.test.mjs` pins the node builders.

## Requirements

### Requirement: Every built route outside the three utility pages belongs to a known JSON-LD route family

Every built route except `/404`, `/search` and `/styleguide` SHALL match a family in `ROUTE_TYPES` of `site/scripts/jsonld-gate.mjs`; a route that matches none fails closed instead of passing unchecked. `npm run gate:jsonld` enforces this, and the `jsonld-fail-closed` family of `npm run test:smoke` plants an unknown route and requires the failure.

#### Scenario: A new page has no route family

- **WHEN** the build gains a page at `/speaking`
- **THEN** `npm run gate:jsonld` prints `JSONLD /speaking matches no known jsonld route family` and exits 1

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

### Requirement: Each route family carries the node types it requires

Each page SHALL carry the node types its family requires: `/` an Organization, Person and WebSite; every other route a BreadcrumbList; hubs and blog archives a CollectionPage; posts and case studies a BlogPosting; services a Service and FAQPage; FAQ entries an FAQPage; glossary terms a DefinedTerm and DefinedTermSet; resources a CreativeWork or SoftwareSourceCode; `/about` a ProfilePage and Person; `/contact` a ContactPage; `/pricing` a Service. `npm run gate:jsonld` enforces this.

#### Scenario: A page loses its breadcrumb graph

- **WHEN** `/about` ships without its BreadcrumbList block
- **THEN** `npm run gate:jsonld` prints `JSONLD /about has no BreadcrumbList node` and exits 1

#### Scenario: The home page loses its WebSite node

- **WHEN** the WebSite node is removed from the home page graph
- **THEN** `npm run gate:jsonld` prints `JSONLD / has no WebSite node` and exits 1

### Requirement: Every @id reference resolves to a node on the same page

Every reference on a page, meaning an object whose only key is `@id`, SHALL name a node declared in that page's own graph. `npm run gate:jsonld` enforces this on every built page, the `jsonld-reference-resolves-nowhere` family of `npm run test:smoke` plants a reference to nothing, and `site/src/utils/jsonld.test.mjs` and `site/src/utils/jsonld-graph.test.mjs` hold the composed graphs of the builders and of every page family to the same rule under `npm run test`.

#### Scenario: A node points at an undeclared id

- **WHEN** the Person node on `/about` points `worksFor` at `https://example.com/#company`
- **THEN** `npm run gate:jsonld` prints `JSONLD /about references undeclared https://example.com/#company` and exits 1

#### Scenario: A page points at breadcrumbs it does not carry

- **WHEN** the ProfilePage node on `/about` points `breadcrumb` at `https://example.com/about#breadcrumbs`
- **THEN** `npm run gate:jsonld` prints `JSONLD /about references undeclared https://example.com/about#breadcrumbs` and exits 1

#### Scenario: A composed graph leaves a reference dangling

- **WHEN** the builders compose a page graph whose Service node references an id the graph does not declare
- **THEN** `npm run test` fails the test `a whole page graph has no reference pointing outside itself`

### Requirement: No @id is declared twice on a page

No `@id` SHALL be declared by two nodes on the same page, counted across all of that page's ld+json blocks. `npm run gate:jsonld` enforces this, the `jsonld-id-declared-twice` family of `npm run test:smoke` plants a second Person node and requires the failure, and `site/src/utils/jsonld.test.mjs` checks under `npm run test` that the Organization, Person and WebSite builders carry distinct ids.

#### Scenario: A page declares the same node twice

- **WHEN** a second Person node with `https://example.com/#person` is added to `/about`
- **THEN** `npm run gate:jsonld` prints `JSONLD /about declares https://example.com/#person twice` and exits 1

### Requirement: Every node type has a required-property family

Every node in a checked page's graphs SHALL have a type listed in `REQUIRED_PROPERTIES` of `site/scripts/jsonld-gate.mjs`, so a type nobody listed fails closed instead of escaping the property check. `npm run gate:jsonld` enforces this.

#### Scenario: An unlisted node type appears

- **WHEN** `/about` gains a node of type `Event`
- **THEN** `npm run gate:jsonld` prints `JSONLD /about Event matches no known jsonld property family` and exits 1

### Requirement: Every node a page owns carries all required properties of its type

Every node a page owns, meaning its `@id` names that page's own URL or it has no URL `@id`, SHALL carry each property `REQUIRED_PROPERTIES` lists for its type, such as `logo` and `founder` on the Organization, `potentialAction` on the WebSite and `citation` on every Service and BlogPosting. `npm run gate:jsonld` enforces this, and the `jsonld-property-completeness` family of `npm run test:smoke` plants an Organization with no logo and requires the failure.

#### Scenario: The organization loses its logo

- **WHEN** the home page Organization node loses `logo`
- **THEN** `npm run gate:jsonld` prints `JSONLD / Organization node https://example.com/#org is missing required property logo` and exits 1

#### Scenario: The website loses its search action

- **WHEN** the home page WebSite node loses `potentialAction`
- **THEN** `npm run gate:jsonld` prints `JSONLD / WebSite node https://example.com/#website is missing required property potentialAction` and exits 1

### Requirement: The graph builder emits one schema.org document with the nodes under @graph

`graph` in `site/src/utils/jsonld.mjs` SHALL return one document whose `@context` is `https://schema.org` and whose nodes sit under `@graph`, and the Organization, Person and WebSite builders SHALL carry the ids `/#org`, `/#person` and `/#website` on the site origin. Guarded by `site/src/utils/jsonld.test.mjs` under `npm run test`.

#### Scenario: The builder drops the schema.org context

- **WHEN** `graph` stops setting `@context`
- **THEN** `npm run test` fails the test `every node in a graph carries a unique @id and the graph is a single JSON-LD document`

### Requirement: Structured-data dates are full ISO instants and never invented

The post, resource and webpage builders in `site/src/utils/jsonld.mjs` SHALL write their dates as full ISO 8601 instants such as `2026-09-01T00:00:00.000Z`, and the resource and webpage builders SHALL write no date the entry does not carry. Guarded by `site/src/utils/jsonld.test.mjs` under `npm run test`.

#### Scenario: A post date loses its time

- **WHEN** `postNode` writes `datePublished` as `2026-09-01`
- **THEN** `npm run test` fails the test `a post node dates both publication and modification as full ISO instants and cites its sources`

#### Scenario: An undated resource gains a date

- **WHEN** `resourceNode` fills in a `datePublished` for an entry that has none
- **THEN** `npm run test` fails the test `a resource node publishes and modifies only on dates it was given, as full ISO instants`

### Requirement: A Service node links its offer without a price specification

`serviceNode` in `site/src/utils/jsonld.mjs` SHALL give each service an `offers` object that points at the service page by `url` and carries no `priceSpecification`, with the Organization as `provider`. Guarded by `site/src/utils/jsonld.test.mjs` under `npm run test`.

#### Scenario: A price appears in the offer

- **WHEN** `serviceNode` adds a `priceSpecification` to its offer
- **THEN** `npm run test` fails the test `a service node links the offer without publishing a price`

### Requirement: The WebSite node exposes site search as a SearchAction

`websiteNode` in `site/src/utils/jsonld.mjs` SHALL carry a `potentialAction` of type `SearchAction` whose `query-input` names `search_term_string`. Guarded by `site/src/utils/jsonld.test.mjs` under `npm run test`; `npm run gate:jsonld` separately fails a home page whose WebSite node has no `potentialAction`.

#### Scenario: The search action loses its type

- **WHEN** `websiteNode` writes a `potentialAction` that is not a `SearchAction`
- **THEN** `npm run test` fails the test `the website node exposes site search as a potential action`

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

### Requirement: Only the three utility routes may ship no graph

`GRAPH_EXEMPT` in `site/scripts/jsonld-gate.mjs` SHALL name every route allowed to ship no graph, with the reason each ships none: `/404` the error page, `/search` results the browser fills in, `/styleguide` an internal component reference. A route off the list that ships none fails. A listed route that does ship a graph is held to the id rules of any page. `npm run gate:jsonld` enforces this.

#### Scenario: A listed route ships a graph that declares an id twice

- **WHEN** `/styleguide` gains a graph holding two nodes with one `@id`
- **THEN** `npm run gate:jsonld` prints `JSONLD /styleguide declares https://example.com/#org twice` and exits 1

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
