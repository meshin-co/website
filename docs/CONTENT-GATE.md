# Content Gate (CG-C)

The quality bar every content page must clear before it ships. This is the heaviest gate in the
project: harder to pass than the code gates, and it is the reason Phase 4 exists.

Two halves, both mandatory:

- **Half A — mechanical.** `site/scripts/content-gate.mjs` reads the built HTML and the source
  frontmatter and fails the build on a violation. No judgement, no waiver.
- **Half B — judged.** Six adversarial judges run in parallel per page under the `adhd` skill,
  each in its own frame, each blind to the others. A page ships only when every judge returns
  zero blockers. The loop below (step 6) requires the verdict table and findings to be written
  to `audits/phase-N/content/<route>.md`. **That step was never followed for the pages that
  shipped in Phase 4**: `audits/phase-4/content/` holds only `REPORT.md` — Half A's mechanical
  results and the Lighthouse/byte-budget scores — with no persisted per-route judge output. The
  judged loop ran (pages did not ship until every judge returned clean), but its findings are
  not retrievable evidence for any already-shipped route. Every new content page must close this
  gap in the same commit that ships it.

A page that passes Half A and fails Half B does not ship. Neither half can excuse the other.

---

## Scope

| Page family                                                                    | Half A                       | Half B judges                        |
| ------------------------------------------------------------------------------ | ---------------------------- | ------------------------------------ |
| Articles (`/blog/:entry`)                                                      | full                         | all six                              |
| Services (`/services/:entry`)                                                  | full minus article-only rows | all six                              |
| Resources (`/resources/:entry`)                                                | full minus article-only rows | all six                              |
| Case studies (`/case-studies/:entry`)                                          | full minus article-only rows | all six                              |
| Category pillars (`/blog/category/:entry`)                                     | pillar rows                  | all six                              |
| Money pages (`/`, `/pricing`, `/approach`, `/about`, `/contact`)               | page rows                    | all six                              |
| Glossary terms (`/glossary/:entry`)                                            | term rows                    | answer engine, buyer, plain language |
| FAQ entries                                                                    | entry rows                   | answer engine, plain language        |
| Legal and policy (`/privacy`, `/terms`, `/imprint`, `/ai-policy`, `/security`) | page rows                    | procurement reviewer, plain language |
| Utility (`/search`, `/styleguide`, `/404`)                                     | none                         | none                                 |

---

## Half A — mechanical rows

Checked by script. Each row names the failure message the script prints.

### Every content page

1. Exactly one `h1`, and it contains the page's declared `targetQuery` terms.
2. The `targetQuery` appears inside the first 100 words of body text.
3. `shortAnswer` 40–60 words, self-contained: no `this article`, `this post`, `below`, `we will`,
   `in this guide`, no pronoun whose referent is only in the title.
4. `fullAnswer` (article lead) 130–170 words.
5. Every paragraph ≤ 75 words, and no sentence in it longer than 40 words.
6. Median sentence length ≤ 22 words across the page; longest sentence ≤ 40 words. `npm run gate:human`
   holds the same 40 over every prose block, and also limits how many sentences run past 25 words on a page
   (`site/.agents/skills/write-for-humans.md`).
7. Zero banned phrases (`site/banned-phrases.json`): AI fingerprints, filler, hedges,
   marketing verbs.
8. No sentence longer than 12 words appears on two different routes. Boilerplate CTAs and nav are
   exempt by selector, not by phrase.
9. `cspell` clean against the project dictionary.
10. Reading level: no sentence needs a term the glossary does not define, unless the term is
    defined in the same paragraph.

### Articles additionally

11. 3–5 key takeaways.
12. At least one table or one static diagram in the body.
13. At least three sources, each with a URL; every claim about a standard or regulation cites a
    primary domain (`nist.gov`, `iso.org`, `eur-lex.europa.eu`, `owasp.org`, `europa.eu`,
    `iec.ch`).
14. 2–5 FAQ entries.
15. `updatedDate` present and rendered.
16. At least two inbound internal links from other routes, at least three outbound links.
17. At least half of the `h2` headings are questions a buyer would type.
18. OG image present in `dist`, `.md` sidecar returns 200, route present in `llms.txt`.

