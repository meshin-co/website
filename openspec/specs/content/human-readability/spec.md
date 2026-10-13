# content/human-readability Specification

## Purpose

Human readability governs how easy the prose on each built page is to read and whether it shows the tells of machine-written text. `npm run gate:human` runs `site/scripts/human-gate.mjs` over the built `dist` tree, prints a summary line and one `HUMAN` line per finding, and exits 1 while any finding remains.

## Requirements

### Requirement: The human gate judges the main text of every built page except the utility and pagination routes

`npm run gate:human` SHALL check every page that `site/scripts/human-gate.mjs` finds in `dist`, except /404, /search, /styleguide and the numbered /blog, category and tag pagination pages. It MUST judge only the main content, after cutting header, footer, nav, script, style and data-gate-ignore blocks. It prints `human: N pages checked, M measured for reading level, K findings`, then one line per finding, and exits 1 while any finding remains.

#### Scenario: A tell inside the main content of a gated page

- **WHEN** the built /about page holds the sentence "It is not a plan, it is a way of living." inside its main element
- **THEN** `npm run gate:human` prints `HUMAN /about antithesis-template: not X, it is Y | not a plan, it is` and exits 1

#### Scenario: The same tell outside the judged text

- **WHEN** that sentence appears only on /404, /search, /styleguide or /blog/page/2, or only inside a header, footer, nav or data-gate-ignore block
- **THEN** `npm run gate:human` reports no finding for it

### Requirement: The human gate fails when it checked no page or graded none

`npm run gate:human` MUST NOT pass when the build gave it nothing to judge. With no built page it SHALL report `no-pages`, and when no checked page has at least 3 sentences of prose it SHALL report `nothing-measured`, both against the directory it was given. `site/scripts/run-human-gate.test.mjs` pins both findings.

#### Scenario: A build directory with no pages

- **WHEN** `npm run gate:human` runs while `dist` holds no HTML page
- **THEN** it prints `HUMAN dist no-pages: no built page was found, so nothing was checked` and exits 1

#### Scenario: No page has enough prose to grade

- **WHEN** every gated page in `dist` has fewer than 3 sentences of prose
- **THEN** it prints `HUMAN dist nothing-measured: no page had 3 sentences of prose, so reading level was never graded` and exits 1

### Requirement: Reading level is graded only on sentence prose, and only on a page with three sentences of it

`site/scripts/human-gate.mjs` SHALL treat as prose only the text of p, li, td and dd elements that ends in sentence punctuation, so a heading or an unpunctuated label never counts. A page with fewer than 3 sentences of prose MUST NOT be graded for reading level, sentence length or passive voice, but every other rule still applies to it. `site/scripts/run-human-gate.test.mjs` pins the extraction.

#### Scenario: A short page is not graded, but its tell is still refused

- **WHEN** a gated page's only prose is "We commence the work on Monday."
- **THEN** `npm run gate:human` prints `HUMAN /about controlled-word: commence → start`, raises no reading-level finding for that page, and exits 1

### Requirement: Prose stays inside the reading-grade, reading-ease and long-word limits

On a page with at least 3 sentences of prose, `npm run gate:human` SHALL refuse a Flesch-Kincaid grade above 12.5 (`reading-grade`), a Flesch reading ease below 36 (`reading-ease`) and a share of words with 3 or more syllables above 25% (`long-word-share`). `site/scripts/human-gate.mjs` counts syllables as vowel groups with a silent-e discount, and `site/scripts/human-gate-limits.test.mjs` pins one step inside and one step past each limit.

#### Scenario: Grade one step past the ceiling

- **WHEN** a gated page's prose grades at 12.6
- **THEN** `npm run gate:human` prints `HUMAN /about reading-grade: 12.6 > 12.5` and exits 1

#### Scenario: Reading ease under the floor

- **WHEN** a gated page's prose scores 34.9 for reading ease
- **THEN** it prints `HUMAN /about reading-ease: 34.9 < 36` and exits 1

#### Scenario: Too many long words

