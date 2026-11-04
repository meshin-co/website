# delivery/link-integrity Specification

## MODIFIED Requirements

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

## ADDED Requirements

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
