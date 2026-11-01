# Choose what to write from measured demand, not from a frozen list

## Why

The growth loop in `site/.agents/skills/run-the-growth-loop.md` is a cadence and a mechanic: add
the entry, write the copy, wire the machine layer, run the cheap gates, re-baseline monthly. No
step in it asks what anyone actually searched for. Topics come from the 30 buyer prompts in
`docs/SEMANTIC-CORE.md`, written by hand at planning time and never checked against a real query.
`npm run audit:geo` measures structural readiness and says so itself: it cannot tell you whether an
engine ever showed the page.

That gap closed on 2026-11-01, when a read-only Search Console service account was granted
`siteRestrictedUser` on `sc-domain:meshin.co`. The first query of the property shows the site is
not invisible, which is what the GEO probe had implied:

- 77 impressions over 2026-08-01 to 2026-10-30, all of them `web`, 0 clicks, average position 67.7
- the first impression landed 2026-10-19 and the peak was 2026-10-20 to 10-22
- the demand that already reaches the site is `eu ai act` (28 impressions, position 76), `ai act eu`
  (13, position 76) and `ai management system` (9, position 92) — pages 8 to 10
- two outliers worth naming: `"fractional chief ai officer" remote` sits at position 6, and the
  brand term `meshin` sits at position 7

A practice that sells judgement should not pick its next article by taste when the data is one API
call away.

## What changes

**The numbers enter the repository.** `npm run audit:demand` queries the property for a window that
starts 90 days before its last day, so it spans 91 days with both ends counted, and whose last day
is two days before the day the command runs, because Search Console may not have finished counting
the newest days. It writes `audits/search-demand.md`: totals, the queries that produced impressions
with their position and CTR, the pages that carried them, and a per-prompt table joining the 30
buyer prompts to what was measured. The report is committed; the raw API response is not, because
it is reproducible.

**The loop gains a step that names its input.** A new skill says how the next article is chosen:
a query with impressions and a position between 8 and 30 is a page one step away; a core prompt
with zero impressions after 90 days is a guess that has not been tested; a query with impressions
and no matching route is demand the site does not answer. The step sits in the growth loop before
the article is written, and the choice is written down with the number that justified it.

**A gate keeps the claim honest.** `npm run gate:demand` runs offline against the committed report:
it fails when the report is older than 35 days, when a buyer prompt in the core has no row, and
when a document claims a prompt is won while the report shows no impressions for it. It needs no
secret and therefore runs in CI like every other cheap gate; only the fetch is local.

## What this does not change

The 30 prompts stay. This does not delete a prompt for being unproven: it labels it, so the next
article is chosen knowing which prompts have evidence behind them and which do not. No content is
rewritten by this change, and the Search Console key stays out of git and out of CI.
