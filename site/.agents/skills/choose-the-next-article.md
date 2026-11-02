# Choose the Next Article

The next article comes from what people searched for, not from taste. `audits/search-demand.md`
holds what Search Console measured for `sc-domain:meshin.co` over a 90-day window, Google web search
only. Read it before step 1 of `run-the-growth-loop.md`, and write down the number that made the
choice.

## A fresh report first

`npm run gate:demand` fails when the `Measured:` date is more than 35 days old and names the date.
Refresh from `site/` with `npm run audit:demand`. It reads `GSC_SERVICE_ACCOUNT_JSON` and
`GSC_PROPERTY` from a file named .env beside `site/.env.example`, which git ignores, and rewrites the
report. The key only reads, stays out of git and out of CI, and is never printed. A missing or bad
key fails naming the variable and writes nothing, because an empty report reads like a site nobody
searched for.

- `scripts/fetch-search-demand.mjs` is the command. `scripts/search-demand.mjs` holds the key, the
  signed assertion and the requests, `scripts/search-demand-rows.mjs` joins the reads to the 30
  prompts, and `scripts/search-demand-render.mjs` writes the text.
- The answer engines are a different instrument: `probe-the-buyer-prompts.md`. Neither stands in for
  the other.

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

The unattended loop (`pick-the-next-topic.md`) writes one post a day, always from signal 2. Signal 1 is
never a page: it becomes a strengthen report for a human. Signal 3 never gives a post, because a claim
needs a prompt: a definitional query becomes a glossary term, any other a proposal for a prompt that
the owner adopts. It writes the record lines below.

## Record the choice

One line in the commit message of the article, with the number that justified it:

    Choice: <signal 1 or 3>, "<query>", <impressions> impressions at position <position>, measured <date>
    Choice: signal 2, prompt <number>, unproven, 0 impressions in the window to <window end>

The next report is the only evidence the choice worked. Compare the same query or prompt in it.

## What `gate:demand` refuses

`scripts/search-demand-gate.mjs` runs offline on the committed report, in CI, with no secret.

- A `Measured:` date more than 35 days old, missing or in the future. It names the date and
  `npm run audit:demand`.
- A buyer prompt of the core with no row in Buyer prompts. A row counts when it carries the prompt's
  number and its text as the core has it, so a prompt added or reworded fails until the next fetch.
- A document that says a prompt is won while its row reads `unproven` or 0, or while it has no row.
  It names the document, its line, the prompt and the number.

A claim is the closed sentence `Prompt 7 is won`, also `Prompts 3 to 5 are won`, `Prompt 7 was won`
and `Prompt 7: won`, starting a sentence. `scripts/search-demand-claims.mjs` skips negation,
conditions, futures, questions, code spans and fences. The gate reads the Markdown `gate:docs` reads,
less archived changes and `investigation/` records; a paraphrase is not read, so it judges no prose.

The word won is tied to this report: say it only when the report records impressions for the prompt.
An answer-engine result is cited or mentioned. Impressions are necessary, never sufficient.

## Limits

The spec sets 35 days; it is not a measurement. The gate has no impression floor and no position bound:
one chosen on a few dozen impressions would be a guess that refuses every honest sentence or never
fires. Search Console withholds rare queries, and the Pages table adds up to more than the total
because one results page can show more than one page of the site: choose from Queries and Buyer prompts.
