# Pick the Next Topic

Each run of the unattended writer (two a day, `schedule-the-unattended-writer.md`) chooses its topic here. The
choice is code: `npm run pick:topic` (`scripts/pick-a-topic.mjs`) reads `audits/search-demand.md`
through `scripts/demand-report.mjs`, and `docs/SEMANTIC-CORE.md`, and decides. The signals are the
three in `choose-the-next-article.md`. Owner decisions bind it: one post a run, plus glossary terms
for measured concepts the glossary lacks, and no page for a concept the register already owns.

## Run it

```
npm run pick:topic -- [--write --output <file>] [--run-id <id>] [--now <ISO date>] [--summary <file>]
```

- With no flag it previews: it prints the decision and writes nothing. `--now` fixes the clock.
- `--write` writes each claim, the ledger and, to `--output`, the decision file. Exit 0 for every decision, 1 for an
  unreadable input, a failed write or a failed proposal (last stdout line `{"ok":false,"kind":...}`), 2 for a bad flag or setting.
- `--summary` appends a Markdown summary; `--run-id` tags claims and ledger. A preview calls no model; `--write` calls one only on rung 3 (`write-on-a-category.md`).

## The post arm

One `article` a run, rung 1 of `write-on-a-category.md`. `scripts/topic-selection.mjs` decides; `scripts/topic-walk.mjs` walks the unproven
prompts in prompt number order and takes the first that survives. Each skipped one leaves a trail step:

- `retired`: the core marks the prompt retired (L57; `scripts/topic-core.mjs` reads it): never written.
- `definition`: a definitional prompt is the term arm's job, from measured demand.
- `title-too-long`: the title is longer than `TITLE_ROOM_CHARS`; `no-slug`: the title yields no slug.
- `register-owner`, `family-served`, `route-exists` (`scripts/topic-owners.mjs`): the concept already
  owns a row in the concept register, or a route in the prompt's family already answers it. The first
  two also become strengthen reports. All three are recorded as ledger refusals.
- `title-collision`, `slug-held` (`scripts/topic-claims.mjs`): the title, folded for case and
  punctuation, is in the generated layer of the core or in an unexpired claim, or the slug is taken.

The title (`scripts/topic-format.mjs`) is the prompt as the owner wrote it, capitalised, with `?` when
the wording is a question; `how to`, `steps to`, `ways to` and `step by step` take none. The record
(`scripts/topic-wording.mjs`) is
`Choice: signal 2, prompt <n>, unproven, 0 impressions in the window to <window end>`.

## The term arm

When `WRITING_TERM_ARM` is `on` (unset means on) each measured query that is definitional (`what is`,
`what are`, `what's`, `what does X mean`) and has impressions may become a glossary `term`, most
impressions first. Search Console lower-cases queries, so `scripts/topic-casing.mjs` restores the
casing the core uses. A concept the register or a `/glossary/` route already owns is refused as above;
a repeat of the post's concept is skipped. `WRITING_TERM_CAP` (unset means 1) bounds the terms written;
`scripts/topic-settings.mjs` reads both and reports every bad value at once. The rest are listed as
`named` concepts, with `cap`, `term-arm-off` or `no-prompt` (a term needs a prompt of its own or its post's), so the digest shows what is missing. The title is
`What is X?` or `What are X?`. Terms are never written without a post.

## Strengthen reports and proposals

A measured query at a position from 8 to 30 (`scripts/topic-demand.mjs`) is never a new page: it is a
strengthen report naming its route, query and number, for a human. When no rung gives a topic, the first
report is the decision `strengthen`: no claim, and no spend unless proposals were made. The band is calibrated on the real
report (measured 2026-11-01): no query sits between 8 and 30; the nearest are `meshin` at 7.0 and
`ai governance` at 67.0, so `position <= 30` would select the empty set. Below 8 the page is already on
page one and above 30 it is not one step away. A measured query no prompt names, with no answering page
and a question or procedure cue, is a proposal for a new buyer prompt, and with no unproven prompt left the best one is written as a `weak-demand` post (rung 2). The owner adopts a prompt; the machine
never does.

## The claim, before the Writer's model

A `write` decision claims every entry in `audits/autowriter/claims/<year>/<month>/<slug>.json` through
`scripts/autowriter-claim-store.mjs`, and `scripts/commit-to-main.mjs` commits the claims to `main`
before the Writer runs. A claim expires after `CLAIM_LIFETIME_DAYS` (14) days, which frees the topic
when a run dies; `scripts/escalate-run.mjs` reports a failed step. A claim carries `origin` (and `category` or `weakness`); only a `demand` claim has a `prompt`. The ledger sits in
`audits/autowriter/<year>/<month>/<slug>.json`, named for the post and filed under the month of its claim.

## The decision file

`schema`, `decision`, `ledgerPath`, `entries` (the post first; each has `claimPath`, `claim`, `row`,
`table`, `choice`, and for a category entry `proposal`, the `{calls}` of the pick, with `row` and `table` null), `report` (path, measured date, window, property) and `refusals`; `buildRun` in
`scripts/topic-entries.mjs` builds it. The Writer reads only this file. A `strengthen` or `none` file
holds `decision`, the choice or reason, and `advisories`.

## Limits

Signal 3 creates a post only on rung 2 (`write-on-a-category.md`), with no prompt and no passage; a measured query
no prompt names stays a proposal. The machine cannot judge whether a page answers a query; the register
and the route lists decide, and a wrong owner row gives a wrong refusal. Impressions are not wins.
