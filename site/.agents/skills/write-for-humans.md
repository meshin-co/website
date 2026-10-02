# Write for Humans

Run `npm run gate:human` after any change to page prose, before you ask anyone to read the copy. It turns
`write-copy.md` into numbers: can a busy engineering leader read the page without effort, and does it read
as written by a person. `content-gate.md` is the other prose gate (banned phrases, sources, length caps).
A page needs both green.

## Run it

Build, then from `site/` run `npm run gate:human`. The runner `scripts/run-human-gate.mjs` reads every built
page except /404, /search, /styleguide and blog pagination, then prints
`human: N pages checked, M measured for reading level, K findings` and one line per finding:
`HUMAN <route> <rule>: <detail> | <excerpt>`. Exit 1 on any finding. The rules and ceilings sit in
`scripts/human-gate.mjs`; the plain-word list sits in `site/controlled-words.json`.

## What it refuses

The first four are AI tells and hold at full strength. The rest are limits set just beyond what the pages hold today.

| Rule                                      | Refused when                                                                       | Worst today |
| ----------------------------------------- | ---------------------------------------------------------------------------------- | ----------- |
| `antithesis-template`                     | a sentence says "not X, it is Y", also "isn't X, it's Y"                           | none        |
| `bolded-lead`                             | a list item opens in bold (a day, week or step label is fine)                      | none        |
| `emoji-bullet`                            | a list item opens with an emoji, tick, arrow or bullet character                   | none        |
| `controlled-word`                         | a word in `site/controlled-words.json` appears, such as commence                   | none        |
| `reading-grade`, `reading-ease`           | grade above 12.5, or ease below 36                                                 | 12.2, 37.9  |
| `sentence-average`, `sentence-longest`    | average above 21 words, or any sentence above 40                                   | 18.6, 38    |
| `long-sentences`                          | more sentences over 25 words than one in five (at least one, at most seven)        | 1/1, 6/7    |
| `long-word-share`, `passive-voice`        | over 25% words of three syllables, or over 50% passive sentences                   | 23%, 44%    |
| `sentence-variance`, `paragraph-variance` | 8+ paragraph sentences with variance under 6, or 3+ paragraphs with spread under 5 | 8.9, 5.6    |
| `list-variety`, `heading-variety`         | three lists of one length, or three headings opening on one word                   | none        |
| `no-pages`, `nothing-measured`            | no built page, or no page with three sentences of prose                            | none        |

"Worst today" is the closest graded route across 87 graded routes, built at 07b07a7 with the simple-language
level 1 copy rewrite applied. `long-sentences` reads long sentences held over its limit: 1/1 on
`/faq/what-do-nist-ai-rmf-iso-iec-42001-and-the-eu-ai-act-require` (one 38-word sentence, nothing to spare) and 6/7
on `/blog/how-to-build-an-ai-system-register-in-a-week`, the most any route holds. Every other route has a
sentence to spare. The last row is a guard: a gate that checked nothing must not read as a pass.

## Fix the prose, do not move the number

A finding names the route and quotes the sentence. Split a long sentence at its "and" or "which". Name who
acts instead of using the passive. State Y and drop the denied X. Use the shorter word the finding names.
A grade-6 ceiling would flag 78 of the 87 graded routes; that is a rewrite project, not a gate. Mark a block
`data-gate-ignore` only when you quote a source word for word, never to silence your own copy.

## What it cannot see

- A page with fewer than three sentences of prose (15 routes, 13 of them blog tag pages) is checked for tells
  and controlled words but never graded for reading level.
- The antithesis rule reads one sentence. The two-sentence form "It is not X. It is Y." passes; four such
  negation-then-"It is" pairs sit in today's copy, so widening the rule is a policy call (G16 in
  `docs/plan/reference/known-gaps.md`).
- `long-sentences` lets any page keep one long sentence, counts length not density, and counts per page, so a
  slow drift across many pages passes (G19; the numbers are in `docs/CONTENT-GATE.md`, Human gate limits).
- Passive voice is judged only as a share, so a four-sentence answer may hold two. Three policy pages (`/privacy`,
  `/ai-policy`, `/security`) hold 20 of the site's 52 passive sentences and set the 50% ceiling (G18).
- Syllables are counted by vowel groups, so grade is good to about one level. Ceilings catch drift and
  outliers, not mediocre prose; `judge-panel.md` still reads the copy.

## Prove it can fail

`npm run test:smoke` plants one page per family and needs red after green on each:
`sentence-one-word-over-the-length-ceiling`, `long-sentences-one-over-the-share-limit` and
`long-sentences-one-over-the-cap-on-a-long-page`. Write the failing test before changing a rule: limits go in
`site/scripts/human-gate-limits.test.mjs` (one step inside, one step past each), other rules in `human-gate.test.mjs`.

## Add a controlled word

A word needs a shorter twin that keeps its meaning, and it must not be a term of art in the regulations and
standards the site covers: requirement, demonstrate, obtain, sufficient and individual stay out. Never repeat
a phrase from `site/banned-phrases.json`; `human-gate.test.mjs` fails on a repeat.

## Move a ceiling

Re-measure with the gate's own code, not a fresh walk of `dist`, and set the ceiling above the worst graded route
with room to spare. The method, the floors and the numbers behind `long-sentences` are in `docs/CONTENT-GATE.md`
(Human gate limits). Put the measured numbers in the commit message and update the table above.
