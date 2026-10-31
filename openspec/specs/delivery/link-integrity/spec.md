# delivery/link-integrity Specification

## Purpose

Governs the integrity of the built site's markup and links: valid HTML, links that resolve, no orphaned pages, and the right rel tokens on outbound and internal links. The gates read the built HTML, so a rule holds for what ships whatever template or Markdown produced it, and unit tests pin the build step that writes the rel tokens.

## Requirements

### Requirement: Every built page is valid HTML under the recommended html-validate rules

Every .html file in the build, the 404 page and /styleguide included, SHALL pass html-validate with zero errors under the html-validate:recommended preset that `site/.htmlvalidate.json` extends. `npm run gate:html` validates every page in dist and exits 1 on any error.

#### Scenario: Two elements share an id

- **WHEN** a built page holds two elements with `id="a"`
- **THEN** `npm run gate:html` exits 1 and prints `Duplicate ID "a"` with the rule name `no-dup-id` and the count `✖ 1 problem (1 error, 0 warnings)`

### Requirement: Every link reachable from the home page resolves

`npm run gate:links` SHALL start at the home page of the build, follow every same-site link recursively and fail on any link that still answers with an error status after its retries, or cannot be reached. Extensionless local URLs are rewritten to the flat .html file the build holds. Outbound links are fetched too, except those matching plausible.io, linkedin.com, cal.com, github.com/meshin-co, apps.apple.com or an absolute https://meshin.co URL, which are skipped.

#### Scenario: An outbound host answers 500 once

- **WHEN** an outbound link returns a 429 or a 5xx and succeeds within three retries, which carry jitter
- **THEN** `npm run gate:links` exits 0 and counts the link as scanned, because a third party having a bad minute is not a broken link

#### Scenario: A link names a page that was never built

- **WHEN** a page links to /missing and the build holds no missing.html
- **THEN** `npm run gate:links` exits 1 and prints `[404]` with the path of dist/missing.html, then `ERROR: Detected 1 broken links.`

#### Scenario: An internal link ends in a slash

- **WHEN** a page links to /about/ while the build holds about.html
- **THEN** `npm run gate:links` exits 1 and prints `[404]` with the path dist/about/, because the flat build holds no about/index.html

### Requirement: Every page except home and the style guide has a followed inbound link from another page

Every built page other than /, /styleguide and the 404 page SHALL be the target of at least one `<a>` on another built page whose rel does not include nofollow. Links on the 404 page, a page's links to itself, and fragment, mailto and tel links do not count; a trailing slash, query or fragment is dropped before matching. `npm run gate:orphans` runs `site/scripts/orphan-gate.mjs`, whose closed exempt list gives a reason for each route.

#### Scenario: A new page nothing links to

- **WHEN** the build gains /zz-specimen and no other page links to it
- **THEN** `npm run gate:orphans` exits 1 and lists `/zz-specimen` under its summary line ending `routes have zero inbound links`

#### Scenario: A page is linked only through nofollow or only from the 404 page

- **WHEN** a build of five routes plus the 404 page links /hidden only with rel nofollow and /from-404-only only from the 404 page
- **THEN** `npm run gate:orphans` exits 1 and prints `orphans: 2 of 5 routes have zero inbound links`, then `/from-404-only` and `/hidden`

#### Scenario: A third route is excused from the rule

- **WHEN** a route other than / and /styleguide is added to the exempt list in `site/scripts/orphan-gate.mjs`
- **THEN** `npm run test` fails the test `the closed exempt list only excuses home and the styleguide reference, each with a stated reason`

### Requirement: Every outbound link carries nofollow, noopener and noreferrer

Every `<a>` whose href starts with http:// or https:// and names a host other than meshin.co or one of its subdomains SHALL carry the rel tokens nofollow, noopener and noreferrer, in any order; extra tokens such as me are allowed. `npm run gate:external` checks every built page with `site/scripts/run-external-links.mjs`, and `site/scripts/external-links.test.mjs` pins the required set to exactly those three tokens.

#### Scenario: An outbound link lacks two of the tokens

- **WHEN** the home page links to https://iso.org/x with `rel="noopener"`
- **THEN** `npm run gate:external` exits 1 and prints `EXTERNAL https://iso.org/x is missing nofollow, noreferrer on 1 route(s), e.g. /`

### Requirement: No internal link carries nofollow

An `<a>` whose href starts with / or names meshin.co or www.meshin.co over http or https SHALL NOT carry rel nofollow, so internal links keep their ranking signal. `npm run gate:external` reports every such link with the page it sits on.

#### Scenario: An internal link is marked nofollow

- **WHEN** the home page links to /about with `rel="nofollow"`
- **THEN** `npm run gate:external` exits 1 and prints `INTERNAL /about carries nofollow on /; internal links keep their signal`

### Requirement: The build adds the outbound rel tokens and strips target from Markdown links

The Markdown pass rehypeExternalLinks in `site/src/utils/pipeline.mjs` SHALL merge nofollow, noopener and noreferrer into the rel of every http or https link whose hostname is not meshin.co, keep any other token, and remove its target attribute; relative and meshin.co links stay untouched. externalRelAttrs SHALL return the same three tokens for such an href and no rel at all for an internal one. `site/src/utils/pipeline.test.mjs` pins both.

#### Scenario: The Markdown pass keeps a target

- **WHEN** rehypeExternalLinks stops deleting the target attribute of an outbound link
- **THEN** `npm run test` fails the test `external links get the full nofollow, noopener and noreferrer set merged in, and lose any target`

#### Scenario: An internal href is given a rel

- **WHEN** externalRelAttrs returns a rel for https://meshin.co/services
- **THEN** `npm run test` fails the test `an outbound href gets the full rel, an internal one gets no rel at all`

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