- **WHEN** 25.8% of a gated page's prose words have 3 or more syllables
- **THEN** it prints `HUMAN /about long-word-share: 25.8% > 25%` and exits 1

### Requirement: No sentence runs past 40 words, and the average stays at 21 words or fewer

On a page with at least 3 sentences of prose, `npm run gate:human` SHALL refuse a sentence longer than 40 words (`sentence-longest`, quoting the start of that sentence) and an average sentence length above 21 words (`sentence-average`). `npm run test:smoke` plants a page with one 41-word sentence and needs the gate red on it and green without it, and `site/scripts/human-gate-limits.test.mjs` pins both limits.

#### Scenario: One sentence of 41 words

- **WHEN** a gated page holds one 41-word sentence among shorter ones
- **THEN** `npm run gate:human` prints a line starting `HUMAN /about sentence-longest: 41 > 40 |` followed by the first 100 characters of that sentence, and exits 1

#### Scenario: An average just over 21 words

- **WHEN** a gated page's prose is five sentences of 21, 21, 21, 21 and 22 words
- **THEN** it prints `HUMAN /about sentence-average: 21.2 > 21` and exits 1

### Requirement: A page holds only a few sentences over 25 words

On a page with at least 3 sentences of prose, `npm run gate:human` SHALL allow min(7, max(1, floor(sentences / 5))) sentences longer than 25 words and refuse a page that holds more (`long-sentences`). `site/scripts/human-gate-limits.test.mjs` pins the formula for every count from 1 to 2,000 sentences, and `npm run test:smoke` plants one page over the share and one page over the cap.

#### Scenario: Two long sentences in nine

- **WHEN** a gated page has 9 sentences and 2 of them run past 25 words
- **THEN** `npm run gate:human` prints a line starting `HUMAN /about long-sentences: 2 of 9 sentences over 25 words, limit 1 |` and exits 1

#### Scenario: Eight long sentences in forty

- **WHEN** a gated page has 40 sentences and 8 of them run past 25 words
- **THEN** it prints a line starting `HUMAN /about long-sentences: 8 of 40 sentences over 25 words, limit 7 |` and exits 1

### Requirement: At most half of a page's sentences are passive

On a page with at least 3 sentences of prose, `npm run gate:human` SHALL refuse a page where more than 50% of the sentences are passive (`passive-voice`). A sentence is passive when a form of "be", optionally followed by adverbs, comes before a word of at least 4 characters ending in -ed or a listed irregular participle such as "written" or "built"; "is open" or "is red" MUST NOT count. `site/scripts/human-gate.test.mjs` pins both cases.

#### Scenario: Three passive sentences in five

- **WHEN** 3 of a gated page's 5 sentences read like "The plan was written by the team."
- **THEN** `npm run gate:human` prints `HUMAN /about passive-voice: 60% passive > 50%` and exits 1

### Requirement: Paragraph sentences and paragraph lengths vary

`npm run gate:human` SHALL refuse a page whose paragraph sentences, when there are at least 8, have a length variance below 6 (`sentence-variance`), and a page whose paragraphs, when there are at least 3, have a word-count standard deviation below 5 (`paragraph-variance`). Both rules read only p elements, so a run of parallel list items never sets the rhythm. `site/scripts/human-gate-limits.test.mjs` pins both floors.

#### Scenario: Paragraph sentences of near-equal length

- **WHEN** a gated page's paragraphs hold 8 sentences of 2, 2, 2, 5, 6, 6, 8 and 8 words
- **THEN** `npm run gate:human` prints `HUMAN /about sentence-variance: 5.9 < 6` and exits 1

#### Scenario: Paragraphs of near-equal length

- **WHEN** a gated page has three paragraphs of 4, 10 and 16 words
- **THEN** it prints `HUMAN /about paragraph-variance: 4.9 < 5` and exits 1

### Requirement: Lists and sub-headings do not repeat one shape

`npm run gate:human` SHALL refuse a page with 3 or more lists that all hold the same number of items (`list-variety`), and a page with 3 or more h2, h3 or h4 headings that all open on the same word (`heading-variety`). `site/scripts/human-gate.test.mjs` pins both rules.

