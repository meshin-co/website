# Measure Demand the Site Has Not Reached

Search Console reports only queries the site was already shown for, so it cannot name an opportunity.
`npm run audit:keywords` asks Bing Webmaster Tools how often people search a phrase the site has never ranked for.
The topic picker does not read its report yet: today it is evidence for a person.

## What each instrument sees

- **Search Console:** queries the site was shown for. Replaying all 13 versions of `audits/search-demand.md` through
  the picker's own modules gave 0 candidates on every one (`investigation/09-what-the-demand-instruments-see.md`).
- **Bing `GetKeywordStats`:** up to 24 weekly rows for a phrase you name. It proposes nothing: `GetRelatedKeywords`
  answered zero rows for every phrase, "seo" included. The audit therefore builds the list itself.
- **Where the volume is,** measured 2026-11-09 over 312 phrases: 47 carry an exact impression, 7 of them unserved.
  Phrases with volume per shape: `{concept}` 25 of 38, `what is` 15 of 52, `framework` 2 of 32, `examples` 1,
  `policy` 2, `template` 2, `risks`, `requirements`, `checklist` 0. Shapes that earn name an artefact a reader copies.
  Hypothesis: `guidelines`, `playbook`, `best practices` replaced the dead three on 2026-11-10 (G85); 2026-11-16 settles it.

## How the audit builds its phrases

No model is called. Each template of `keywords.templates` in `site/engine.config.json` is filled once per concept of
the register in `docs/SEMANTIC-CORE.md` (`{concept}`) or once per glossary title with the site name removed
(`{title}`). A template holds one placeholder. Phrases are lower-cased, `?` is dropped and a repeat is priced once.
A buyer prompt is never priced as written. `scripts/keyword-demand.mjs` holds the key and the request,
`scripts/keyword-demand-cache.mjs` decides which phrases the previous report already measured,
`scripts/keyword-demand-rows.mjs` builds the phrases and the rows, `scripts/keyword-demand-render.mjs` writes the
report and `scripts/keyword-report.mjs` reads one back. `scripts/audit-command.mjs`, `scripts/report-reading.mjs`
and `scripts/report-freshness.mjs` are shared with the Search Console command.

Each phrase priced is one request of about a second: 312 phrases took 404 seconds. A phrase measured within
`keywords.maxAgeDays` (35) days is carried from the previous report with its own `Measured` day and costs no
request, so a shape that earns nothing costs its seconds only when its phrases fall due: drop it.

## Which route serves a phrase

A route serves a phrase when the route's target query or its title contains every word of the phrase, function words
(a, the, is, what, how, for) set aside. The `Query` and `Title` come from the generated layer of
`docs/SEMANTIC-CORE.md`. This is not `sameDemand` in `scripts/search-demand-rows.mjs`: that rule is symmetric, would
count "shadow ai policy" as served by the "shadow ai" page, and then no templated phrase could ever be a candidate.

## The key and the throttle

Where the key comes from and where it is stored: `docs/plan/reference/search-credentials.md`. Without it the
command exits 3 naming the variable and writes nothing, because an empty report reads like a phrase nobody
searched for. The key is redacted from every error message.

Bing throttles. Four concurrent requests lost 48 of 196; serial requests with no gap throttled after 100 to 200;
a 700 ms gap ran 72 calls clean, and 312 clean. So the command sends one request at a time and waits
`keywords.requestGapMs` (700) between them. On a throttle answer it waits 5 s, then 10 s, then 15 s, up to 6 tries
for one phrase, then stops asking. `keywords.country` must be lower case (`us`) and `keywords.language` must read
`en-US`; Bing refuses `US` and `en-us`.

`GetKeywordStats` once answered `ThrottleUser` for over three hours while other endpoints stayed 200, which looks
like a daily cap. So a throttle that outlasts the 6 tries does not lose the run. The report is still written with
the phrases priced this run, the phrases carried from the cache, and the phrases never reached listed under
`Not measured`; the head says `Partial run:` and the command exits 0. Those phrases are unknown, not zero. The next
run asks only for them. A run that priced no phrase and carried none exits 1. Any other failure (a refused key, a
malformed answer, an argument out of range, an unreachable host) still exits non-zero and writes nothing.

## Read `audits/keyword-demand.md`

`Measure keywords` (`.github/workflows/measure-keywords.yml`) runs it weekly with `-- --key-source secret` and
commits the report, which the next run reads as its cache. The daily writer never holds the key, so Bing can never
cost an article. By hand: `cd site && npm run audit:keywords`.

The head holds `Generated-from:`, `Measured:` with its window, `Market:`, `Totals:` and `Run:` (phrases built,
priced this run, carried from the cache, never answered). **Exact** and **Broad** are the sums of Bing's weekly
exact-match and broad-match counts over the window; **Weeks** is how many weekly rows came back, and 0 means Bing
holds no data; **Measured** is the day Bing was asked, so a report holding carried phrases holds several days;
**Served by** names the routes that serve the phrase, or `-`. **Candidates** are the phrases with an exact
impression that no route serves. **Not measured** appears only in a partial run. Two limits the report states:
Bing's index is smaller than Google's, so a zero is weak evidence and never a veto, and the instrument prices
phrases and never proposes them.

## What `npm run gate:keywords` checks

It runs offline, with no secret, in the `types-and-units` job of `ci.yml`: `KEYWORDS report-stale` when the
`Measured:` date is missing, in the future, or older than `keywords.maxAgeDays`, `report-unreadable` when no table
has the cells Phrase, Exact, Broad, Weeks and Served by, `phrase-stale` when a phrase was measured more than
`keywords.maxAgeDays` before the report's own date, and `report-unaccounted` when the `Run:` line disagrees with
the tables (`scripts/keyword-demand-gate.mjs`). It cannot tell whether a zero is real.
