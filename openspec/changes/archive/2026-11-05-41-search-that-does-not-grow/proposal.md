# Search that does not grow with the corpus

## Why

The search index was seven per-kind shards, `/search-index-<kind>.json`, and every entry carried the
body of its page up to a per-kind cap. A post entry measured 16,650 bytes, of which about 16,400 were
body text. Measured on the build of 2026-11-04, with ten live posts and 110 documents in all:

| shard    | raw (B) | gzip (B) |
| -------- | ------- | -------- |
| post     | 133,595 | 42,654   |
| glossary | 76,330  | 25,040   |
| page     | 34,264  | 11,467   |
| faq      | 23,610  | 5,366    |
| resource | 22,512  | 8,187    |
| service  | 7,128   | 2,778    |
| case     | 2       | 22       |
| all seven |        | 95,514   |

The first query fetched all seven shards at once, so every first query downloaded 95,514 bytes
gzipped, and the post shard grew by about 4,265 bytes gzipped (42,654 for ten posts) with every
article. `npm run gate:search` capped one shard at 65,536 bytes gzipped and all shards together at
196,608. At two articles a day the post shard crosses its cap about 2026-11-07 and the sum cap about
twelve days after that. From the first of those days every build the unattended writer makes fails
`npm run gate:search`, and the writer's loop would stop.

At the same rate the old design reaches about 3.2 MB gzipped in one first query after 730 more
articles (4,265 x 730 = 3,113,450 added to 95,514). A throttled browser run of the old design over
real posts cycled to that size measured 3,127,178 bytes on the wire at +730 articles and 1,613,083 at
+365 (Chromium over CDP, 1.6 Mbps, 150 ms).

Change 40 found the same failure as its task 8.1 and left it in gap row G65, because the fix changes
the browser client and its JavaScript budget. This change is that fix, and it closes follow-up 8.1 of
G65. Locked row L68 holds the decision.

## What changes

**The index becomes a partitioned inverted index.** Three kinds of file replace the seven shards.

- `/search-index/manifest.json` holds the version, the document count, the page size, the last key of
  every term chunk and the runs of kinds. The version is the first ten hex characters of a hash of the
  content, and the name of the one folder that holds every chunk and page.
- Term chunks, `/search-index/<version>/t/<n>.json`, each at most 12,288 raw bytes. A chunk holds sorted
  keys with a list of document ids and weights. A key is a term or a branching prefix of at least two
  characters, so a query word that starts a word is one lookup. A title hit weighs 8, a description hit
  3 and a text hit 1, per occurrence.
- Document pages, `/search-index/<version>/d/<n>.json`, six documents each. A row is
  `[href, title, description]` and nothing else: no body text ships.

A first query downloads the manifest, one chunk for each distinct word of the query, at most 8, and
only the pages of the 20 best results. Opening `/search` downloads nothing. A second query reuses
what the first fetched.

**The build writes the index after the pages exist.** `astro build` now writes `search-entries.json`,
one file of every entry in the shape the seven shards held. `site/scripts/build-search-index.mjs` gives
each page entry its text from its built page, writes the files under `/search-index/` and removes
`search-entries.json`, so the intermediate file never ships. `npm run gate:search` refuses a build that
still holds `/search-entries.json` or any `/search-index-<kind>.json`.

**The budget bounds what a visitor downloads.** The per-shard and sum caps go. The first-query budget
is 65,536 bytes gzipped, 64 KiB, the cap that one shard already had: the manifest, plus the eight
largest chunks, plus the twenty largest pages, each gzipped at the default level. The index also has a
file budget of 4,000, a fifth of the 20,000 files Cloudflare Pages allows in one deployment. The
index as a whole may grow; what a first query can download may not.

**The client changes.** On `/search`, `page.js` 1,108 + `box.mjs` 821 + `index-model.mjs` 1,570 +
`shards.mjs` 995 = 4,494 bytes gzipped, against 3,839 before (1,108 + 934 + 794 + 1,003). The budget gate
counts only the script references of the page: 1,928, against 2,042 before, under a cap of 10,240 per
route.

### Mechanisms measured

Four mechanisms were measured on the real corpus, gzipped with `node:zlib` at the default level,
the function the guard uses. Today is 2026-11-04 and the rate is two articles a day.

