# Write at the length of the corpus, and refuse an entry that falls short of it

## Why

The owner asked two questions about the first article the unattended writer produced: is it too
short, and can the prompt make the writer produce a publishable article more often on the first
attempt.

The article is `fractional-caio-vs-full-time-caio-cost`, on pull request #78. Measured with the
repository's own rules:

- a body of 522 words raw and 465 prose words, with headings and markup left out
- 4 `##` sections, the thinnest holding 71 words
- an empty claim-to-source table
- every content gate passed
- one model call: 10,033 input tokens, 2,543 output tokens, $0.0227

The 8 hand-written articles run from 885 to 2934 prose words. The shortest,
`how-to-build-an-ai-system-register-in-a-week`, has 885 prose words and 970 raw. Each has at least 4
sections, and none has a section under 112 words. The new article has 420 prose words fewer than the
shortest of them, and the shortest has 1.9 times its words. The answer to the first question is yes.

The cause is in the prompt and in the gates. `site/scripts/writer-prompt-text.mjs` gave a word range
to `shortAnswer`, `fullAnswer`, `shortDefinition` and `definition` (`WORD_LIMITS` in
`site/scripts/entry-limits.mjs`) and none to `body`, so the model chose the length of the body.
Nothing measured the length of a finished entry either: the sentence band measures how long a
sentence is, not how many a body holds. An entry of any length passed.

The second question has a narrower answer. `site/scripts/repair-kinds.mjs` marks 38 finding kinds
repairable, and the article prompt already states 34 of them in the gate's own words. The one
failure that no rule covered was length. The audit under Decisions goes through all 38.

**The floor is load-bearing.** The article as it stands on the pull request, copied unchanged onto a
checkout of this branch, fails the gate. Nothing was edited and the model was not called. On the
article branch, without the rule, the same gate finds nothing:

```
autowriter: 1 ledgers, 1 claims (0 lapsed), 110 generated titles, 6 CI jobs under the aggregate check, 1 pipeline commits judged, 1 generation records, 0 findings
```

With the rule it prints this and exits 1:

```
AUTOWRITER body-too-short site/src/data/post/fractional-caio-vs-full-time-caio-cost.md: the body has 465 words; no hand-written article has fewer than 885, and the middle half of them run 1234 to 2904. Reach the length with more sections that each answer one more question a buyer asks, never with longer sentences or a restated field
AUTOWRITER section-too-thin site/src/data/post/fractional-caio-vs-full-time-caio-cost.md: 1 section under 112 words, the fewest any hand-written article section holds: "What should you agree before signing?" has 71
autowriter: 1 ledgers, 1 claims (0 lapsed), 110 generated titles, 6 CI jobs under the aggregate check, 0 pipeline commits judged, 1 generation records, 2 findings
```

`too-few-sections` stays quiet, because the article has 4 sections and the floor is 4. The second run
judges 0 pipeline commits because the copied files were not committed in that checkout; the length
rules judge the entry whether or not it was committed. Once this change is on the default branch,
`npm run gate:autowriter` fails pull request #78 for the same reason. Whether to close that pull
request or to regenerate the article is the owner's decision, and this change does not touch the
article.

## What changes

**A body is measured.** `site/scripts/entry-length.mjs` counts the prose words of an entry body by
the rule `site/scripts/entry-prose.mjs` already applies to every other measure of an entry, so
headings, fenced code, link targets and markup are not words. It also counts the `##` sections and
the words of the thinnest section. A `##` line inside a fenced block is code, and a `###` heading
stays inside the section above it.

**The measure is a committed record.** `node scripts/measure-entry-length.mjs --write`, run from
`site/`, writes `audits/entry-length.json`: per format, the number of entries, the distribution of
the three measures and the limits derived from it. Without `--write` it prints the distribution and
exits 1 when the record differs from a fresh measurement. Over the 8 hand-written articles and the
32 glossary terms, with 0 entries left out, it records:

| Format and measure             | Minimum | 25th | Median | 75th | Maximum |
| ------------------------------ | ------- | ---- | ------ | ---- | ------- |
| Article body words             | 885     | 1234 | 2290   | 2904 | 2934    |
| Article sections               | 4       | 6    | 7      | 8    | 10      |
| Article thinnest-section words | 112     | 117  | 129    | 134  | 207     |
| Term body words                | 98      | 137  | 146    | 151  | 422     |
| Term sections                  | 2       | 2    | 2      | 2    | 6       |
| Term thinnest-section words    | 21      | 66   | 68     | 73   | 74      |

The article floor is 885 words, 4 sections and 112 words in the thinnest section, and its target is
1234 to 2904 words. The term floor is 98 words, 2 sections and 21 words, and its target is 137 to
151 words.

**A draft is judged before anything is written.** `site/scripts/writer-preflight.mjs` runs the same
length rules as the gate, so `body-too-short`, `too-few-sections` and `section-too-thin` reach the
one correction round (`CORRECTION_ROUNDS` in `site/scripts/write-draft.mjs`). The correction message
answers a length problem with more sections that rest on the sources the model already cites, never
by cutting text or repeating a field. A draft still under the floor after that round writes
nothing. A tree with no record stops the run with a configuration error that names the file and the
command that writes it.

**A committed entry and the record are judged afterwards.** `npm run gate:autowriter` judges every
entry that has a generation record against the limits of its format. It also re-measures the
entries a person wrote and refuses a record that differs. An entry a person wrote never fails the
floor, because it sets the floor.

**The pipeline cannot move the record.** `site/scripts/autowriter-refusals.mjs` gains the row
`entry-length`, so every place that already refuses a pipeline write to the sentence band refuses
this file too.

**The prompt states the length once, and the shapes of prose that no block states.** One bullet
follows the `body` bullet of the output contract and states the length. Every number in it is read
from the record when the prompt is built, and the record joins `PROMPT_SOURCES` in
`site/scripts/writer-prompt.mjs`, so a generation record carries its digest. A second bullet follows
it and names three shapes of prose that no gate measures and no copied block states.

**Each guard is shown failing.** Five planted specimens, each a family in
`site/scripts/mutation-smoke.mjs`, fail on: a pipeline commit that moves the record, a generated
entry under the floor, a record whose limits were edited, a record whose corpus count moved, and a
record re-measured with a generated entry counted in it.

## Decisions

### The floor is the corpus minimum, and the target is the middle half

**Decision.** For each format the floor is the smallest value any hand-written entry of that format
holds, taken separately for three measures: prose words of the body, `##` sections, and words in
the thinnest section. The target is the middle half of the body word counts, the 25th to the 75th
percentile. The floor is the gate. The target goes into the prompt.

**Why not a percentile.** With 8 articles a percentile is one article: `quantile` in
`site/scripts/sentence-band.mjs` returns `sorted[floor(p * n / 100)]`. The sorted word counts are
885, 1174, 1234, 1490, 2290, 2872, 2904 and 2934, so the 25th percentile is the third (1234) and the
75th is the seventh (2904). Any floor above the minimum rejects an article the owner has already
published: the 15th percentile (1174) rejects 1 of the 8 and the 25th rejects 2. The 5th and the
10th percentile equal the minimum, 885, which is the highest floor that all 8 clear. The 32 terms
behave the same way: their 5th percentile is 128 words, which rejects the 98-word
`glossary/ai-operating-model`, and their 25th percentile is 137, which rejects 8 of the 32. A floor
that the owner's own entries fail is a gate nobody trusts, and a test asserts that every
hand-written entry clears the committed limits of its format.

The floor is low on purpose. It refuses an article of about half the length of the shortest the
owner wrote, 465 words against 885, and it does not ask for the middle. The prompt asks for that,
at 1234 to 2904 words. Enforcing the target would refuse 3 of the 8 articles the owner wrote, 2
under it and 1 over it.