### Category pillars additionally

19. Pillar text ≥ 300 words, links to at least three articles in the hub.

### Honesty rows (every page, no exceptions)

20. No number that is not either computed in code, sourced to a primary domain, or listed in
    `docs/COPY-CHECKLIST.md` as owner-confirmed.
21. No client name, metric, or testimonial without an owner-confirmed row in the checklist.
22. No credential claim without its status word (`in progress`, `held since {year}`).

---

## Half B — the six judges

Each judge is a separate agent, run in parallel, given the rendered page text and nothing else —
no sibling verdicts, no author intent. Each returns `BLOCKER`, `NIT`, or `CLEAN` per finding, and
one sentence of reasoning per finding. A finding without a quoted excerpt is discarded.

| #   | Frame                             | The one question it answers                                                              |
| --- | --------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Answer engine                     | Would I quote this page as the answer, and could I attribute the claim?                  |
| 2   | The buyer                         | I run a 140-person company and I have 40 seconds. Is this for me, and what do I do next? |
| 3   | Procurement and security reviewer | Which sentence here would I make them prove, and which creates liability?                |
| 4   | Competing consultant              | Which parts could any agency have written, and where is the substitutable filler?        |
| 5   | Search intent                     | Someone typed the target query. Does this beat what they would otherwise find?           |
| 6   | Plain-language editor, read aloud | Where does a non-native reader stall, and which sentence sounds machine-written?         |

### Judge output contract

```
{ "verdict": "BLOCKER" | "NIT" | "CLEAN",
  "findings": [ { "excerpt": "...", "problem": "...", "fix": "..." } ] }
```

### Loop

1. Write or revise the page.
2. Run Half A. Fix every failure. Half A must be green before judging, so judges never spend
   their attention on mechanical faults.
3. Run all six judges in parallel.
4. Fix every `BLOCKER`. Fix `NIT`s or record a one-line reason for declining.
5. Re-run the judges that returned findings. Repeat until every judge returns `CLEAN` on blockers.
6. Write `audits/phase-N/content/<route>.md`: the judge table, every finding, what changed, and
   the round count.

### What a judge may never do

- Ask for a claim the owner has not confirmed. A judge that wants a metric gets a
  `docs/COPY-CHECKLIST.md` row, not an invented number.
- Ask for more words. Length is not a quality signal here; the mechanical rows already bound it.
- Rewrite in its own voice. Judges name problems and propose fixes; the author decides.

---

## Why both halves

The mechanical half alone is gameable: a page can hit every word range, carry three sources and a
table, and still be semantically empty. The judged half alone is unrepeatable: judgement drifts
between pages and between days. Together, Half A makes the floor unforgeable and Half B makes the
ceiling worth reaching.

---

## Human gate limits

`npm run gate:human` (`site/scripts/human-gate.mjs`; how to run it:
`site/.agents/skills/write-for-humans.md`) is the second prose gate. It holds the same 40-word
sentence ceiling as row 6, and it adds a limit on how many sentences run past 25 words.

### One sentence-length number: 40

This gate once said 45 while `gate:human` said 40, so a sentence of 41 to 45 words passed one gate
and failed the other. Both gates, `write-copy.md` and `content-gate.md` now say 40. Keeping the
lower number loses nothing: no route holds a sentence of 41 words or more in the current build
(longest 38) or in the pre-rewrite build (longest 39), so lowering this gate changed no verdict on
either. Raising `gate:human` to 45 instead would have undone a tightening it had just made.

### Long sentences per page

A page may hold one sentence over 25 words, then one more for every five sentences it has, and
never more than seven: `min(7, max(1, floor(sentences / 5)))`. The finding is `long-sentences`.

Measured through the gate's own code on the 87 graded routes of the current build, 41 of 1,691
sentences are long, on 24 routes. The most any route holds is 6
(`/blog/how-to-build-an-ai-system-register-in-a-week`), so the cap sits one sentence above the
busiest post. The three routes closest to their limit:

