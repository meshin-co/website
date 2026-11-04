# discovery/machine-interfaces Specification

## REMOVED Requirements

### Requirement: Every live collection entry is in llms-full.txt and in its collection file

**Reason**: `/llms-full.txt` is an index of the collection files, as locked row L25 says, so "in llms-full.txt" is false by design for an entry. The guarantee is kept by the two requirements added below: every live entry ships once across its collection's files and is reachable from `/llms.txt` in two further fetches, and `/llms-full.txt` points at every collection that has one.

### Requirement: Each collection feed carries every live entry of its collection

**Reason**: A feed that lists every entry grows without bound: `/blog/rss.xml` measured 150887 bytes for ten posts on 2026-11-04 and would pass ten megabytes after a year of two posts a day. The guarantee is replaced by the window requirement added below, which says which entries a feed carries and that it carries no others.

### Requirement: llms-full.txt and the collection files carry each entry's full text

**Reason**: `/llms-full.txt` no longer carries any entry. The guarantee that the collection files hold the full text is kept by the requirement of the same intent added below, and `/llms-full.txt` is held to the index rules instead.

### Requirement: llms-full.txt stays within its two-megabyte guard

**Reason**: A guard of two megabytes is not a bound a retriever can use, and 2000000 bytes was never measured. The file is an index of one line per collection, and the four-kilobyte guard added below replaces it.

### Requirement: A collection file holds at most 100 entries and shards beyond that

**Reason**: A cap of 100 entries is 1477800 bytes for posts at their measured mean, so it bounded the count and not the file. The cap is now derived per collection from the bytes an entry takes, and the requirement added below carries the derivation.

## MODIFIED Requirements

### Requirement: The llms files describe the build they came from

The count on a collection's line in `/llms.txt` and in `/llms-full.txt` SHALL equal the entries its files hold, each shard SHALL hold the range the index gives it, an index SHALL hold no entry itself, no entry SHALL ship twice, and the last shard SHALL be the last. Every live entry is then reachable from `/llms.txt` in two further fetches. `npm run gate:machine` enforces this through `llmsCorpusGaps` in `site/scripts/llms-corpus.mjs`.

#### Scenario: A count drifts from the shipped entries

- **WHEN** the `/llms.txt` line for `/llms/post.txt` says 9 entries and the files hold 8
- **THEN** `npm run gate:machine` prints `MACHINE llms.txt says 9 entries for post, its files hold 8` and exits 1

#### Scenario: An index carries an entry itself

- **WHEN** `/llms/post.txt` indexes shards and also lists the URL of `/blog/a-post` as an entry
- **THEN** `npm run gate:machine` prints `MACHINE /llms/post.txt is an index of shards but lists https://meshin.co/blog/a-post itself` and exits 1

### Requirement: The llms files are byte-identical across builds and ordered by a total key

Entries SHALL be ordered by publish date ascending, then by id ascending, a total order, and no generator SHALL read a clock. A second `npm run build` of an unchanged tree SHALL write byte-identical `/llms.txt`, `/llms-full.txt` and `/llms/*.txt`. A newer entry lands last, so only the old last shard and the index move; a back-dated entry shifts every later shard. Guarded by `site/src/utils/llms-collections.test.mjs`; `npm run test:smoke` drops the tie-break and appends a timestamp, and each must turn it red.

#### Scenario: A second build

- **WHEN** the generator runs a second time over the same entries, a day later and in reversed input order
- **THEN** `npm run test` passes the tests `the generator reads no clock: a second run a day later is byte-identical` and `generating twice from one fixture is byte-identical for every file, in any input order`

#### Scenario: The id tie-break is dropped

- **WHEN** `orderEntries` sorts by publish date alone
- **THEN** `npm run test` fails the test `generating twice from one fixture is byte-identical for every file, in any input order`

#### Scenario: A timestamp is appended

- **WHEN** a generator appends the current time to a file
- **THEN** `npm run test` fails the test `the generator reads no clock: a second run a day later is byte-identical`

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

#### Scenario: An entry drops out of its llms shards

- **WHEN** a built entry is listed in no file of its collection under `/llms/`
- **THEN** `npm run gate:parity` prints `PARITY <route> is owed a place in its llms collection file: /llms/<kind>.txt and its shards do not list it` and exits 1