### The measurement counts only what a person wrote, and three layers keep it there

**Decision.** The record is measured over the entries a person wrote. Every entry that has a
generation record, a file under `audits/autowriter/generations/`, is left out.

**Defence.** If generated entries counted, one short generated article would lower the floor the
next one is judged against, and the gate would measure the writer against its own output. The
sentence band already leaves them out the same way (`generatedSlugs` in
`site/scripts/measure-sentence-band.mjs`, which this change exports). Three layers keep the record
from drifting toward the pipeline's output:

1. The measurement leaves out every entry that has a generation record, and prints how many it left
   out and their slugs.
2. `npm run gate:autowriter` re-measures the corpus with the same exclusion
   (`site/scripts/autowriter-length-rules.mjs`) and refuses a committed record that differs:
   `length-record-missing`, `length-record-schema-stale`, `length-record-corpus-stale`,
   `length-record-distribution-stale` and `length-record-limits-stale`. A record re-measured with a
   short generated entry counted in it fails the corpus, distribution and limits rules. The date of
   the measurement is not compared, because a re-measure of an unchanged corpus changes only that.
3. `site/scripts/autowriter-refusals.mjs` carries the row `entry-length`. A pipeline commit that
   touches `audits/entry-length.json` is refused where it is assembled
   (`site/scripts/entry-commit.mjs`, `site/scripts/repair-scope.mjs` and
   `site/scripts/commit-to-main.mjs`) and again afterwards by the history rule of
   `npm run gate:autowriter` (`site/scripts/autowriter-refusal-rules.mjs`, finding
   `refused-path-committed`).

A person who adds, removes or shortens a hand-written entry moves the floor on purpose, in a diff
anyone can read, and the gate forces the re-measure into the same commit.

**Residual risk.** The exclusion keys on the existence of a generation record. If a person deletes
the generation record of a generated entry, that entry counts as hand-written, and a re-measure
afterwards can lower the floor. The deletion and the re-measure both show in the diff, and
`npm run gate:autowriter` judges every generation record against its entry, but no rule forbids the
deletion. This change leaves that open.

### The floor counts sections as well as words, and five other measures were rejected

**Decision.** The floor also counts the `##` sections and the words of the thinnest section,
derived like the word floor: 4 sections and 112 words for an article, 2 sections and 21 words for a
term.

**Defence.** The prompt's way to reach the length is more sections, each answering one more
question a buyer asks, so the gate counts what that route produces. A body padded with a preface or
with longer sentences gains words and no sections: a test pads two short sections with a preface
until the body clears the word floor, and the body still fails `too-few-sections` and
`section-too-thin`. The sentence band, which holds the median article sentence to 10 to 15 words,
already refuses longer sentences.

Five other measures were taken against the specimen and the hand-written corpus, and rejected:

1. The share of body sentences that restate a field sentence, by the carry measure of
   `site/scripts/repair-carry.mjs` at its 0.7 overlap. The specimen scores 17.8% and the
   hand-written maximum is 17.2%, a margin of 0.6 points that does not separate them.
2. A floor on the rows of the claim-to-source table. Hand-written entries have none, so there is
   nothing to derive a floor from. The specimen's table is empty because an article about the shape
   of a cost has no figure to bind, and a floor would push the model to invent facts to fill rows.
3. Reading level. `npm run gate:human` holds ceilings only, and plain filler reads easily, so a
   reading measure would pass the padding it would have to catch.
4. The count of FAQ items and takeaways. Both are frontmatter counts fixed by `COUNT_LIMITS` in
   `site/scripts/entry-limits.mjs` (2 to 5 and 3 to 5), not body.
5. The number of glossary concepts an article links. The hand-written articles link 0 to 10, so the
   minimum is 0 and no floor derives.

