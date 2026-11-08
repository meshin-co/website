# Order a Topic by Hand

The owner can name the topic of a run instead of letting the picker choose it. A run started by hand from the Write daily
workflow (`.github/workflows/write-daily.yml`, Run workflow) offers two optional inputs, and `npm run pick:topic` takes the same
two as flags. Give one, never both.

## Ask for one topic

- Input `prompt`, flag `--order-prompt <number>`: a buyer prompt, by its number in the Buyer prompts table of
  `docs/SEMANTIC-CORE.md`, 1 to 30. The row is found by its number, not by its place. A value that is not a positive whole number exits 2.
- Input `title`, flag `--order-title <text>`: a free-text article title. It is the title and the target query as typed, and no model
  rewrites it: `scripts/topic-format.mjs` only capitalises the first letter, restores known acronyms such as AI and adds a question
  mark to a question. A title with no word in it exits 2.
- Both together exit 2, naming both flags. With neither, the picker chooses as `pick-the-next-topic.md` says, and a scheduled run
  passes neither. The workflow passes a flag only when its input is not empty, and hands the inputs to the step through its
  environment, never through the text of its script.

## What an order gets

An order wins over every rung of `pick-the-next-topic.md` and writes one `article` with origin `ordered`: no glossary term, no
strengthen report, no proposal. `scripts/topic-walk.mjs` (`walkOrdered`) puts it through the same checks as the post arm and gives
it no exemption: a definition, `title-too-long`, `no-slug`, `register-owner`, `family-served`, `route-exists`, `title-collision`,
`slug-held` and a repeat of an article on the same subject. It adds `no-such-prompt`, for a number the report does not hold, and
`retired`. The commit message records one of:

    Choice: ordered, prompt <number>, requested by hand
    Choice: ordered, "<title>", requested by hand

An order by prompt keeps the prompt, its row in the report and its measured numbers. An order by title has no prompt, no report row
and no measured demand, and its claim carries no `prompt`.

## A refused order is terminal

The decision is `none` and its reason names the order and why it was refused. Nothing is claimed, no model is called and the run
ends. The picker never falls back to signal 2, signal 3 or the category rotation: the owner asked for one topic, and writing a
different one would be worse than writing none.

`scripts/order-guard-checks.mjs` proves this in `npm run test:smoke`. It fails a build in which a refused order ends in a write, a
strengthen report, a proposal or a category rotation, or names the topic the ladder would have written without it.
