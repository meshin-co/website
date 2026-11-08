---
record: true
---

# 09. What the two demand instruments can actually see

Date: 2026-11-07. Read-only measurement, no change to the site.

## The question

The site publishes two articles a day and has had 0 clicks from Google search since it launched. The
owner asked whether IndexNow works, and whether the writer follows what he asked it to do. Both turn
out to be yes. The useful question underneath them is a different one: **what can the engine measure
about demand, and what is it blind to?**

## What was measured

Three instruments, all read-only, all on 2026-11-07.

1. The Search Console URL Inspection API, on every one of the 31 blog addresses in `sitemap-0.xml`.
2. Every version of `audits/search-demand.md` that exists in git, 13 of them, replayed through the
   picker's own modules `topic-demand.mjs` and `demand-report.mjs`.
3. The Bing Webmaster API `GetKeywordStats` endpoint, on the 30 buyer prompts of
   `docs/SEMANTIC-CORE.md` and on the 32 glossary titles.

## Finding 1: the articles are indexed, and nobody sees them

| Coverage state Google reports  | Addresses |
| ------------------------------ | --------- |
| Submitted and indexed          | 24        |
| URL is unknown to Google       | 6         |
| Crawled, currently not indexed | 1         |

The six unknown addresses are the six newest; the one crawled and not indexed is a tag page, not an
article. Canonical, `robots` and the sitemap are correct on the pages checked. Indexing is not the
problem.

The problem is that in the 90-day window to 2026-11-05, **no article carried a single impression**.
All 89 impressions went to seven glossary pages and to navigational queries for the brand. The
glossary pages sit at positions 57 to 92, which is the sixth to tenth page of results.

## Finding 2: the demand half of the picker has never had a candidate

Replaying all 13 reports through the picker's own modules:

| Report dates                         | Impressions     | Signal 3 candidates | Signal 1 candidates |
| ------------------------------------ | --------------- | ------------------- | ------------------- |
| 2026-11-02 to 2026-11-07, 13 reports | 77 rising to 89 | **0 on every one**  | **0 on every one**  |

Signal 1 asks for a query at position 8 to 30. Nothing the site ranks for has ever been in that band:
the measured positions are 3 to 7 for two brand queries and 47 to 100 for everything else. Signal 3
asks for a measured query no route answers; every measured query is already assigned to a route.

So the order of the signals is not what keeps the writer on the semantic core. **There has never been
anything else to choose.** Reordering them would have changed none of the six articles written so far.

## Finding 3: Search Console cannot answer the question that matters

This is the structural limit, and it is the reason the first two findings look the way they do.
Search Console reports queries for which the site **was shown**. A phrase the site has never ranked
for anywhere in the first hundred results produces no row, so it cannot appear in the report, so it
can never become a candidate. The instrument is a mirror of what already happens, and the engine was
asking it to name an opportunity.

## Finding 4: Bing answers, but only for short phrases

The Bing Webmaster API is free with a verified site and carries no paid tier, which is what L58
requires. `GetKeywordStats` returns 24 weeks of exact and broad impressions for a phrase. Measured
with `country=us` and `language=en-US`; note that `country` is lowercase and a capitalised value is
refused with `Specified argument was out of the range of valid values`.

**The 30 buyer prompts: 0 of 30 returned any volume.** They are sentences, such as "named person
responsible for AI risk in vendor procurement", and Bing has no data at that length.

**The 32 glossary titles: 7 returned volume**, and they are the short question forms:

| Phrase                                  | Bing exact impressions, 24 weeks | Google impressions, 90 days |
| --------------------------------------- | -------------------------------- | --------------------------- |
| What is shadow AI?                      | 1760                             | 0                           |
| What is AI governance?                  | 628                              | 9                           |
| What is prompt injection?               | 560                              | 0                           |
| What is retrieval augmented generation? | 391                              | 0                           |
| What is a DPIA?                         | 134                              | 0                           |
| What is the EU AI Act?                  | 94                               | 48                          |
| What is data classification?            | 10                               | 0                           |

The site already has a page for each of these seven. The largest measured demand it touches, shadow
AI at 1760, has produced nothing in Google at all.

`GetRelatedKeywords` returned zero rows for every phrase tried, including "seo", so phrase discovery
cannot come from that endpoint. A phrase has to be named before Bing will price it.

## What this means for anything built next

- A keyword instrument must probe **short concept phrases and question forms**, never a buyer prompt
  verbatim. A gate threshold fitted to prompt-length phrases would be fitted to a measurement that is
  always zero.
- Bing prices a phrase that is named; it does not propose one. Candidate phrases have to be generated
  from what the site already knows about itself.
- Bing's index is smaller than Google's, so a zero from Bing is weak evidence of no demand. It is
  usable as a floor, never as a veto.
- The seven phrases above are demand the site already serves with a page and still loses. That is a
  ranking problem, not a coverage problem, and no amount of new articles addresses it.

## Commands

Each finding above is reproducible:

- Indexing: `POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect` with the same
  service account `npm run audit:demand` uses, one call per address.
- Replay: read each `git show <sha>:audits/search-demand.md` through `readDemandReport` of
  `site/scripts/demand-report.mjs`, then count `weakCandidates` and `strengthenCandidates` of
  `site/scripts/topic-demand.mjs`.
- Bing: `GET https://ssl.bing.com/webmaster/api.svc/json/GetKeywordStats?q=<phrase>&country=us&language=en-US&apikey=<key>`.