**What the pairing cannot catch.** Filler written in ordinary sentences inside correctly sized
sections. The backstops are the sentence band, the question-heading rule (`questionHeadings: 3` for
an article, in `site/scripts/content-rows.mjs`), review of the pull request, and the 12-hour
quarantine window before the watcher merges.

### The prompt gains two bullets and loses nothing

**Decision.** Two bullets follow the `body` bullet in the output contract of the system prompt. The
first states the length. It is rendered from the record, so every number is read and none is typed.
For the specimen's claim, which serves buyer prompt 2 of the 30 in `docs/SEMANTIC-CORE.md`, it
renders as:

```
- length of the body: 1234 to 2904 words, the middle half of the hand-written blog article entries recorded in audits/entry-length.json, for buyer prompt 2, "fractional CAIO vs full-time CAIO cost". A body under 885 words, under 4 sections or with a section under 112 words fails the gate: no hand-written blog article does any of the three. Reach the length with more sections, each under a ## heading that asks a question a buyer asks on the way to that prompt and rests on a route from the request, a passage of the block of that buyer prompt or a source you cite. A longer sentence leaves the sentence band, and a restated takeaway repeats a field.
```

For a term the numbers are the term's, and the section heading "names the part of the term it
covers". The request carries no source list, because the model cites its own sources. It carries the
routes, the glossary, resource and tag slugs, and the block of the buyer prompt with its passages,
which is what the bullet points to.

The second bullet names the shapes of prose that a reader sees and no gate measures, and that no
copied block states:

```
- shape of the prose, which a reader sees and no gate measures: end a paragraph on its last point, not on a sentence that says again what the paragraph said. Do not open three paragraphs in a row on the same word. Do not add a section only for balance, such as a pros-and-cons block or a look ahead.
```

**How the second bullet was chosen.** The system prompt was rendered for the specimen's claim and
searched for each of nine shapes, one by one. A shape that a copied block already states is left
out, because a rule stated twice in different words makes the model decide which one was meant.

| Shape                                                  | Where the prompt already states it                                                                                                                                                      | Result |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| An opening that restates the title or announces itself | `write-copy.md`: "No preamble, no "that depends", no restating the question" and the refused "guide preambles"; `docs/CONTENT-GATE.md`: no `this article`, `we will` or `in this guide` | stated |
| A three-part list for rhythm                           | `write-copy.md`: "not because three items were easy to generate"                                                                                                                        | stated |
| The "not X, it is Y" turn                              | `write-copy.md`: `not only X but also Y`; `write-for-humans.md`: `antithesis-template`                                                                                                  | stated |
| A paragraph that closes by summarising itself          | `write-copy.md` refuses a recap paragraph at the end of a page and the words "in conclusion" and "in summary"; nothing says it of a paragraph                                           | absent |
| A section that exists for balance                      | nothing; the length bullet says what an added section is for, and `question-headings` asks only that half the headings be questions                                                     | absent |
| The same connective opening several paragraphs         | `write-copy.md` lists words such as "moreover"; `heading-variety` covers headings only                                                                                                  | absent |
| Uniform paragraph and sentence length                  | `write-for-humans.md`: `sentence-variance` and `paragraph-variance`                                                                                                                     | stated |
| A conclusion that repeats the takeaways                | `write-copy.md`: "No recap paragraph, no key-takeaways block that repeats the body in shorter words"; the `body` bullet: "Do not repeat a field inside the body"                        | stated |
| A registered concept reworded for variety              | `write-copy.md`: "One spelling per concept, everywhere", with `evals`, `AI register`, `shadow AI` and three more registered names                                                       | stated |

The last row reads as a rule about spelling and names no synonym. It was judged stated and nothing
was added for it, because a second sentence on the same rule in other words would make the model
choose between them. Three shapes are absent, and the second bullet names those three and nothing
else. A test holds that each phrase in the table is still in its file, so a copied block that stops
stating a shape fails the test and the bullet must then name it, and that the bullet repeats none of
them.