#### Scenario: Three lists of three items

- **WHEN** a gated page carries three lists of three items each
- **THEN** `npm run gate:human` prints `HUMAN /about list-variety: 3 lists, one length` and exits 1

#### Scenario: Three headings that open on the same word

- **WHEN** a gated page's sub-headings read "How to start", "How to keep going" and "How to stop"
- **THEN** it prints `HUMAN /about heading-variety: 3 headings open on how` and exits 1

### Requirement: Prose never uses the not-X-it-is-Y antithesis

`npm run gate:human` SHALL refuse a page whose main text holds a negation followed, within 80 characters and before any sentence end, by a comma, semicolon, colon, dash or spaced hyphen and then "it is" or "it's" (`antithesis-template`). A second negation right after that "it is" MUST NOT trip the rule. `site/scripts/human-gate.test.mjs` pins six spellings that fail and seven ordinary negations that pass.

#### Scenario: The antithesis joined by a dash

- **WHEN** a gated page says "It is not a plan — it is a way of living."
- **THEN** `npm run gate:human` prints `HUMAN /about antithesis-template: not X, it is Y | not a plan — it is` and exits 1

#### Scenario: An ordinary negation passes

- **WHEN** a gated page says "It is not a plan, it is not a policy, and it is not finished."
- **THEN** the gate raises no `antithesis-template` finding for it

### Requirement: List items never open in bold or with a symbol

`npm run gate:human` SHALL refuse a list item that opens with a bold element (`bolded-lead`), unless the bold label holds only weekdays, numbered days, weeks, months, quarters, steps, phases or stages, or plain or ordinal numbers. It SHALL also refuse a list item that opens with a symbol character, such as an emoji, a bullet or an arrow (`emoji-bullet`). Both rules read the built markup, including an item that wraps its text in a p. `site/scripts/human-gate.test.mjs` pins both rules.

#### Scenario: A bolded lead

- **WHEN** a gated page has the list item `<li><strong>Governance:</strong> the owner signs it off.</li>`
- **THEN** `npm run gate:human` prints `HUMAN /about bolded-lead: list item opens in bold | Governance` and exits 1

#### Scenario: A schedule label in bold passes

- **WHEN** a list item opens with `<strong>Week 2</strong>` or `<strong>Monday.</strong>`
- **THEN** the gate raises no `bolded-lead` finding for it

#### Scenario: An emoji bullet

- **WHEN** a gated page has a list item that reads "✅ Done and signed off."
- **THEN** `npm run gate:human` prints `HUMAN /about emoji-bullet: list item opens with a symbol | ✅ Done and signed off.` and exits 1

### Requirement: A page never uses a controlled word, and each finding names the shorter twin

`npm run gate:human` SHALL refuse any word or phrase listed in `site/controlled-words.json` anywhere in a gated page's main text, matched without regard to case and only between non-letters, on every gated page whatever its length (`controlled-word`). The finding MUST name the shorter twin. `npm run test:smoke` plants a page that says "commence" and needs the gate red on it and green without it.

#### Scenario: A controlled word on a page

- **WHEN** a gated page says "We commence the work on Monday."
- **THEN** `npm run gate:human` prints `HUMAN /about controlled-word: commence → start` and exits 1

### Requirement: Every controlled word names a shorter twin and never repeats a banned phrase

`site/controlled-words.json` SHALL hold at least 10 entries, each mapping a word or phrase to a non-empty replacement shorter than itself, and it MUST NOT list a phrase that `site/banned-phrases.json` already refuses. `site/scripts/human-gate.test.mjs` fails on either defect, and `npm run test` runs it.

#### Scenario: A twin that is not shorter

- **WHEN** an entry maps "assist" to "give assistance"
- **THEN** `npm run test` fails with "assist must name a shorter twin"

#### Scenario: A phrase on both lists

- **WHEN** a phrase in `site/controlled-words.json` is also in `site/banned-phrases.json`
- **THEN** `npm run test` fails the test "the controlled list never repeats a phrase the banned list already refuses"