| Route                                                              | Long | Of  | Limit |
| ------------------------------------------------------------------ | ---- | --- | ----- |
| `/faq/what-do-nist-ai-rmf-iso-iec-42001-and-the-eu-ai-act-require` | 1    | 4   | 1     |
| `/glossary/human-in-the-loop`                                      | 2    | 17  | 3     |
| `/glossary/agentic-workflow`                                       | 2    | 19  | 3     |

`/terms` (1 of 13, limit 2) and the register post (6 of 104, limit 7) also have one sentence to
spare; every other route has more. The four-sentence answer is the one route with none: its single
long sentence has 38 words, and it is why a page may always keep one. Of 8,407 one-sentence edits
tried on the 87 routes (add, duplicate, delete, lengthen, merge or split a sentence), six trip the
rule, all on that answer.

### Why a share and a cap, and what that accepts

A count alone passes any short page and refuses only four of the 85 graded routes of the
pre-rewrite build. A share alone refuses today's four-sentence answer and lets two of the four
worst old posts through (16 in 93 sentences, 14 in 134). Together they refuse 11 of those 85
routes, which hold 105 of the 180 long sentences the old build had. The current build has 41.

The share is the tightest that keeps every real route but one a sentence to spare, and it was
fixed on the current build, not the old one: a tighter share would refuse more old routes (one in
eight, 21) but leaves real routes at their limit. One in six leaves a second route,
`/glossary/human-in-the-loop`, with none, and 33 of the 8,407 one-sentence edits would then trip the
rule instead of six.

Two failures are accepted:

- A page can always keep one long sentence, so a short answer with one 38-word sentence passes
  (one in four). The 40-word ceiling and the average still bind it.
- The cap counts length, not density. At the busiest post's 6 in 104, a post of about 140
  sentences would hold eight and be refused, though it reads no denser than the 104-sentence post
  that passes. Shorten the sentences, or raise the cap in the same change with the numbers.

The rule also counts per page, so a slow drift across many pages passes: with every graded page at
its limit the site could hold 257 long sentences. A build-wide ceiling is G19 in
`docs/plan/reference/known-gaps.md`. No count rule is set for passive sentences; G18 in the same
register has the numbers.

### Proof that the limits can fail

`npm run test:smoke` plants one page per limit and needs the gate red on it and green without it:
`sentence-one-word-over-the-length-ceiling` (one 41-word sentence),
`long-sentences-one-over-the-share-limit` (two 30-word sentences in nine, where one is allowed) and
`long-sentences-one-over-the-cap-on-a-long-page` (eight in forty, where seven is the cap). Each
catches a loosened limit: the ceiling raised to 41 or more, the cap raised to 8 or removed, the
share raised to 25%, the free sentence raised to two. `site/scripts/human-gate-limits.test.mjs`
pins one step inside and one step past each limit.

### Moving a limit

Re-measure first with the gate's own code, not a fresh walk of `dist`: a walk that finds other
routes measures something else. Take routes from `discoverRoutes` in `site/scripts/gate.mjs`, drop
/404, /search, /styleguide and the pagination patterns in `site/scripts/human-gate.mjs`, read each
page with `pageFromHtml`, and grade its `prose` with `sentenceStats` when it has three sentences.
For `long-sentences`, read `stats.longSentences` and `longSentencesAllowed(stats.sentences)` in the
same walk. Take sentence variance from `paragraphs.join(' ')` and paragraph spread from the word
count of each paragraph. Your walk must report the same pages checked and measured as
`npm run gate:human`.

Set a ceiling above the worst graded route with room to spare (today about 2% to 14%), then check
that one ordinary edit to that route, such as adding or splitting a sentence, does not cross it.
Keep the cap one sentence above the route that holds the most, and the share wide enough that every
route has a sentence to spare apart from the free one. Put the measured numbers in the commit
message and update the table in `site/.agents/skills/write-for-humans.md`.

The floors stay at 6 and 5 because two pages sit on them. Splitting the one 17-word sentence on
`/faq` (variance 8.9) into 8 and 9 words gives 6.0, and cutting the 36-word opening paragraph on
`/approach` (spread 5.6) by 3 words gives 4.9. Raise a floor only after those two pages gain
spread.