**Size.** The system prompt for the specimen's claim was 4741 words and is 4919 words, 178 more
(3.8%), counted on whitespace: 118 for the length bullet and 60 for the shape bullet. A diff of the
two rendered system prompts is those two added lines, and the user prompt is identical.

**Nothing was removed.** Dropping `site/.agents/skills/place-a-new-text.md` and
`site/.agents/skills/add-collection-entry.md` from the copied blocks was considered and refused. The
block of `AGENTS.md` that the prompt copies tells the model to read `place-a-new-text.md`, and a
test holds every copied block word for word against its file.

**Why it stays readable.** The two bullets are the only authored text added. 3717 of the 4919 words
(75.6%) are the eight blocks copied word for word from repository files, so what the writer reads is
the repository's own rules plus two bullets. The length bullet sits where the writer already reads
what the body is, states each number once and repeats no sentence of a copied block. The shape
bullet names only what the table shows absent. The first draft of the length bullet said the article
wins the buyer prompt by answering it and carried a preface sentence; both were cut.

### The audit of the 38 repairable kinds

**Method.** `listRows()` in `site/scripts/repair-kinds.mjs` holds 83 rows, and 38 are repairable: 21
of `gate:content`, 15 of `gate:human` and 2 of `gate:editorial`. Each was checked against the
system prompt rendered for an article claim and for a term claim.

**Group 1, already stated in the gate's own words.** The article prompt states 34 of the 36 kinds of
`gate:content` and `gate:human`. The term prompt states 31, because takeaways, table-or-figure and
question-headings are rows for articles only.

- 11 `gate:content` kinds are rows of `docs/CONTENT-GATE.md`, copied word for word: h1-count,
  h1-query, query-opening, paragraph-words, sentence-length, median-sentence, banned-phrase,
  unsourced-number, takeaways, table-or-figure and question-headings.
- 7 `gate:content` kinds are in the "What the gates refuse" list of
  `site/.agents/skills/write-copy.md`, copied whole: formulaic-transition, not-only-but-also,
  guide-preamble, hollow-credential, semicolon-density, em-dash-density and
  rhetorical-question-run.
- duplicate-sentence is a row of `docs/CONTENT-GATE.md` and is in the sentence band block.
- All 15 `gate:human` kinds are in the table of `site/.agents/skills/write-for-humans.md` with their
  ceilings, copied whole: reading-grade, reading-ease, sentence-average, sentence-longest,
  long-sentences, long-word-share, passive-voice, sentence-variance, paragraph-variance,
  list-variety, heading-variety, antithesis-template, bolded-lead, emoji-bullet and
  controlled-word, whose word list the prompt also prints.

Stated is not the same as judged before the write. Preflight renders the draft as a page and runs
the content gate and the human gate on it, except `inbound-links`, which belongs to the site chrome,
and four human kinds that need the whole built page: sentence-variance, paragraph-variance,
list-variety and heading-variety. The prompt states those four, and only the gate and the repair
loop judge them.

**Group 2, now prevented by this change.** The three length kinds, `body-too-short`,
`too-few-sections` and `section-too-thin`. Before this change no row of the repair table, no
sentence of the prompt and no gate named any of them. The prompt now states them, preflight judges
them and `npm run gate:autowriter` judges them again. They are not rows of the repair table:
`npm run gate:autowriter` runs in the `types-and-units` job, and the watcher treats only
`cheap-gates` and `build` as content gates (`CONTENT_OWNED_JOBS` in `site/scripts/pr-checks.mjs`). A
length failure on a pull request is escalated and not rewritten.

**Group 3, left to the repair loop, with the reason for each.** Four kinds stay out of the prompt on
purpose and stay repairable rows:

- title-stem: the title comes from the claim the pipeline chose, and the model has no title field to
  get wrong.
- published-against-a-decision: locked row L57 forbids one word on every built page, the location
  line the owner decided not to publish. A request that named it would put a deliberately
  unpublished fact in front of the model, and no article on AI governance has a reason to write it.
