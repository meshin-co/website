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

| Page family | Half A | Half B judges |
|---|---|---|
| Articles (`/blog/:entry`) | full | all six |
| Services (`/services/:entry`) | full minus article-only rows | all six |
| Resources (`/resources/:entry`) | full minus article-only rows | all six |
| Case studies (`/case-studies/:entry`) | full minus article-only rows | all six |
| Category pillars (`/blog/category/:entry`) | pillar rows | all six |
| Money pages (`/`, `/pricing`, `/approach`, `/about`, `/contact`) | page rows | all six |
| Glossary terms (`/glossary/:entry`) | term rows | answer engine, buyer, plain language |
| FAQ entries | entry rows | answer engine, plain language |
| Legal and policy (`/privacy`, `/terms`, `/imprint`, `/ai-policy`, `/security`) | page rows | procurement reviewer, plain language |
| Utility (`/search`, `/styleguide`, `/404`) | none | none |

---

## Half A — mechanical rows

Checked by script. Each row names the failure message the script prints.

### Every content page

1. Exactly one `h1`, and it contains the page's declared `targetQuery` terms.
2. The `targetQuery` appears inside the first 100 words of body text.
3. `shortAnswer` 40–60 words, self-contained: no `this article`, `this post`, `below`, `we will`,
   `in this guide`, no pronoun whose referent is only in the title.
4. `fullAnswer` (article lead) 130–170 words.
5. Every paragraph ≤ 75 words. No paragraph is a single sentence longer than 45 words.
6. Median sentence length ≤ 22 words across the page; longest sentence ≤ 45 words.
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

| # | Frame | The one question it answers |
|---|---|---|
| 1 | Answer engine | Would I quote this page as the answer, and could I attribute the claim? |
| 2 | The buyer | I run a 140-person company and I have 40 seconds. Is this for me, and what do I do next? |
| 3 | Procurement and security reviewer | Which sentence here would I make them prove, and which creates liability? |
| 4 | Competing consultant | Which parts could any agency have written, and where is the substitutable filler? |
| 5 | Search intent | Someone typed the target query. Does this beat what they would otherwise find? |
| 6 | Plain-language editor, read aloud | Where does a non-native reader stall, and which sentence sounds machine-written? |

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
