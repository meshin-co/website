# Write on a Category

Change `30-write-twice-a-day` makes every run of the unattended writer write an article. The site is new, its demand
report is empty for months, and a writer that waits for traffic never creates it. `pick:topic` (`pick-the-next-topic.md`)
therefore tries three rungs in order and stops at the first that gives a topic. Each claim and each generation record
carries the rung as `origin`; a record written before the change has none and reads as `demand`. The owner accepted the
cost: the corpus fills with topics nobody has searched, and the average quality of an entry drifts down.

## The three rungs

1. **`demand`:** the first unproven buyer prompt that survives the refusals. It needs a fresh `audits/search-demand.md`.
   The entry keeps its prompt and registers a passage for it in `docs/SEMANTIC-CORE.md`.
2. **`weak-demand`:** the measured query with the most impressions that no prompt names, no page answers and a question
   or procedure cue asks (signal 3 of `choose-the-next-article.md`), if it passes the refusals below. `weakness` lists
   why it is weak, computed from its row and never typed: `no-buyer-prompt` always, `impressions-at-floor` at exactly
   `demand.minImpressions`, `position-beyond-strengthen-band` when the position is past the band.
3. **`category`:** a category of `loop.categoryRotation`, for which one model call proposes the query. It needs a
   non-empty list and a `--write` run: a preview never calls a model, it prints the rotation order.

Rungs 2 and 3 carry no buyer prompt: the claim has no `prompt` key, and a category claim has `demand` of 0 impressions
and no position. `originProblems` (`scripts/autowriter-claims.mjs`) refuses a claim whose origin contradicts its
fields, and `gate:autowriter` applies it to the claim block of every record.

## The rotation

`scripts/topic-categories.mjs` orders the categories from the corpus: fewest articles first, counting published posts
and unexpired `category` claims (so two runs close together do not take one category), then the category whose newest
article is oldest (one with none counts as oldest), then the order of the list. There is no stored counter. A counter
is state that a failed run, an abandoned pull request or a deleted entry leaves wrong, and a person would repair it.
The derived count corrects itself. Each id of `categoryRotation` is checked against `CATEGORIES` when the module loads.

## The proposal

`scripts/topic-proposal.mjs` takes the categories in rotation order and makes at most two calls for each. A call has
the role `topic`, the schema `{query}` and 200 output tokens. It shows the category's pillar text, up to 120 published
titles newest first, the titles of articles in flight and the concepts of the register that it must not define. The
second call for a category also shows the refused query and why. Rungs 2 and 3 put a query through these refusals:

- `format-mismatch` (a definition is a glossary term), `title-too-long` and `no-slug`: only in the trail.
- `register-owner`, `family-served`, `route-exists`: the owner of the concept, L51 (`scripts/topic-owners.mjs`).
- `title-collision`, `slug-held`: the claim store (`scripts/topic-claims.mjs`).
- `same-subject`: the repeat guard.

The first query that survives is the entry. A `vendor` or `output` failure costs one attempt. A `credential`, `config`,
`model` or `price` failure stops the pick with exit 1 and the workflow escalates it (`escalate a pick that failed`).

## The repeat guard

`scripts/topic-repeat.mjs` reduces a title and a query to word stems and refuses at a containment of 0.5 against every
published article and every unexpired article claim. On the real 10 posts (`scripts/topic-repeat.site.test.mjs`) two
distinct articles reach at most 0.20, 17 hand-made rewordings reach 0.60 to 1.00, and 10 fresh topics reach at most
0.40. Both limits are pinned. It refuses a fresh topic that shares generic words (0.57 against the operating-model
article for a pilot-pricing question), which costs one call. A paraphrase that shares no topical stem passes (0.00
against the pilot article). The other two layers are the register and the model, which sees every title. All three can
miss, and the Calibration Gate reads the first entry of each category for that.

## Blind entries

`npm run measure:origins` prints entries, calls, tokens and cost by origin, the weak-demand reasons, the category counts
and, oldest first, the entries written without a buyer prompt: slug, origin, category or reasons, date. When traffic
arrives, a person rewrites those. Such an entry has no buyer prompt, so its prompt holds an `Origin:` line and names the
query for length, `docs/SEMANTIC-CORE.md` gets no passage for it, and its commit says `Origin:` where it says `Serves`.
A glossary term beside it is written only with a prompt of its own, else it is named with `no-prompt`. `repair-open.mjs`
refuses it as `failed`, which escalates as `hard-stop`: an issue, then the digest, and a person repairs it.

## A run with no entry

There are two cases, and both end through `spend-ended.mjs pick` and its Slack message:

1. `categoryRotation` is empty and nothing is in demand. The decision is `strengthen` or `none`. No model is called.
2. Every proposal for every configured category was refused or failed. The decision keeps its kind and its `reason`
   gains `Every category was tried and no proposal passed`, then each category with its outcomes. Slack quotes the
   reason of a `none` decision and the choice of a `strengthen` one, so only the first names the categories.

Case 1 spends nothing. In case 2 no entry has a slug and so no ledger exists: the calls (at most 2 per category, 8 with
the shipped list, each about 3,000 characters in and 200 tokens out, under two cents in all at the shipped rates) are
printed and appended to the step summary, which lists every attempt, and neither the spend report nor the monthly
ceiling counts them. When a proposal survives, its calls and those of every refused attempt before it in the same pick
go into the entry's record, with the cost counted in the entry, the report and the ceiling. After 14 days of runs, read
`npm run measure:origins` (task 7 of the change): a decision nobody can measure cannot be revisited.