- unreviewed-copy and stale-disposition, both `gate:editorial`: they judge dispositions, which the
  pipeline restates itself. The model never writes one.

**The brief's other six failures.** The owner's brief named six more ways a first draft fails:

- A claim with no source: stated by the `sources` and `claims` members of the contract, and judged
  by preflight.
- A title that collides with a published title: it cannot come from the model. The claim's title is
  chosen and checked against `docs/SEMANTIC-CORE.md` before the model is called, and
  `npm run gate:autowriter` judges the claim again.
- A concept defined twice: `AGENTS.md` and `site/.agents/skills/write-copy.md` state that a concept
  is defined on exactly one page, but the register that lists them is not in the prompt. This one is
  stated and not enforced in the draft. `npm run gate:registers` judges the built site, and its 2
  rows are not repairable kinds. This change does not close that gap.
- An outbound link without its `rel` tokens: a draft cannot produce one, because the
  `rehypeExternalLinks` pass adds them to every Markdown link.
- A banned adjective: stated in full, as the banned-phrase list, the plain-word list and the rule
  against "leading", "expert" and "passionate" in the block of `AGENTS.md`.
- A sentence-band breach: stated from `audits/sentence-band.json` and judged by preflight with the
  gate's own code.

That leaves length, the one failure that no rule covered, which this change adds and states.

## Impact

**Files added.** `site/scripts/entry-length.mjs`, `site/scripts/measure-entry-length.mjs`,
`site/scripts/autowriter-length-rules.mjs`, the fixture `site/scripts/fixtures/length-corpus.mjs`,
`audits/entry-length.json`, a test beside each script and the three tests
`site/scripts/autowriter-gate-length.test.mjs`, `site/scripts/writer-prompt-length.test.mjs` and
`site/scripts/writer-prompt-shape.test.mjs`.

**Files changed.** `site/scripts/writer-preflight.mjs`, `site/scripts/writer-prompt-text.mjs`,
`site/scripts/writer-prompt.mjs`, `site/scripts/writer-prompt-read.mjs`,
`site/scripts/autowriter-gate.mjs`, `site/scripts/autowriter-refusals.mjs` and
`site/scripts/engine-anchors.mjs`. `site/scripts/sentence-band.mjs` and
`site/scripts/measure-sentence-band.mjs` export what they already held (`FORMATS`, `byFormat`,
`formatOf`, `quantile` and `generatedSlugs`) and change nothing else. The mutation smoke manifest
(`site/scripts/mutation-smoke.mjs`), the planted specimens
(`site/scripts/autowriter-record-specimens.mjs` and
`site/scripts/autowriter-history-specimens.mjs`) and the tests of the refusal list carry the five
new families. The fixtures that build a test repository (`site/scripts/fixtures/writer-repo.mjs`
and `site/scripts/fixtures/record-rules-scene.mjs`) carry the record. `site/scripts/README.md`
carries a row for each new script. The skills for the writer, its guard and the engine name the
record and the command that re-measures it, and the skill for the repair loop lists the record among
the paths automation may never write.

**Records.** `audits/entry-length.json` is new. `audits/sentence-band.json` is unchanged. The
generation record of the next run lists the length record, with its digest, among the files its
prompt was built from.

**Gates.** `npm run gate:autowriter` already runs in the `types-and-units` job of
`.github/workflows/ci.yml`, so no workflow changes, and it gains the length findings.
`npm run test:smoke` gains five families. `npm run gate:engine` lists the record among the anchors a
second site must hold. The change touches `site/scripts`, which `npm run gate:spec` counts as
built-byte surface, so it carries the Calibration Gate task group although no page changes.

