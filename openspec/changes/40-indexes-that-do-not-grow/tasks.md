# Tasks

## 1. Measure before choosing

- [x] 1.1 Build the real corpus and record the bytes of every machine file, and the largest and the mean
      entry of each collection, in the tables of the proposal
- [x] 1.2 Project a year at two posts a day for every file before and after, by running the real
      generators over entries sized like the measured ones

## 2. The spec moves first

- [x] 2.1 The delta under `specs/` replaces "every entry is in llms-full.txt" with "every entry ships
      once in its collection's files and is reachable from `llms.txt` in two further fetches", and
      removes the guarantees that a bounded file cannot keep

## 3. The generators

- [x] 3.1 `LLMS_FILE_MAX_BYTES`, `LLMS_SHARD_FRAME_BYTES`, `LARGEST_MEASURED_ENTRY_BYTES` and the
      derived `LLMS_SHARD_MAX_ENTRIES` in `llms-collections.mjs`, with tests at cap, cap + 1,
      2 x cap and 2 x cap + 1 for every collection
- [x] 3.2 `llms-full.txt` is an index of the collection files; the fallback inside it goes and
      `LLMS_FULL_MAX_BYTES` is 4096
- [x] 3.3 Collection feeds carry the newest `FEED_WINDOW` entries under a total order; the feed byte
      budgets are derived from the windows

## 4. The guards

- [x] 4.1 `gate:machine` checks every file under `/llms/` against `LLMS_FILE_MAX_BYTES` and every shard
      against its collection's cap
- [x] 4.2 `gate:machine` reads a collection's index and its shards for entry coverage, refuses an
      index that carries an entry, and checks `llms-full.txt` for size, count and inline entries
- [x] 4.3 `gate:machine` checks every feed for its window and its byte budget

## 5. The readers

- [x] 5.1 `gate:parity` owes an entry no place in `llms-full.txt` and an item in the collection feed
      only inside the window, and still owes a place in its collection's shards
- [x] 5.2 The live announcement, the agent catalogue, the skills and the plan documents that describe
      the files say what the files now are; `generate-geo-baseline.mjs` and `smoke:prod` were read and
      need no change, because the first concatenates every file under `dist/llms/` and the second asks
      `/llms.txt`, `/rss.xml` and `/feed.json` for a 200 and nothing about their content

## 6. Proof

- [x] 6.1 One planted specimen and one `test:smoke` family for each new guard: a shard over budget,
      `llms-full.txt` over budget, `llms-full.txt` listing an entry, a shard over its cap, a shard
      missing an entry, an index carrying an entry, `llms-full.txt` with a drifting count, a feed over
      its window, a feed over its budget, and an entry missing from its shards for `gate:parity`
- [x] 6.2 Two `test:smoke` families break the generator on purpose, by dropping the id tie-break and by
      appending a timestamp, and require `npm run test:llms` to go red
- [x] 6.3 The planted specimens were proved one by one with `proveWithSpecimen` on a copy of the
      build, red on the plant and green without it, because `test:smoke` was not run here

## 7. Calibration Gate

- [ ] 7.1 `npm run test:smoke` proves every guard family can still fail, including the thirteen new
      ones. Not run here: it needs a full build and three browsers
- [ ] 7.2 After 30 days of live runs, run `npm run build && npm run measure:llms`, and compare the
      largest entry of each collection with `LARGEST_MEASURED_ENTRY_BYTES`. A line that says `grew past the record`
      lowers that collection's cap by a decision recorded here, and a shard over `LLMS_FILE_MAX_BYTES`
      fails `gate:machine` before this is due
- [ ] 7.3 Read the size of `dist/llms/post.txt` once a quarter: it gains one line of about 67 bytes for
      every three posts and passes `LLMS_FILE_MAX_BYTES` after about six years of two posts a day
- [ ] 7.4 Run the Calibration Gate and commit the report it generates for this change, as change 26 owes

## 8. Found while building, not fixed

- [ ] 8.1 `gate:search` caps each search shard at 64 KiB gzipped and `search-index-post.json` measured
      42,654 bytes for ten posts, so the post shard crosses the cap at about the sixteenth post. The
      writer reaches it in three days. The fix changes the browser client and the JavaScript budget, so
      it needs its own change
- [ ] 8.2 `gate:machine` reads `sitemap-0.xml` only; `@astrojs/sitemap` writes a second file at 45,000
      URLs, about 60 years of two entries a day from now
- [ ] 8.3 The `post` index is the one machine file that still grows with the corpus, by one line for
      every three posts; a third level of indexes would be needed after about six years
