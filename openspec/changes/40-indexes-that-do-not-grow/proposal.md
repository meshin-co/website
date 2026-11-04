# Bound every generated index, so no machine file grows with the corpus

## Why

The owner saw that `/llms/post.txt` grows with every article. Measured on the build of 2026-11-04,
with ten live posts:

| file                | bytes   | per post added |
| ------------------- | ------- | -------------- |
| `llms.txt`          | 5,773   | 0              |
| `llms-full.txt`     | 247,488 | 14,778         |
| `llms/post.txt`     | 147,811 | 14,778         |
| `llms/glossary.txt` | 41,901  | 0              |
| `llms/resource.txt` | 36,892  | 0              |
| `llms/faq.txt`      | 16,328  | 0              |
| `llms/service.txt`  | 4,604   | 0              |
| `blog/rss.xml`      | 150,887 | 15,089         |

A post is 7,128 to 28,454 bytes in the llms files, 14,778 on average. Change 30 writes two entries a
day, so at that rate `llms/post.txt` passes a megabyte after 29 days. `llms-full.txt` reaches its
2,000,000 byte guard after 60 days and then changes shape without a finding, from the whole corpus to
a list of pointers. `blog/rss.xml` lists every live post and passes ten megabytes within a year.

Change 14 bounded `llms.txt` and set a cap of 100 entries per collection file. The cap bounds the
count and not the bytes: 100 posts are 1,477,800 bytes, about 370,000 tokens, in one file. The
published figure for a large documentation page in the fetch-tool documentation of Anthropic is 100 kB,
about 25,000 tokens, and 10 kB for an average one. A shard a retriever cannot read whole is not a shard.

Two readers were left on the flat file. `gate:machine` reads only `/llms/<collection>.txt` for entry
coverage, so the first sharded collection would report every entry as missing. `gate:parity` owes every
entry a place in `llms-full.txt`, which a bounded `llms-full.txt` cannot give.

## What changes

**The cap comes from the bytes.** One file budget, `LLMS_FILE_MAX_BYTES = 100000`, the figure above. A
collection's entry cap is the whole entries that fit it beside a 1024 byte frame at the largest entry
measured in that collection: `floor((100000 - 1024) / largest)`.

| collection | live | largest (B) | mean (B) | entry cap | largest shard (B) |
| ---------- | ---- | ----------- | -------- | --------- | ----------------- |
| service    | 3    | 2,055       | 1,526    | 48        | 98,640            |
| post       | 10   | 28,454      | 14,778   | 3         | 85,362            |
| resource   | 7    | 13,269      | 5,266    | 7         | 92,883            |
| glossary   | 32   | 2,938       | 1,308    | 33        | 96,954            |
| faq        | 25   | 832         | 651      | 118       | 98,176            |
| case       | 0    | none        | none     | 3         | 85,362            |

A collection with no entry takes the largest entry any collection holds. Boundaries are counted in
entries and not in bytes on purpose: a shard packed by bytes moves its boundary when an old entry is
edited and rewrites every later shard, while a count keeps an edit inside one shard. A new entry lands
in the last shard, because order stays publish date ascending with the id as the tie-break. With these
caps the real corpus becomes a `post` index and four shards of 3, 3, 3 and 1 posts, and the other
collections stay one file each. At two posts a day the `post` index passes its own 100000 bytes after
about six years, and the guard names it then.

**`llms-full.txt` becomes the index locked row L25 says it is.** One line per collection with its entry
count and a link to the collection file, no entry, a 4096 byte guard. It was the concatenation of the
collection files, so nothing is lost but the single request that returns every body. A request that
returns every body cannot be bounded, and the bodies stay reachable: `llms.txt`, then the collection
file, then at most one shard.

**The readers follow the shards.** `gate:machine` reads a collection's index and every shard it names
for entry coverage, checks each shard against its own cap and each file against the byte budget,
refuses an index that carries an entry, and checks `llms-full.txt` the way it checks `llms.txt`: the
size, the count and no entry inline. `gate:parity` stops owing an entry a place in `llms-full.txt`,
and the agent catalogue describes the file as an index. `generate-geo-baseline.mjs` already reads every
file under `dist/llms/`, and `smoke:prod` asks `/llms.txt` for a 200 and nothing about its content, so
neither changes.

**The collection feeds get the same bound.** A collection feed carries the newest 15 entries, a week at
two a day, ordered by last modification and then by URL, so the window is a total order. The merged
feed keeps its window of 50 and its floor of 5. Each feed file has a byte budget of its window times the
largest measured item, 28,821 bytes. `gate:parity` owes an item in the collection feed only to the
entries inside the window.

**Idempotence is proven by breaking it.** The tests that generate twice, in reversed input order and a
day apart under `mock.timers`, run against a generator with the id tie-break dropped and against one
that appends a timestamp, and both must go red.

## Not in scope

- The sitemap. `@astrojs/sitemap` splits at 45,000 URLs behind `sitemap-index.xml`, which at two
  entries a day is about 60 years away. `gate:machine` reads `sitemap-0.xml` only and would need to
  follow the index on the day the split comes.
- The search shards. `gate:search` caps each search shard at 64 KiB gzipped, and `search-index-post.json`
  measured 42,654 bytes gzipped for ten posts, 4,265 a post, so the cap is crossed at about the
  sixteenth post, three days of the writer from now. That is a decision about the browser client and
  its own change; it is recorded in section 8 of the tasks.
- The writer's schedule and the press.

## Measured after

Bytes of the files this change touches, from `dist/` of the build of 2026-11-04 with ten live posts:

| file                | before  | after                          | after a year at two posts a day |
| ------------------- | ------- | ------------------------------ | ------------------------------- |
| `llms.txt`          | 5,773   | 5,847                          | 5,847                           |
| `llms-full.txt`     | 247,488 | 681                            | 682                             |
| `llms/post.txt`     | 147,811 | 273 (index)                    | 16,641 (index)                  |
| `llms/post-1..n`    | none    | 26,244, 51,491, 59,598, 10,882 | 247 shards, largest 75,964      |
| `llms/glossary.txt` | 41,901  | 41,901                         | one file to 33 terms            |
| `llms/resource.txt` | 36,892  | 36,892                         | one file to 7 resources         |
| `llms/faq.txt`      | 16,328  | 16,328                         | one file to 118 answers         |
| `llms/service.txt`  | 4,604   | 4,604                          | one file to 48 offers           |
| `blog/rss.xml`      | 150,887 | 150,887                        | at most 432,315                 |
| `glossary/rss.xml`  | 48,150  | 22,621                         | at most 432,315                 |
| `faq/rss.xml`       | 20,871  | 12,664                         | at most 432,315                 |
| `rss.xml`           | 198,082 | 198,082                        | at most 1,441,050               |

Before, a year of two posts a day made `llms/post.txt` about 10.9 MB, `llms-full.txt` 11.0 MB, which
it never reached because it fell back to pointers at 2,000,000 bytes on day 59, and `blog/rss.xml` 11.1
MB. The year row is the real generators run over 730 posts that repeat the ten measured sizes; the
feed rows are the window times the largest measured item. `npm run measure:llms` reproduces the table
of largest and mean entries from a build.

## Calibration

The cap is a measurement of ten posts. The Calibration Gate in the tasks asks for it to be measured
again with `npm run measure:llms` once the writer has produced a month of entries.
