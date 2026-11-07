# delivery/link-integrity Specification

## Purpose

Governs the integrity of the built site's markup and links: valid HTML, links inside the build that resolve, outbound addresses that are well formed, no orphaned pages, the right rel tokens on outbound and internal links, and the scheduled repair of a dead outbound citation. The gates read the built HTML, so a rule holds for what ships whatever template or Markdown produced it, and unit tests pin the build step that writes the rel tokens. A dead outbound address never fails a gate and never stops a pipeline: a daily job repairs it, and a citation that rests on a search link is asked about again every day and comes back when it can.

## Requirements

### Requirement: Every built page is valid HTML under the recommended html-validate rules

Every .html file in the build, the 404 page and /styleguide included, SHALL pass html-validate with zero errors under the html-validate:recommended preset that `site/.htmlvalidate.json` extends. `npm run gate:html` validates every page in dist and exits 1 on any error.

#### Scenario: Two elements share an id

- **WHEN** a built page holds two elements with `id="a"`
- **THEN** `npm run gate:html` exits 1 and prints `Duplicate ID "a"` with the rule name `no-dup-id` and the count `✖ 1 problem (1 error, 0 warnings)`

### Requirement: Every link inside the build resolves and every outbound address is well formed

`npm run gate:links` SHALL start at the home page of the build, follow every same-site link recursively and fail on a link inside the build that does not answer, on an outbound address that holds whitespace, does not parse or names a host that is not a domain, and on a register whose digest does not match its rows. It SHALL NOT fetch an address outside the build: `site/scripts/outbound-links.mjs` reads them from the built HTML. Extensionless URLs map to the flat .html file.

#### Scenario: A link names a page that was never built

- **WHEN** a page links to /missing and the build holds no missing.html
- **THEN** `npm run gate:links` exits 1 and prints `LINKS dead dist/about.html -> dist/missing.html (404)` for the page that carries the link

#### Scenario: An internal link ends in a slash

- **WHEN** a page links to /about/ while the build holds about.html
- **THEN** `npm run gate:links` exits 1 and prints `LINKS dead dist/about.html -> dist/about/ (404)`, because the flat build holds no about/index.html

#### Scenario: An outbound address is malformed

- **WHEN** a page links to `https://zz specimen.example/malformed`
- **THEN** `npm run gate:links` exits 1 and prints `LINKS malformed https://zz specimen.example/malformed (contains whitespace) on 1 page, e.g. /about`

#### Scenario: An outbound address is gone

- **WHEN** a page links to `https://gone.example.invalid/never-fetched`, which answers nothing
- **THEN** `npm run gate:links` exits 0 and prints `outbound addresses read, not fetched (a gone one is the sweep's to repair, never this gate's to block)`, because a third party's page is not a defect in this change

### Requirement: A scheduled job repairs a dead outbound citation from the archive, else from a search

`.github/workflows/repair-links.yml` SHALL run `site/scripts/repair-links.mjs` daily. For each dead outbound address, meaning two 404 or 410 answers and no 2xx, or a host name that did not resolve for three scheduled days, the job SHALL replace the address in its source row with the Internet Archive capture nearest the day it was cited, else with a search for the source's title and publisher, and keep the cited address in `original`. `site/scripts/link-repair-sweep.test.mjs` pins the chain.

#### Scenario: A capture near the citation date carries the title

- **WHEN** the archive holds captures of a dead address and the job takes any but the one nearest the day the source was cited
- **THEN** `npm run test` fails the test `a dead address in a citation is replaced by the capture nearest the day it was cited, in the entry, and the register keeps the row`

#### Scenario: The archive holds nothing usable

- **WHEN** the archive holds no capture near the day the source was cited and the job does not rest the citation on the search for its title and publisher
- **THEN** `npm run test` fails the test `an archive with nothing near the citation date sends the citation to the search link built from its title and publisher, and the register says why`

#### Scenario: The archive does not answer

- **WHEN** the archive does not answer and the job sends the citation to the search link
- **THEN** `npm run test` fails the test `an archive that does not answer changes nothing, counts the citation as waiting and never falls to the search link`

### Requirement: The repair job never blocks and never guesses at another source

The job SHALL act only on a dead address, SHALL change an address and never a word, and SHALL exit non-zero only when the job itself could not do its work: a dead link, an `unverified` host, a name that does not resolve, a run in which no host answered and an address no entry cites never make it fail. `site/scripts/link-repair-sweep-selection.test.mjs` and `site/scripts/repair-links.test.mjs` pin it.