| mechanism | whole index today (gz B) | first query today (gz B) | growth per article | at +730 articles | verdict |
| --------- | ------------------------ | ------------------------ | ------------------ | ---------------- | ------- |
| Old per-kind shards | 95,514, seven shards | 95,514, all seven on every first query | 4,265, linear | about 3.2 MB; 3,127,178 B measured on the wire | replaced |
| A. Partitioned inverted index (chosen) | 74,464 stored, 37 files | p50 14,877, p95 23,136, max 25,299 over 97 real queries; worst case 43,312 | stored +1,870 and manifest +5.0 as a straight line over the posts of the real corpus; `npm run measure:search` estimates manifest +4.3 raw bytes | modelled: 840 documents, 467 files, 915,553 stored, worst first query 42,520 | chosen |
| B. Per-entry token bag | 46,150 (distinct words, no stop words) to 60,824 (repeats and stop words kept) | all of it | 1,410 to 1,957, linear | 1,436,935 B measured on the wire | lost |
| C. Titles and descriptions only | 11,758 | all of it | about 116 per post | not run | lost |

B lost on growth. A sorted bag of the words of each entry is cheaper than the old text today, but
every first query still downloads the whole of it, and every article adds to it. It moves the crossing
from days to months and then fails the same way. On slow 4G the bag cost 62,903 bytes in 599 ms
today, and 1,436,935 bytes in 8,258 ms at +730 articles.

C lost on results. Without body text it is bounded in practice, but 93 of the 97 baseline queries lose
results, because body search is gone. Lowering the post text cap was not pursued: it keeps the shape
of per-entry text and trades results for a few months.

A is the only mechanism whose first query is bounded by its design: the manifest, at most eight chunks
and at most twenty pages, each chunk and page of a bounded size. The manifest is the one part that
grows with the number of articles, by 5.0 bytes gzipped per article as a straight line over the posts
of the real corpus (5.8 over the first five), and by 4.3 raw bytes, with no gzip saving assumed, as `npm run measure:search` estimates it. The
crossing dates below use both.

## Behaviour changes

Five things a visitor or an agent can see change, each stated here and pinned in the delta under
`specs/`.

1. **Stop words are neither indexed nor matched.** The old matcher required every word of the query,
   `how`, `to` and `an` included, to start a word of the entry. A query of nothing but stop words
   matches nothing and fetches nothing. Four of the 97 measured queries return a different list
   because of it, all four named below.
2. **The excerpt under a result is the page description.** The old excerpt was a 220-character window
   of the body around the first query word. The body no longer ships.