**Who re-measures, and when.** A person who adds, removes, lengthens or shortens a hand-written
article or glossary term so that a number in the record moves runs
`node scripts/measure-entry-length.mjs --write` from `site/` and commits the record with the entry.
`npm run gate:autowriter` fails otherwise, with `length-record-corpus-stale`,
`length-record-distribution-stale` or `length-record-limits-stale`. An edit that leaves every
recorded number as it was needs no re-measure. The pipeline never re-measures, because the path is
refused. A second site that copies the engine measures its own corpus before its first run, and the
measurement refuses a format with no hand-written entry.

**The open pull request.** The article on pull request #78 has 465 prose words, 4 sections and a
thinnest section of 71 words. It is under the word floor of 885, its thinnest section is under the
floor of 112 words, and it meets the floor of 4 sections. Once this change is on `main`,
`npm run gate:autowriter` on that pull request fails it with `body-too-short` and
`section-too-thin`. That is an intended effect. The failing job is `types-and-units`, which the
watcher does not treat as a content gate, so it escalates and does not rewrite. Whether to close the
pull request or to write the article again under the new floor is for the owner to decide. This
change does neither.

## Risks and limits

- **First-attempt success is not measured here.** The owner asked that a publishable article come
  out more often on the first attempt. This change states the length, says how to reach it and
  refuses a short draft before it is written. No model was called while it was built, so nothing
  here shows that the first draft is now longer. The generation record of the next run shows it: one
  call means the first draft passed preflight, and two calls mean it did not.
- **The shape bullet is advice, not a gate.** Nothing measures, in a draft, a paragraph that ends by
  saying again what it said, an opening word repeated down the page or a section added for balance.
  The tests hold that the bullet is in the prompt, follows the length bullet and repeats no copied
  rule. A reader of the pull request and the quarantine window are what catch the shapes themselves.
- **Only the floor is enforced.** The prompt asks for 1234 to 2904 words and the gate refuses an
  article under 885, so a body of 900 words in 4 sections of at least 112 words passes. The target
  is a request and not a rule, because enforcing it would refuse 3 of the 8 articles the owner wrote.
- **The floors rest on few entries.** The 885-word floor comes from one article,
  `how-to-build-an-ai-system-register-in-a-week`, and the 112-word section floor from another,
  `adoption-telemetry-measuring-if-ai-is-actually-used`. The 4-section floor comes from two. Both
  term floors, 98 words and 21 words in the thinnest section, come from one term,
  `glossary/ai-operating-model`. When the owner lengthens one of these entries the floor rises, and
  the gate asks for the re-measure.
- **Padding in ordinary sentences passes.** The pairing counts sections, not substance. Filler
  written as plain sentences inside correctly sized sections clears the floor. The backstops are
  named under Decisions.
- **A deleted generation record is not forbidden.** It shows in the diff and forces a re-measure,
  but no rule refuses it.
- **A concept defined twice is not checked before the write.** It is stated to the model and judged
  by `npm run gate:registers` on the built site. No check runs on the draft.
- **The floor binds a repair too.** `site/scripts/repair-rewrite.mjs` runs the same preflight, so a
  repair that cannot meet a reading ceiling without going under the floor ends as `unrepairable` and
  escalates.
- **A length failure on a pull request is escalated, not repaired.** The three length kinds are not
  rows of the repair table. A floor that rises after a pull request opened, or an article written
  before this change, is for a person to decide.
- **A short draft can cost a run.** A draft still under the floor after the one correction round
  writes nothing, and the run has spent two model calls (`CORRECTION_ROUNDS` is 1). This change does
  not measure how often that happens.
- **A longer body costs more output tokens.** This change does not estimate by how much. The call is
  capped at 32,000 output tokens (`MAX_OUTPUT_TOKENS` in `site/scripts/writer-prompt.mjs`) and the
  month at $25 (`monthlySpendCeilingUsd` in `site/engine.config.json`).
- **Nothing else moves.** The content gate, the human gate, the sentence band and the repair table
  (`site/scripts/repair-kinds.mjs`) stay as they were. Topic selection, the claim, the watcher, the
  quarantine window, the attempt cap and every page under `site/src` are untouched.