#### Scenario: A host cannot be verified

- **WHEN** a host answers 403, a 5xx or nothing and the job repairs or counts its address
- **THEN** `npm run test` fails the test `an address that could not be verified is not dead: nothing is repaired, nothing is counted, the archive is not asked`

#### Scenario: No entry cites the dead address

- **WHEN** a dead address is linked only from a template and the job writes any file but the register
- **THEN** `npm run test` fails the test `a dead address that no collection entry cites is unplaced, with the pages that carry it, and no file but the register is written`

#### Scenario: The job itself cannot do its work

- **WHEN** the build the job reads is empty and the command exits 0
- **THEN** `npm run test` fails the test `an empty build is a job failure on the command line: exit 1 and the reason on stderr, with nothing pushed`

### Requirement: The repair register is generated, sealed and checked by the gate

`audits/link-rot.json` SHALL hold one row per repaired or unplaced citation, sorted by original then entry, and a digest over the rows and the day the register changed. Only `site/scripts/repair-links.mjs` writes it, and `npm run gate:links` SHALL fail on a register whose digest does not match its rows or whose rows break `site/scripts/link-rot-register.mjs`, and print its counts when it is sound. The job SHALL refuse to write over a register that fails its own guard.

#### Scenario: A row is edited by hand

- **WHEN** a row of `audits/link-rot.json` is changed after the job sealed it
- **THEN** `npm run gate:links` exits 1 and prints `LINKS register the digest does not match its rows: the file was edited by hand, and only the link repair job writes it; restore it from git`

#### Scenario: The register is sound

- **WHEN** the register holds one search row and nobody has edited it
- **THEN** `npm run gate:links` exits 0 and prints `link rot: 0 citations repaired from the archive, 1 resting on a search link, 0 unplaced addresses (audits/link-rot.json, changed 2026-11-04)`

#### Scenario: The job meets a hand-edited register

- **WHEN** the register fails its own guard as the job starts and the job writes over it
- **THEN** `npm run test` fails the test `a register edited by hand makes the job refuse to write over it`

### Requirement: A host name that does not resolve is dead only after three scheduled days

A host name SHALL make every outbound address on it dead once every attempt on it failed `ENOTFOUND` for the host asked, on 3 consecutive scheduled runs on 3 different days. Any other verdict, a gap of more than 3 days or a name no page links any more starts the count again, and a second run on one day adds nothing. `site/scripts/link-rot-watch.mjs` holds the rule, and the count lives in a file the workflow caches, never in the repository.

#### Scenario: A name fails to resolve on three days

- **WHEN** a host name fails to resolve on three consecutive days and the job leaves a citation on it unrepaired on the third day
- **THEN** `npm run test` fails the test `a host on its third run is dead: every citation of every address on it goes through the chain, with the evidence in each why`

#### Scenario: A name fails to resolve on two days only

- **WHEN** a name fails to resolve on two consecutive days and the job repairs a citation on it
- **THEN** `npm run test` fails the test `three days in a row make a host dead on the third day and not before, and the runs are counted day by day`

#### Scenario: The count crosses a gap of four days

- **WHEN** the count carries across a gap of four days
- **THEN** `npm run test` fails the test `a gap of exactly the longest gap continues the count, and one day more starts it again`

#### Scenario: An address redirects to a lapsed name

- **WHEN** an address redirects to a name that does not resolve and the probe calls the address unresolved
- **THEN** `npm run test` fails the test `a name that fails to resolve is the verdict of the address asked only when it is the name of that address: a redirect that led to a lapsed name is unverified`

#### Scenario: The watch file is corrupt

- **WHEN** the watch file is corrupt and the job lets it make a name dead
- **THEN** `npm run test` fails the test `a watch file that is corrupt is said so and treated as empty, so it can never make a name dead, and the run writes a good one`

### Requirement: A name counts only on a run in which another host answered

A run SHALL move or reset the count of a host name only if an address on a different host got an HTTP response, of any status, in the same run. A run in which no host answered SHALL change no count, repair nothing and print one line saying so, so a runner whose own network or resolver is down never makes a name dead. `site/scripts/link-rot-watch.mjs` holds the rule and `site/scripts/repair-links-watch.test.mjs` pins the output.

#### Scenario: No host answered