3. **A query holds at most 8 distinct words.** A ninth distinct word is ignored. The longest of the 97
   measured queries holds 8 (`P01`, "who is a fractional chief AI officer for a 100-person SaaS
   company"), 2 queries hold 8 and none holds more. A word is cut at 32 characters.
4. **A word found in more documents than the list cap keeps only its best 1,228 postings.** The cap is
   `floor(12,288 / 10)`, so one full list always fits one chunk. A word over the cap no longer
   excludes a document when another word can; its retained weights only add to the score. When every
   word of a query is over the cap, their lists are ranked together. Recall at 20 results against the
   uncapped index, modelled, is 1.000 at +730 articles, 0.997 at +1,460 and 0.856 at +3,650. The date
   it begins to fall is below, and it is inside five years.
5. **The seven shard routes are gone.** `/openapi.json` and the agent catalogue describe one search
   route, `/search-index/manifest.json`, and `/search-entries.json` and `/search-index-<kind>.json`
   are refused as legacy artifacts. This change adds no replacement path in the old shape.

### Query comparison

97 queries were run through the old index and the new one over the same built corpus: 30 buyer
prompts (P01 to P30), the same prompts reduced to keywords (P01k to P30k), 25 single words, 4
misspellings and 8 phrases from the spec. The comparison is of the top 20 lists, in order, and of the
total count.

93 of 97 are identical: the same results, in the same order, with the same total. No query lost a
result. 24 of the 97 return nothing today and still return nothing. The four that differ differ
because stop words are no longer matched. Both lists are copied from the comparison file.

**P06** "how to build an AI system register": total 11 to 18, lost none, gained 7, 8 moved.

| # | old (11) | new (18) |
| - | -------- | -------- |
| 1 | `/blog/handing-over-ai-leadership-to-an-internal-owner` | `/blog/how-to-build-an-ai-system-register-in-a-week` |
| 2 | `/blog/how-to-choose-an-ai-operating-model-for-a-mid-size-company` | `/blog/how-to-choose-an-ai-operating-model-for-a-mid-size-company` |
| 3 | `/blog/how-to-build-an-ai-system-register-in-a-week` | `/blog/handing-over-ai-leadership-to-an-internal-owner` |
| 4 | `/blog/ai-acceptable-use-policy-for-a-50-person-company` | `/blog/ai-acceptable-use-policy-for-a-50-person-company` |
| 5 | `/blog/ai-readiness-assessment-template-for-smb` | `/glossary/ai-register` |
| 6 | `/glossary/ai-register` | `/glossary/ai-governance` |
| 7 | `/glossary/mcp` | `/glossary/ai-management-system` |
| 8 | `/glossary/provider-vs-deployer` | `/glossary/provider-vs-deployer` |
| 9 | `/resources/adoption-telemetry-dashboard-template` | `/` |
| 10 | `/glossary/technical-documentation` | `/blog/ai-readiness-assessment-template-for-smb` |
| 11 | `/glossary/sub-processor` | `/glossary/technical-documentation` |
| 12 |  | `/resources/ai-readiness-scorecard` |
| 13 |  | `/blog/category/governance` |
| 14 |  | `/glossary/data-classification` |
| 15 |  | `/glossary/mcp` |
| 16 |  | `/glossary/sub-processor` |
| 17 |  | `/resources/adoption-telemetry-dashboard-template` |
| 18 |  | `/glossary/model-provenance` |

The 7 gained are `/glossary/ai-governance`, `/glossary/ai-management-system`, `/`,
`/resources/ai-readiness-scorecard`, `/blog/category/governance`, `/glossary/data-classification` and
`/glossary/model-provenance`. The old matcher required a word starting `how`, `to` and `an` in every
entry, so entries about the same subject without those words were out.

**P10** "LLM gateway for governance and audit": total 2 to 2, lost none, gained none, the same two
swapped. The old score added the hits of `for` and `and`; the new score does not.

| # | old | new |
| - | --- | --- |
| 1 | `/glossary/llm-gateway` | `/resources/llm-gateway-governance-config` |
| 2 | `/resources/llm-gateway-governance-config` | `/glossary/llm-gateway` |

**P11** "how to put evals for AI agents into CI": total 1 to 3, lost none, gained 2, 1 moved.

| # | old | new |
| - | --- | --- |
| 1 | `/blog/evals-in-ci-for-llm-agents` | `/blog/adoption-telemetry-measuring-if-ai-is-actually-used` |
| 2 |  | `/blog/evals-in-ci-for-llm-agents` |
| 3 |  | `/blog/multi-agent-reference-architecture-in-production` |

**P21** "adoption telemetry for AI tools": total 3 to 3, lost none, gained none, one moved. The home
page `/` dropped from second to last.

| # | old | new |
| - | --- | --- |
| 1 | `/blog/adoption-telemetry-measuring-if-ai-is-actually-used` | `/blog/adoption-telemetry-measuring-if-ai-is-actually-used` |
| 2 | `/` | `/resources/adoption-telemetry-dashboard-template` |
| 3 | `/resources/adoption-telemetry-dashboard-template` | `/` |

**Excerpts are a separate category.** Of the 465 result rows present in both lists, the excerpt text
differs in 450 and is identical in 15, the rows where the old excerpt had already fallen back to the
description. This is deliberate and visible: the body is not shipped, so the excerpt is the page
description. A result row still carries the title, the address, the kind and, now, the description
clipped at 500 characters.

### Crossing dates

At two articles a day from 2026-11-04. Each date is a derivation from a growth rate, not a forecast of
the corpus. The growth of the first-query budget and of the file budget has two estimates, and the
table gives both: the straight line through the real corpus rebuilt over its first k posts, and the
estimate `npm run measure:search` makes from the postings and keys the ten articles own.

| bound | cap | what grows | today | crossing, straight line over the real posts | crossing, `npm run measure:search` | horizon |
| ----- | --- | ---------- | ----- | ------------------------------------------- | ----------------------------------- | ------- |
| Old post shard | 65,536 gz | the post shard, +4,265 gz per article | 42,654 | about 2026-11-07, the sum cap 12 days later | not measured, the guard is gone | days |
| List cap | 1,228 postings | the list of the commonest prefix, `re`: one posting per article | 98 postings | 2028-05-22, 565 days | 2028-05-22, 565 days, 1,130 articles | inside 5 years, gap row G66 |
| First-query budget | 65,536 gz | the manifest, +5.0 gz per article on the line, +4.3 raw by the command | 43,312 | 2032-12-04, 2,222 days, 6.1 years | 2033-09-18, 2,510 days, 5,019 articles, 6.9 years | beyond 5 years, gap row G67 |
| File budget | 4,000 files | files, +0.6 per article on the line, +0.62 by the command | 37 | 2035-11-20, 3,303 days, 9.0 years | 2035-08-24, 3,215 days, 6,429 articles, 8.8 years | beyond 5 years, gap row G67 |

**The list-cap horizon is inside five years, and this change does not remove it.** All ten current
articles hold a word that starts `re`, and a new document is an article, so the share of new documents
that join the list is 1.00 and the list reaches 1,228 postings after 1,130 more articles. From then
the commonest prefixes are truncated and recall at 20 results falls, as in the table below. Row G66
records it as a known gap, with the figures. Lifting the cap is outside this change.

| articles added | about | recall at 20 against the uncapped index, modelled | queries identical, of 73 that match |
| -------------- | ----- | -------------------------------------------------- | ----------------------------------- |
| +730 | 2027-11 | 1.000 | 73 |
| +1,460 | 2028-11 | 0.997 | 71 |
| +3,650 | 2031-11 | 0.856 | 46, and the total count differs in 38 |

Beyond five years holds under both estimates, and under the steeper one it holds narrowly: at 5.0 gz
bytes of manifest per article the worst first query after 3,650 articles, 5.0 years, would be 61,562
(43,312 + 3,650 x 5.0, arithmetic on the straight line), 94 percent of the budget. The production
builder run over the synthetic corpus gives 50,680 at that point, 77 percent, and its manifest grows
2.1 gz bytes per article on average over the first 730 articles (280 to 1,803) and 1.4 over 3,650 (to
5,547). The file budget is crossed after 8.8 to 9.0 years. Row G67 records both budgets as growth per
article, and every one of these figures is an estimate.

### Limits of the measurements

- **Compression.** Every size is `gzipSync` at the default level in Node 26.8.1, which bundles zlib
  1.2.12. The guard and the Playwright test use the same function. The edge encodes with its own
  encoder, so bytes on the wire differ somewhat from these; the budget is a bound on the measured
  figure, not on the figure the edge sends.
- **The real corpus is small.** 110 documents, of which ten are articles. The straight-line rates are
  fitted on the first k posts of those ten (k from 0 to 10): 1,870 gz stored per article over the last
  five and 2,078 over the first five, and 5.0 gz of manifest over the last five and 5.8 over the first
  five, so the slope is itself uncertain.
- **The two growth estimates differ, and so do their dates.** `npm run measure:search` does not
  rebuild the index. It prices the postings and the keys the ten articles own at the encoding the
  builder uses, and its unit tests hold that estimate to what the builder adds for the next articles
  within 2 percent. It prices the manifest in raw bytes, the 9.5 bytes of the last key that each new
  chunk adds, and assumes gzip saves nothing on them. On the real ten posts it estimates 5,527 bytes
  of chunk text, 0.45 chunks, 0.62 files and 4.3 bytes of manifest for one more article, where the
  straight line gives 5.0 gz bytes and 0.6 files. Its date for the first-query budget is therefore
  later and its date for the file budget earlier. The straight-line dates round a half day down and
  the command rounds up, so for the same inputs the command gives 2032-12-05 and not 2032-12-04.
- **Every projection is modelled.** The figures at +730, +1,460 and +3,650 articles, the recall, and
  every crossing date come from the production builder run over a synthetic corpus that resamples the
  ten real posts with a decaying rate of new vocabulary. Real future articles may bring vocabulary
  faster or slower than that, and the model cannot say which.
- **The recall figures are probably pessimistic [INFERENCE].** The model resamples the same ten posts,
  so the commonest words keep their share for ever, where a real corpus would dilute them.
- **97 queries are 97 queries.** The first-query p50, p95 and maximum are over that set, 24 of which
  return nothing, and not over the traffic of the site.
- **One throttled query.** The wire measurements come from one query, `ai governance policy`, in
  Chromium over CDP, and were not repeated on the deployed site.

## Impact on machine surfaces

- `/openapi.json` describes one search path, `/search-index/manifest.json`, with its own schema, in
  place of seven. The files under `/search-index/<version>/` are implementation files: the constant
  `SEARCH_INDEX_IMPLEMENTATION_FILE` in `site/scripts/gen-openapi.mjs` keeps them out of the document
  and out of the catalogue, so neither grows with the corpus. A JSON file the index keeps outside a
  version directory is still a candidate and is a finding if undescribed.
- `/.well-known/ai-catalog.json` lists one search entry, `urn:air:meshin.co:search:manifest`, and 12
  entries in all, against 18.
- Every file of the index stays under the noindex rule for `/search-index*`, and `gate:machine` now
  checks each one against the built headers file.
- `gate:parity` reads the manifest and the pages. A route owed a search entry that the manifest lacks
  prints `PARITY <route> is owed a search entry: /search-index/manifest.json holds no entry for it`.
  `gate:machine` prints `/search-index/manifest.json lists /case-studies but /case-studies has no live case entry`
  when the index lists a hub or an entry of a collection that has no live entry.
- The seven shard routes and `/search-entries.json` are not served.

## Not in scope

- The ranking weights, the kinds, typo tolerance and semantic ranking. The index returns what the old
  scan returned, apart from stop words and the list cap, and a differential test holds it to that.
- A body excerpt. The body does not ship; a snippet store would be its own change.
- The sitemap and the `post` index of the llms files, which stay in gap row G65.
- The layout of `/search` and the budget of any other route.
- A larger chunk, or another level of index, to lift the list cap. Row G66 records the gap.

## Calibration Gate

The built-byte surface changes (`site/src`, `site/public`, `site/scripts`, `site/package.json`), so the
tasks carry a Calibration Gate group. The procedure is `docs/plan/reference/calibration-gate.md` and it
has no waiver path. Every constant below was chosen from a measurement of the real corpus of
2026-11-04, and the table says from which.

The chunk size was chosen from the first-query budget and not from total bytes. The prototype built
the index at three chunk sizes over the same 110 documents:

| chunk size, raw bytes | term chunks | whole index, gz | largest term chunk, gz | 8 chunks as large as the largest, gz |
| --------------------- | ----------- | --------------- | ---------------------- | ------------------------------------ |
| 16,384, prototype | 8 | 51,050 | 5,083 | 40,664 |
| 32,768, prototype | 4 | 50,279 | 9,977 | 79,816 |
| 65,536, prototype | 2 | 49,688 | 19,540 | 156,320 |
| 12,288, production | 17 | 74,464 | 3,733 | 29,864 |

The prototype totals are the term chunks (leaf terms only: 39,042, 38,290 and 37,713 gz), 7 document
pages (11,825 gz) and a manifest (183, 164 and 150 gz). The production total is larger because its
chunks also hold a merged list for every branching prefix, which is what lets a word that starts a
word be one lookup. A probe on the real corpus found 3,467 terms and 4,388 keys, 18,238 (term,
document) pairs and 39,646 (key, document) pairs, and chunk text of 38,009 gz as leaf terms against
61,288 gz with the prefix lists, within 1.1 percent of the 60,629 gz the production chunks hold. The
prototype totals therefore show how little the chunk size moves the total, 2.7 percent over a
fourfold range, and not what the production index weighs. The last column is arithmetic, not a
measurement: eight chunks as large as the largest.

| constant | value | chosen from |
| -------- | ----- | ----------- |
| `INDEX_LIMITS.chunkBytes` | 12,288 | The table above. A first query fetches up to 8 chunks, so the size of one chunk is the size of the term part of it: at 32,768 bytes eight full chunks would take 79,816 gz, over the whole 65,536 budget before the manifest and the pages, and at 16,384 they would take 40,664, 62 percent of the budget for the terms alone. The production builder took 12,288 so that a single chunk stays small for the first query: the largest of its 17 chunks is 3,733 gz, they hold 206,325 raw and 60,629 gz bytes in all, and the 8 largest take 29,477 of the worst first query of 43,312. |
| `INDEX_LIMITS.listCap` | 1,228 | `floor(chunkBytes / 10)`, because a posting takes at most 10 bytes, so one full list always fits one chunk. A test pins that. Today the commonest prefix, `re`, holds 98 postings of 110 documents, 8 percent of the cap. |
| `INDEX_LIMITS.pageDocuments` | 6 | Six rows at their limits are about 5,000 raw bytes, under half of one chunk. The largest real page is 1,465 gz and the 19 pages hold 13,555 gz in all, so a first query holds every page today, since 19 is under 20. The page size trades files against bytes per hit and was not swept in the measurements recorded here. |
| `ROW_LIMITS` | href 160, title 160, description 500 | The longest of the 110 real values: href 85, title 95, description 494. None is over a limit. The description is within 6 characters of its limit, so a longer one is clipped in its row and stays searchable in full. A longer href stops the build. |
| `FIRST_QUERY_BUDGET_BYTES` | 65,536 | 64 KiB, the cap the largest search file already had. It is derived, not typed: the gzip bytes of the manifest, plus the 8 largest chunks, plus the `min(20, pages)` largest pages. The measured worst case is 43,312, 66 percent of the cap, and the median real first query is 14,877. |
| `INDEX_FILE_BUDGET` | 4,000 | Cloudflare Pages allows 20,000 files in a deployment. The build holds 350 files today, 37 of them index files, and the index grows by 0.6 files per article on the straight line and 0.62 by `npm run measure:search`. 4,000 keeps the index to a fifth of the allowance and is crossed in 2035 by either. |
| `MAXIMUM_QUERY_WORDS` | 8 | The longest of the 97 real queries holds 8 distinct words after stop words, 2 queries hold 8 and none holds more. Each distinct word costs one chunk, so 8 bounds the term part of the first query at 8 chunks. |

### Pending, owed by the owner before this change is archived

None of these has been run on this tree. Each is an unticked task.

- Lighthouse 100 in every category, mobile and desktop, on `/search` and on the home page, with
  `npm run gate:lh`.
- `npm run test:smoke`, every family, including `search-index-grows-with-corpus` and the parity
  specimen that removes a search entry. The suite needs a full build and three browsers.
- The Playwright suite, including `site/tests/search.spec.ts` and its test `search returns real hits and
  the first query downloads less than the first-query budget`, with `npm run gate:visual`.
- A first query in a real browser on the deployed preview: the bytes downloaded and the time, set
  against 43,312 worst and 14,877 median.
- The Calibration Gate report for this change, committed as audits/phase-41-search/REPORT.md once the owner has run the gate (the file does not exist before then).

### Reproducing the numbers

`npm run measure:search -- --per-day 2 --today 2026-11-04` (`site/scripts/measure-search.mjs`) reads the
built `dist/search-index/` and prints the bytes of the manifest, the term chunks and the document
pages, the worst first query against its budget, what one more article adds, and one line for each of
the first-query budget, the file budget and the list cap with the day it is crossed. Without
`--per-day` it takes the articles a day from the write times of the engine config, and without
`--today` it starts from today in UTC, so a run on another day prints later dates. It exits 0
whatever it finds and 2 for an index it cannot measure or a flag it does not know. On the tree of this
proposal it prints:

```text
first query worst case: 43312 bytes gz of 65536 (manifest 280 + 8 largest chunks 29477 + 19 largest pages 13555), 22224 to spare
one more article adds about 5527 bytes of chunk text: 0.45 chunks, 0.62 files and 4.3 bytes of manifest (raw, gzip assumed to save nothing), estimated from the postings and keys the articles own
first query budget (65536 bytes gz): after 5019 more articles, in 2510 days, on 2033-09-18, at 2 articles a day, beyond 5 years
file budget (4000 files): after 6429 more articles, in 3215 days, on 2035-08-24, at 2 articles a day, beyond 5 years
list cap (1228 postings): "re" holds 98, carried by 10 of 10 articles; after 1130 more articles, in 565 days, on 2028-05-22, at 2 articles a day, inside 5 years
```

The straight-line rates, the recall and the figures at +730, +1,460 and +3,650 articles are not
printed by the command. They come from the production builder run by throwaway scripts over a
synthetic corpus, and those scripts are kept outside the repository, so these figures can be
reproduced only by writing the same synthetic corpus again.