#### Scenario: An entry is outside its collection feed window

- **WHEN** an entry is older than the newest 15 of its collection and is absent from the collection feed
- **THEN** `npm run gate:parity` stays silent about it, because only the entries inside the window are owed a place in the collection feed

#### Scenario: An entry is in no line of llms-full.txt

- **WHEN** a built entry appears in no line of `/llms-full.txt`
- **THEN** `npm run gate:parity` stays silent about it, because `/llms-full.txt` lists collections and no entry

## ADDED Requirements

### Requirement: Every live entry ships once in its collection's files and is reachable in two further fetches

For each public collection with a live entry, every live entry SHALL appear exactly once across `/llms/<collection>.txt` and its numbered shards, on a line that opens with a link to it or holds only its URL, so `/llms.txt` reaches it in at most two further fetches. A live entry is a built `/<base>/<slug>` page with no `noindex` robots meta. `npm run gate:machine` enforces this.

#### Scenario: An entry is missing from its shards

- **WHEN** the URL line of `/blog/a-post` is removed from `/llms/post-2.txt`
- **THEN** `npm run gate:machine` prints `MACHINE /llms/post.txt omits /blog/a-post` and exits 1

#### Scenario: An entry ships twice

- **WHEN** `/llms/post-2.txt` repeats the URL line of an entry that `/llms/post-1.txt` holds
- **THEN** `npm run gate:machine` prints `MACHINE https://meshin.co/blog/a-post ships twice across the post shards` and exits 1

#### Scenario: A collection file was not built

- **WHEN** the build holds live FAQ entries and no `/llms/faq.txt`
- **THEN** `npm run gate:machine` prints `MACHINE no /llms/faq.txt full-text file` and exits 1

### Requirement: llms-full.txt points at the collection files and lists no entry

`/llms-full.txt` SHALL carry one line for each collection that has a live entry, holding its entry count and a link to `/llms/<collection>.txt`, and SHALL list no entry of any collection. A count that differs from the entries the collection's files hold, and an entry listed inline, each fail `npm run gate:machine`, which compares them with `llmsInlinedRoutes` in `site/scripts/machine.mjs`.

#### Scenario: An entry is listed in llms-full.txt

- **WHEN** `/llms-full.txt` gains a line linking `https://meshin.co/blog/a-post`
- **THEN** `npm run gate:machine` prints `MACHINE llms-full.txt lists /blog/a-post inline, entries of an unbounded collection belong in /llms/` and exits 1

#### Scenario: A count drifts from the shipped entries

- **WHEN** the `/llms-full.txt` line for `/llms/post.txt` says 9 entries and the files hold 10
- **THEN** `npm run gate:machine` prints `MACHINE llms-full.txt says 9 entries for post, its files hold 10` and exits 1

### Requirement: No file under /llms/ is over 100000 bytes

Every file under `/llms/` SHALL stay at or under `LLMS_FILE_MAX_BYTES`, 100000 bytes, in `site/src/utils/llms-collections.mjs`: what the fetch-tool documentation of Anthropic calls a large documentation page, about 25000 tokens. The entry caps keep the largest measured entry of each collection under it, and `npm run gate:machine` fails the file that is not.

#### Scenario: A shard outgrows its budget

- **WHEN** `/llms/post-1.txt` grows to 100001 bytes
- **THEN** `npm run gate:machine` prints `MACHINE llms/post-1.txt is 100001 bytes, over the 100000 byte guard` and exits 1

### Requirement: Each collection feed carries the newest entries of its collection and no more than its window

Every public collection SHALL have a feed base, and its feed `/<base>/rss.xml` SHALL carry a `<guid>` for each of the newest `FEED_WINDOW` live entries of that collection, 15, ordered by last modification and then by URL, and for no other. `npm run gate:machine` enforces both, and `site/scripts/machine.test.mjs` fails under `npm run test` when the merged feed endpoint or any collection feed endpoint is missing from the source.

#### Scenario: A collection feed drops an entry inside its window

- **WHEN** the item for `/glossary/dpia`, one of the newest 15 glossary entries, is removed from `/glossary/rss.xml`
- **THEN** `npm run gate:machine` prints `MACHINE /glossary/rss.xml omits /glossary/dpia` and exits 1

