# Write from measured keyword demand

## Why

The picker chooses the next article from `audits/search-demand.md`. That report holds only queries
Search Console already showed the site for, and the site sits at positions 47 to 100 while the
signal-1 band is 8 to 30. Replaying all 13 versions of the report through the picker's own modules
`topic-demand.mjs` and `demand-report.mjs` gave 0 candidates on every one, recorded in
`investigation/09-what-the-demand-instruments-see.md`. With no lead the picker falls to the category
rotation, which asks the model for a query per category and spends tokens on every attempt.

A second instrument exists. `Measure keywords` writes `audits/keyword-demand.md` weekly from the Bing
Webmaster API, and its `## Candidates` section lists phrases with an exact Bing impression that no
route serves. The first live run priced 312 phrases and found 47 with an exact impression, 7 of them
served by no route, from `ai governance framework` at 803 exact impressions down to
`ai governance policy` at 32.

## What changes

A fifth topic origin, `keyword`. When no Search Console signal yields a lead, the picker takes the
candidates of `audits/keyword-demand.md`, most exact impressions first, before the category rotation.
The order becomes Search Console lead, keyword candidates, category rotation.

- A keyword pick costs no model call: the phrase is already the query. A category pick spends tokens
  on every attempt, so this rung is cheaper than the one it precedes.
- A candidate whose concept the register of `docs/SEMANTIC-CORE.md` already owns is no new page (L51). It
  becomes a strengthening advisory naming the owning route, with the phrase and its exact impressions, and
  the walk goes on. A candidate refused by any other occupancy check is skipped into the trail. Neither
  ends the run.
- A missing, unreadable or empty report is no candidates and never an error, so a site with no Bing
  key behaves exactly as it did before.
- The entry carries `origin: 'keyword'`, the phrase, and a `demand` of its exact impressions with a null
  position. It has no buyer prompt, no category and no weakness.

The limits stay with the reader. The report is weekly. Bing's index is smaller than Google's, so a
phrase that reads 0 is weak evidence and never a veto. Exact impressions show a phrase was searched,
never that a page would win it. The decision is row L69 of `docs/plan/reference/locked-decisions.md`,
which amends L61.

With the shipped `keywords.templates`, every template is `{concept}` or `{title}`, so almost every phrase
names a register concept by construction. All 7 candidates of the first live report do, per `registerOwner`
in `scripts/topic-owners.mjs`: the rung yields 7 advisories and 0 new articles, and the run descends to the
category rotation. Making the rung write new pages is a question for the templates, not for the code.

## Why this change is parked

`openspec/changes/44-retry-a-stopped-write` is in flight and its last task cannot be ticked before
2026-11-21. A change with ticked boxes cannot be parked, so this one is, and the code it describes
ships ahead of its own spec delta, as it does for `45-order-a-topic-by-hand`. Row G80 of
`docs/plan/reference/known-gaps.md` records that window for 45, and the same window holds here: until 44
is archived, then 45, then this change, the main specs still read three origins and three rungs.
