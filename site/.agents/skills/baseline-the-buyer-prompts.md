# Baseline the Buyer Prompts

`npm run audit:geo` scores the 30 buyer prompts in `docs/SEMANTIC-CORE.md` against the shipped
build and writes `audits/geo-baseline.md`. It is the before-picture Phase 6 measures against, and
it runs offline.

## What it can and cannot tell you

It measures only what the site controls, per prompt:

- the must-win route the core names actually builds
- that route ships the passage the core quotes, compared with entities decoded and dashes and
  quotes normalised
- the route carries a marked citable unit (`data-answer` or `data-gate-lead`), a JSON-LD graph and
  a line in `llms.txt` or a `/llms/` file

It cannot tell you whether an engine cites you. That is the hand protocol in the core: check each
prompt in ChatGPT, Claude, Perplexity, Gemini and Google AI Mode, record mentioned / cited / no,
against the PRD §5 targets of 5/30 by month 6 and 15/30 by month 12.

The generator is `scripts/generate-geo-baseline.mjs`; the parsing, scoring and rendering live in
`scripts/geo-baseline.mjs`, which is where the tests point.

## What this is not

The score is structural readiness: whether a route exists, ships the promised passage, and carries
a marked citable unit, a JSON-LD graph and a line in `llms.txt` or a `/llms/` file. The protocol in
`docs/SEMANTIC-CORE.md` also asks for each prompt to be run through ChatGPT, Claude, Perplexity,
Gemini and Google AI Mode and recorded as mentioned, cited or absent. Nothing here queries an
engine. Never present the readiness number as a citation rate, and never diff engine behaviour
against it.

## Reading a gap

`marked citable unit` missing does not mean the page has no answer. It means nothing in the markup
says which paragraph is the answer, so extraction guesses. FAQ leaves carry the marker; several
static pages do not.

`the core names no must-win route` means the prompt has no owning page at all — prompts 19 to 22 on
2026-09-15. Those are the GAP register rows, they need a new route, and they stay owner-blocked
until the facts exist.

## First run, 2026-09-15

12 of 30 ready. 14 gaps were a missing marked citable unit on `/`, `/about`, `/pricing`,
`/approach`, three services and three resources; 2 were a passage the page no longer ships; 4 had
no route at all. Re-run after any content change and commit the artifact with it.