#### Scenario: A collection feed carries more than its window

- **WHEN** `/blog/rss.xml` holds 16 items
- **THEN** `npm run gate:machine` prints `MACHINE /blog/rss.xml carries 16 items, window is 15` and exits 1

#### Scenario: A new public collection has no feed base

- **WHEN** a collection `talks` is added to the content config and not to `FEED_BASES`
- **THEN** `npm run gate:machine` prints `MACHINE talks has no FEED_BASES entry; skipping its feed coverage check` and exits 1

### Requirement: Every feed file stays within the bytes its window allows

`/<base>/rss.xml` SHALL stay at or under `FEED_WINDOW` times the largest measured feed item, 28821 bytes, which is 432315, and `/rss.xml` and `/feed.json` at or under `MERGED_FEED_WINDOW`, 50, times it, 1441050; `/rss.xml` SHALL carry at most 50 items. The constants are in `site/src/utils/feeds.mjs` and `npm run gate:machine` fails a file over its budget.

#### Scenario: A collection feed outgrows its budget

- **WHEN** `/blog/rss.xml` grows to 500000 bytes
- **THEN** `npm run gate:machine` prints `MACHINE blog/rss.xml is 500000 bytes, over the 432315 byte guard` and exits 1

#### Scenario: The merged feed carries more than its window

- **WHEN** `/rss.xml` holds 51 items
- **THEN** `npm run gate:machine` prints `MACHINE merged rss.xml carries 51 items, window is 50` and exits 1

### Requirement: The collection files carry each entry's full text and llms-full.txt carries none

`renderLlmsCollection` and `renderLlmsShard` in `site/src/utils/machine-text.mjs` SHALL write each entry as its `# ` title, its ISO date when dated, its URL as a link, its summary and its whole body with markdown stripped, with `---` between entries. `renderLlmsFull` SHALL write no entry, because `/llms-full.txt` is an index of the collection files (locked row L25). Guarded by `site/src/utils/machine-text.test.mjs` under `npm run test`.

#### Scenario: A collection file carries links without bodies

- **WHEN** `renderLlmsCollection` stops writing entry bodies
- **THEN** `npm run test` fails the test `renderLlmsCollection carries the actual full body text of every entry, not just links to it`

#### Scenario: llms-full.txt carries an entry again

- **WHEN** `renderLlmsFull` writes the body of an entry
- **THEN** `npm run test` fails the test `renderLlmsFull lists the collection files and carries no entry`

### Requirement: llms-full.txt stays within its four-kilobyte guard

`/llms-full.txt` SHALL stay at or under `LLMS_FULL_MAX_BYTES`, 4096 bytes, in `site/src/utils/llms-collections.mjs`. It holds one line per collection and measured 0 bytes on 2026-11-04, so 4 KiB leaves room for about twenty collections and a change that needs more is a deliberate decision. Enforced by `npm run gate:machine`.

#### Scenario: llms-full.txt outgrows its budget

- **WHEN** `/llms-full.txt` grows to 5000 bytes
- **THEN** `npm run gate:machine` prints `MACHINE llms-full.txt is 5000 bytes, over the 4096 byte guard` and exits 1

### Requirement: A collection file holds at most its entry cap and shards beyond that

`LLMS_SHARD_MAX_ENTRIES` in `site/src/utils/llms-collections.mjs` SHALL give each collection the entries that fit 100000 bytes beside a 1024 byte frame at its largest measured entry: service 48, post 3, resource 7, glossary 33, faq 118, case 3. At or under its cap `/llms/<collection>.txt` holds the entries; above it that file indexes `/llms/<collection>-<n>.txt` shards, each with its range and count, chained by next links. `npm run gate:machine` fails a shard over its cap.

#### Scenario: A collection has one entry over its cap

- **WHEN** `post` holds 4 live entries
- **THEN** `npm run test` passes the test `one entry over the cap makes an index and two shards named post-1 and post-2`, and a collection of exactly 3 stays one file

#### Scenario: A shard holds more than its cap

- **WHEN** `/llms/post-1.txt` holds 4 entries
- **THEN** `npm run gate:machine` prints `MACHINE /llms/post-1.txt holds 4 entries, over the 3 entry cap` and exits 1