- **WHEN** no host answers and the job moves a count or repairs a citation on what would have been the third day
- **THEN** `npm run test` fails the test `a run in which no host answered prints one plain line, moves no count, repairs nothing even on a third day, and writes the file as it was`

#### Scenario: Another host answers 404

- **WHEN** another host answers 404 and the job does not move the count
- **THEN** `npm run test` fails the test `the same run with one other host answering 404 moves the streaks: that answer is the witness that the network worked`

#### Scenario: A host witnesses for itself

- **WHEN** an address on the same host that failed to resolve is said to have answered and the count moves
- **THEN** `npm run test` fails the test `a host cannot witness for itself: an address of the same host that is said to have answered neither moves its streak nor resets it`

### Requirement: A citation on a search link is asked about again every day

Every run SHALL re-examine the rows that rest on a search link, found by parsing the entries and not the register, for at most 20 originals chosen by a rotation over the sorted originals. An original that answers again with the source title SHALL be restored and its register row removed; else a usable capture nearest the citation date SHALL move the row up to the archive; else, and on any outage, nothing SHALL change. `site/scripts/link-repair-reexamine.test.mjs` pins it.

#### Scenario: The original answers again

- **WHEN** the original of a search row answers again with its source title and the job leaves the row on its search link
- **THEN** `npm run test` fails the test `a row whose original answers again with its title goes back to the original, and the entry is the one it was before the machine touched it`

#### Scenario: Only the archive holds the page

- **WHEN** the original is still gone, the archive holds a usable capture and the job leaves the row on its search link
- **THEN** `npm run test` fails the test `an original that is still gone, with a usable capture in the archive now, moves up to the archive and keeps the day it was first seen dead`

#### Scenario: The archive does not answer

- **WHEN** the archive does not answer and the job changes the row
- **THEN** `npm run test` fails the test `an archive that does not answer changes nothing and counts the row as waiting, whatever the original did`

#### Scenario: The original cannot be asked

- **WHEN** an original answers 403 or times out and the job restores the row
- **THEN** `npm run test` fails the test `an original that could not be asked is never a restore, and with nothing in the archive the row waits for the next time it is asked`

#### Scenario: More than twenty originals

- **WHEN** a run examines more than twenty originals
- **THEN** `npm run test` fails the test `more than twenty originals are cut to twenty, starting at the day number times twenty, counted round the sorted list`

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

Every `<a>` whose href starts with http:// or https:// and names a host other than the site's own host or one of its subdomains SHALL carry the rel tokens nofollow, noopener and noreferrer, in any order; extra tokens such as me are allowed. `npm run gate:external` checks every built page with `site/scripts/run-external-links.mjs`, and `site/scripts/external-links.test.mjs` pins the required set to exactly those three tokens.

#### Scenario: An outbound link lacks two of the tokens

- **WHEN** the home page links to https://iso.org/x with `rel="noopener"`
- **THEN** `npm run gate:external` exits 1 and prints `EXTERNAL https://iso.org/x is missing nofollow, noreferrer on 1 route(s), e.g. /`

### Requirement: No internal link carries nofollow

An `<a>` whose href starts with / or names the site's own host or its www form over http or https SHALL NOT carry rel nofollow, so internal links keep their ranking signal. `npm run gate:external` reports every such link with the page it sits on.

#### Scenario: An internal link is marked nofollow

- **WHEN** the home page links to /about with `rel="nofollow"`
- **THEN** `npm run gate:external` exits 1 and prints `INTERNAL /about carries nofollow on /; internal links keep their signal`

### Requirement: The build adds the outbound rel tokens and strips target from Markdown links

The Markdown pass rehypeExternalLinks in `site/src/utils/pipeline.mjs` SHALL merge nofollow, noopener and noreferrer into the rel of every http or https link whose hostname is not the site's own host, keep any other token, and remove its target attribute; relative links and links to the site's own host stay untouched. externalRelAttrs SHALL return the same three tokens for such an href and no rel at all for an internal one. `site/src/utils/pipeline.test.mjs` pins both.

#### Scenario: The Markdown pass keeps a target

- **WHEN** rehypeExternalLinks stops deleting the target attribute of an outbound link
- **THEN** `npm run test` fails the test `external links get the full nofollow, noopener and noreferrer set merged in, and lose any target`

#### Scenario: An internal href is given a rel

- **WHEN** externalRelAttrs returns a rel for https://example.com/services
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
