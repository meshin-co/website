# Choose the Next Article

The next article comes from what people searched for, not from taste. `audits/search-demand.md` holds what Search
Console measured for the property in `site/engine.config.json` over a 90-day window, Google web search only. Read it
before step 1 of `run-the-growth-loop.md`, and write down the number that made the choice.

## A fresh report first

`npm run gate:demand` fails when the `Measured:` date is more than 35 days old, missing or in the future, and names the
date. Refresh from `site/` with `npm run audit:demand`. It reads `GSC_SERVICE_ACCOUNT_JSON` and `GSC_PROPERTY` from a
file named .env beside `site/.env.example`, which git ignores, and rewrites the report. The key only reads and is never
printed. A missing or bad key fails naming the variable and writes nothing, because an empty report reads like a site
nobody searched for.

- `scripts/fetch-search-demand.mjs` is the command and `scripts/search-demand-render.mjs` writes the text; `scripts/README.md` maps the rest.
- The answer engines are a different instrument: `probe-the-buyer-prompts.md`. Neither stands in for the other.

## The three signals

1. **A page one step away.** A Queries row with impressions and a position from 8 to 30. The route
   in its Page column already ranks: strengthen it, and add no page for the same query (one concept,
   one page: L51). Read positions in Queries only; a position in Pages is a mean over every query
   that page carried.
2. **An unproven prompt.** A Buyer prompts row that reads `unproven`: no query in the window shows
   demand for it on one of its routes. The prompt stays in `docs/SEMANTIC-CORE.md`, labelled, never
   deleted and never called won. A prompt whose core entry names no must-win route always reads
   `unproven`; that is a gap in the core, not low demand.
3. **Demand nobody serves.** A Queries row with impressions whose Prompts cell is `-` and whose Page
   does not answer it: a hub, a listing or a page that only names the subject. The dash alone is not
   enough, because it also marks a query a glossary page answers that no prompt names. When no route
   is about the query, a new route is justified, and `place-a-new-text.md` decides where it goes.

By hand, take a measured row first, signals 1 and 3 resting on someone having searched and signal 2 on
no one having. With none, an unproven prompt may still be chosen, knowingly, and the record says so.

The unattended loop (`pick-the-next-topic.md`) writes one post a run: from signal 2, else from signal 3 as a post with no buyer
prompt, else from a keyword candidate (below), else on a configured category (`write-on-a-category.md`); a hand order
(`order-a-topic-by-hand.md`) outranks all of them. Signal 1 is never a page: it becomes a strengthen report for a human. A definitional query becomes a glossary term.

## The keyword step

`audits/keyword-demand.md` is a second instrument: `Measure keywords` writes it weekly from Bing Webmaster Tools
(`npm run audit:keywords`, gated by `npm run gate:keywords`). Its Candidates section lists phrases with an exact
Bing impression that no route serves. When no signal above yields a lead, the picker walks them, most exact impressions first (`scripts/topic-keywords.mjs`), before the category rotation (L69).
A phrase whose concept the register already owns is no new page (L51): it becomes a strengthen advisory for the owning route. Only an unowned concept is written, with no model call. Any other
refusal skips it, and a missing or empty report is no candidates, not an error. The shipped templates are `{concept}` and `{title}`, so most phrases name a register concept: on the first
report 7 of 7 did, giving 7 advisories and 0 pages, and the run went on to the rotation. Bing's index is smaller than Google's, so a zero is weak evidence, never a veto, and exact
impressions show a phrase was searched, not that a page wins it.

## Record the choice

One line in the commit message of the article, with the number that justified it:

    Choice: <signal 1 or 3>, "<query>", <impressions> impressions at position <position>, measured <date>
    Choice: signal 2, prompt <number>, unproven, 0 impressions in the window to <window end>
    Choice: signal 3, "<query>", <impressions> impressions at position <position>, measured <date>; weak demand: <reasons>
    Choice: category <id>, <standing>; no unproven prompt or weak query survived, so the rotation chose it
    Choice: keyword, "<phrase>", <N> exact impressions on Bing, measured <date>
    Choice: ordered, prompt <number>, requested by hand
    Choice: ordered, "<title>", requested by hand

The next report is the only evidence the choice worked. Compare the same query or prompt in it.

## What `gate:demand` refuses

`scripts/search-demand-gate.mjs` runs offline on the committed report, in CI, with no secret.

- A buyer prompt of the core with no row in Buyer prompts, so a prompt added or reworded fails until the next fetch.
- A document that says a prompt is won while its row reads `unproven` or 0, or while it has no row.
  It names the document, its line, the prompt and the number.

A claim is a closed sentence such as `Prompt 7 is won`; `scripts/search-demand-claims.mjs` lists the forms it reads and
skips, and a paraphrase is not read. Say won only when the report records impressions for the prompt. An
answer-engine result is cited or mentioned. Impressions are necessary, never sufficient.

## Limits

The 35 days are a spec, not a measurement, and the gate has no impression floor and no position bound. Search
Console withholds rare queries, and the Pages table adds up to more than the total because one results page can
show more than one page of the site: choose from Queries and Buyer prompts.
