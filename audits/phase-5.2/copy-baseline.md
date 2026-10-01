# Copy baseline: where the text stands against simple-language level 1

Generated-from: feb4f08 (the committed tree, measured on a private build of it; dist fingerprint bb7e9379642e)

This measures the shipped text of all 105 built routes. 102 are gated by `gate:human`; `/404`, `/search`, `/styleguide` are utility pages the gate skips. It changes no copy. Every number comes from the build output and from the commands in the Reproduction section. Nothing is estimated and nothing was typed by hand.

## What the numbers say

- The 102 gated routes hold 30939 words (24974 in prose) and 1570 sentences, of which 1532 are distinct. Sentences repeat across routes, so every count below says whether it is raw or distinct.
- 85 routes have three or more prose sentences and get a reading grade. Median Flesch reading ease is 58.6 and median grade is 9.1. 39 of 85 routes reach ease 60 or more.
- 327 of 1570 sentences (21%) break at least one rule in the flag list below; 322 of 1532 distinct sentences (21%) do.
- The dominant failure is "sentences over 25 words": 182 raw sentences on 57 routes. The next two are "passive voice with no actor" (129) and "abstraction ladder" (13).
- The AI tells the human gate detects total 0 instances across the gated routes, and the gate prints `human: 102 pages checked, 85 measured for reading level, 0 findings`. The machine patterns are already gone. The problem is plain-language density.
- 14 routes have no flagged sentence at all. 6 of them also carry the whole target query in title, description and H1.
- 69% of distinct sentences carry at least one load class (number, scope, quantifier, condition, cause, uncertainty, modal, standard), so that test alone does not tell a safe edit from a risky one. Sharper cuts: 451 distinct sentences carry two or more classes (143 flagged), and 93 name a standard, on 44 routes (26 flagged). The flag list is not a safe edit list; section 5 names the sentences.

## Method and limits

Text is the gate body of each built page, extracted the way `gate:human` does it (`pageFromHtml` and `sentenceStats` in `human-gate.mjs`). Header, footer, navigation and regions marked `data-gate-ignore` are outside it. Words, Flesch ease, grade, mean and longest sentence and passive share are the gate's own functions. A grade needs three prose sentences; the gate's own count of measured pages is the cross-check.

A sentence is flagged when it meets at least one of these rules:

- it has more than 25 words (the simple-language skill says "about 25" and aims at 15 to 20);
- it is passive and names no actor (the gate's passive pattern, no "by");
- it holds two or more different hedge words;
- it uses a throat-clearing phrase;
- it uses a noun for a verb ("the implementation of", "perform an assessment");
- it uses a word from the abstraction list (16 patterns, among them stakeholder, mechanism, approach, solution, paradigm, architecture and ecosystem);
- it uses a core word from the plain-word swap table (bucket A);
- it restates one of the three sentences before it.

Bucket B of the swap table holds real technical terms (require, just, documentation, aggregate, mitigate, perform and others). They have their own column and never flag a sentence.

Limits:

- These are pattern detectors. I did not measure their precision or recall on a labelled sample. Read the flag counts as a work list to review, not as a verdict on each sentence.
- A head check counts the stemmed content words of the target query found in the title, description or H1. A good paraphrase scores below 1. Read every miss before acting on it.
- The gate reports each AI tell once per page. The tell columns here count every instance. The gate also misses the two-sentence antithesis ("It is not X. It is Y."); that form is counted apart.
- The composite ranking, the flag list and the lexicon are my choices. The gate-derived columns are not.

## Reproduction

The working tree carries uncommitted edits from other work, so I measured a build of the exact commit, not the live dist directory:

```
git archive HEAD | tar -x -C /tmp/copy-baseline/build
cp -cR site/node_modules /tmp/copy-baseline/build/site/node_modules
cd /tmp/copy-baseline/build/site && npx astro build
cd /tmp/copy-baseline/build/site && npm run gate:human
cd /tmp/copy-baseline/build/site && npm run gate:content
```

Observed output of the last two commands: `human: 102 pages checked, 85 measured for reading level, 0 findings` and `content: 102 pages gated`.

These per-route columns reproduce with repo code only (words here are prose words). Run the block inside the built site directory:

```
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { discoverRoutes } from './scripts/gate.mjs';
import { pageFromHtml, sentenceStats } from './scripts/human-gate.mjs';
for (const route of await discoverRoutes('dist')) {
  const file = route === '/' ? 'index.html' : route.slice(1) + '.html';
  const s = sentenceStats(pageFromHtml(route, readFileSync('dist/' + file, 'utf8')).prose);
  console.log([route, s.words, s.ease.toFixed(1), s.grade.toFixed(1), s.average.toFixed(1), s.longest, s.passiveShare].join('\t'));
}"
```

The tell columns reproduce with `humanFindings` from the same module. The swap, flag, load-class and head columns come from a one-off script set that I wrote for this task and deleted afterwards, as asked. Before any number was used, 52 tests checked it against the simple-language skill's own good and bad sentence pairs and against planted specimens. The files had these SHA-256 digests:

```
c69e11a4ba7c040b7cb6b4ac2173ecfa6f96b2a14058a7cd40a80f43b77b91fe  analysis-q.mjs
9237f43666e0659756735fd469e134f719af2ef01bd95d6d31343bfba70db3ef  analysis.mjs
9f15d30485eaf4c2215e77e604b7ec5e71794ccfb42341a2f0a687767ba04f30  detectors.mjs
10b6fe70889ab12294cda2be9136d3048a72347e6b3564abff00d91b896f6284  lexicon.mjs
b0561d84f17447be110cf40a6f31dc4f54939f8416b922afb7989c28f2d16022  measure.mjs
91ef3aed0ad27a43168a4ea856c2c3623eeecb24b9c3f1d6517bee098a05d756  measure.test.mjs
525327c939bf4aee1582e9e844ad97c9b8fd3c03a2dca4b0ce9cf258a154f4b6  ownership.mjs
1f7ced20dce4d5b5a689711a915e748dccc4767cb260557c7de0f3344a708991  pairs.mjs
c3cbba089170f10ffdb7cdcd52fd7ae66c4712f5ed77548aeedfb62c4afeed7f  sections-a.mjs
c660b281be7db694cd2684abb51330c5ea89a04a28cb51684fc55e1c154dd6ae  sections-b.mjs
d9b8f6e18815131cd06dec2997e101b39c9c2882c04c06acc0016f57e5d2aba2  util.mjs
```

Producing commands, run from the scripts directory: `node measure.mjs <site> <dist> <out.json>`, then `node render.mjs <out.json> <inventory.json> <content-facts.json> <md> <site>`. To keep these numbers as a standing ratchet, promote the script set into the repo with its tests first (slice 0 of the plan).

## 1. The 20 worst routes

Pool: gated routes with 8 or more prose sentences (56 routes). Each route gets five percentile ranks inside the pool: low Flesch ease, high mean sentence length, high share of sentences over 25 words, high share of agentless passives, and high share of flagged sentences. The composite is their mean (0 is best, 1 is worst). Ranked by ease alone, 10 of the bottom 20 are in this list. Ranked by flagged share alone, 15 are.

| # | Route | Family | Prose words | Ease | Grade | Mean | Longest | Flagged | Over 25 | Agentless | Core swaps | Composite |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `/glossary/conformity-assessment` | term | 369 | 40.0 | 12.8 | 20.5 | 33 | 28% | 5 | 2 | 0 | 0.86 |
| 2 | `/glossary/iso-iec-42001` | term | 332 | 42.8 | 12.1 | 19.5 | 32 | 35% | 4 | 1 | 0 | 0.85 |
| 3 | `/glossary/llm-gateway` | term | 327 | 47.1 | 11.2 | 18.2 | 30 | 39% | 2 | 4 | 1 | 0.84 |
| 4 | `/glossary/dpia` | term | 347 | 47.8 | 10.9 | 17.4 | 30 | 30% | 4 | 4 | 0 | 0.79 |
| 5 | `/glossary/human-oversight` | term | 321 | 56.2 | 10.1 | 18.9 | 33 | 41% | 6 | 1 | 0 | 0.78 |
| 6 | `/case-studies/only-help-agentic-support` | case | 297 | 61.5 | 9.3 | 18.6 | 38 | 44% | 3 | 4 | 0 | 0.77 |
| 7 | `/glossary/guardrails` | term | 321 | 60.1 | 9.6 | 18.9 | 34 | 35% | 3 | 3 | 1 | 0.76 |
| 8 | `/glossary/model-provenance` | term | 305 | 51.6 | 10.5 | 17.9 | 29 | 29% | 1 | 4 | 0 | 0.72 |
| 9 | `/glossary/eu-ai-act` | term | 345 | 52.0 | 10.3 | 17.3 | 34 | 30% | 3 | 3 | 0 | 0.72 |
| 10 | `/glossary/post-market-monitoring` | term | 333 | 49.0 | 11.3 | 19.6 | 32 | 18% | 3 | 1 | 0 | 0.71 |
| 11 | `/glossary/hallucination-rate` | term | 280 | 55.8 | 9.8 | 17.5 | 32 | 31% | 2 | 3 | 0 | 0.70 |
| 12 | `/glossary/ai-impact-assessment` | term | 338 | 53.9 | 10.4 | 18.8 | 28 | 28% | 3 | 1 | 0 | 0.69 |
| 13 | `/glossary/nist-ai-rmf` | term | 314 | 54.4 | 10.0 | 17.4 | 31 | 28% | 4 | 1 | 0 | 0.66 |
| 14 | `/glossary/human-in-the-loop` | term | 317 | 54.4 | 10.6 | 19.8 | 33 | 25% | 4 | 0 | 0 | 0.66 |
| 15 | `/blog/ai-acceptable-use-policy-for-a-50-person-company` | article | 1784 | 60.3 | 9.2 | 17.5 | 32 | 26% | 22 | 7 | 0 | 0.61 |
| 16 | `/privacy` | static | 251 | 64.5 | 8.2 | 15.7 | 28 | 38% | 1 | 6 | 0 | 0.61 |
| 17 | `/blog/why-your-ai-pilot-never-reached-production` | article | 1630 | 58.6 | 9.4 | 17.5 | 32 | 26% | 16 | 6 | 1 | 0.60 |
| 18 | `/glossary/evals` | term | 334 | 64.6 | 8.9 | 18.6 | 31 | 33% | 6 | 0 | 0 | 0.60 |
| 19 | `/glossary/serious-incident-reporting` | term | 354 | 49.5 | 10.7 | 17.7 | 32 | 20% | 2 | 1 | 0 | 0.59 |
| 20 | `/glossary/agentic-workflow` | term | 319 | 57.8 | 9.9 | 18.8 | 28 | 24% | 4 | 0 | 0 | 0.59 |

Families in the top 20: term 16, case 1, article 2, static 1. Frozen routes in the top 20 (see the plan): `/glossary/iso-iec-42001`, `/glossary/eu-ai-act`, `/glossary/nist-ai-rmf`, `/privacy`.

### Family summary

| Family | Gated routes | Graded | Words | Mean ease | Mean grade | Words per sentence | Over 25 | Agentless | Core swaps | Flagged |
|---|---|---|---|---|---|---|---|---|---|---|
| static | 17 | 15 | 3683 | 66.8 | 7.2 | 12.3 | 8 | 29 | 4 | 19% |
| article | 4 | 4 | 7913 | 61.2 | 8.9 | 16.8 | 72 | 21 | 4 | 23% |
| category | 4 | 4 | 1508 | 62.8 | 8.3 | 15.2 | 5 | 7 | 1 | 16% |
| tag | 12 | 0 | 152 | - | - | 7.3 | 0 | 0 | 0 | 8% |
| tag-index | 1 | 0 | 69 | - | - | 13.0 | 0 | 0 | 0 | 0% |
| case | 1 | 1 | 381 | 61.5 | 9.3 | 18.6 | 3 | 4 | 0 | 44% |
| faq | 25 | 23 | 2011 | 63.7 | 8.4 | 16.2 | 13 | 8 | 0 | 22% |
| term | 30 | 30 | 11099 | 52.1 | 10.3 | 17.3 | 69 | 43 | 6 | 21% |
| resource | 5 | 5 | 2387 | 63.2 | 8.0 | 14.2 | 6 | 9 | 2 | 18% |
| service | 3 | 3 | 1736 | 64.6 | 7.7 | 13.8 | 6 | 8 | 1 | 23% |

### Spread of reading ease (85 graded routes)

Minimum 37.5, median 58.6, maximum 84.2. Grade runs from 4.5 to 12.8.

| Flesch ease band | Routes |
|---|---|
| under 30 (very difficult) | 0 |
| 30 to 49 (difficult) | 14 |
| 50 to 59 (fairly difficult) | 32 |
| 60 to 69 (plain) | 25 |
| 70 to 79 (fairly easy) | 12 |
| 80 and up (easy) | 2 |

## 2. The dominant failure

Counts are over the 102 gated routes. "Raw" counts a sentence each time it appears, "distinct" counts it once, "routes" counts routes with at least one. A sentence can sit in several rows, so the rows do not add up to the flagged total (327 raw, 322 distinct). Passive voice of any kind, with or without an actor: 146 raw, 141 distinct, 55 routes.

| Category | Raw | Distinct | Routes | Share of raw sentences |
|---|---|---|---|---|
| Nouns doing a verb's job | 10 | 10 | 9 | 0.6% |
| Passive voice with no actor | 129 | 124 | 52 | 8.2% |
| Stacked hedges (two or more) | 4 | 4 | 4 | 0.3% |
| Throat-clearing | 2 | 2 | 2 | 0.1% |
| Abstraction ladder | 13 | 13 | 12 | 0.8% |
| Sentences over 25 words | 182 | 182 | 57 | 11.6% |
| Core plain-word swaps (extra) | 14 | 14 | 12 | 0.9% |
| Restated within 3 sentences (extra) | 7 | 7 | 6 | 0.4% |

Top three by raw count among the six named categories: Sentences over 25 words; Passive voice with no actor; Abstraction ladder. The distinct-sentence ranking gives the same three in the same order. The other three named categories are rare: nouns doing a verb's job 10, stacked hedges (two or more) 4, throat-clearing 2.

### 1. Sentences over 25 words

182 raw sentences, 182 distinct, on 57 routes. Three examples, each the most widely repeated sentence that fails only this rule where one exists:

- "Under the Retainer, I review every entry and sign it as the named officer; final accountability for anything that reaches customers or the board still sits with your organisation, the same as for any other risk register you keep." Routes: `/faq/how-does-ai-risk-get-recorded-and-who-signs-it-off` (1 in all).
- "The code lives in your repositories from the first commit, under your licence and your review rules, and the same principle applies to your data: nothing about the engagement moves ownership of either to me or to a vendor." Routes: `/faq/who-owns-the-code-and-the-data` (1 in all).
- "Pick the one flow with volume and a measurable outcome, build an eval set from real tickets before touching the prompt, then put the eval run in CI so a regression blocks the merge rather than the customer." Routes: `/case-studies/only-help-agentic-support` (1 in all).

### 2. Passive voice with no actor

129 raw sentences, 124 distinct, on 52 routes. Three examples, each the most widely repeated sentence that fails only this rule where one exists:

- "A repository copy is not published yet." Routes: `/resources/agent-evals-ci-starter`, `/resources/ai-governance-starter-kit`, `/resources/ai-readiness-scorecard` and 2 more (5 in all).
- "Both are covered, and the obligations differ." Routes: `/faq`, `/faq/what-if-the-ai-we-are-building-goes-into-a-product-we-sell` (2 in all).
- "Every template I use in engagements is written out in full on its own page, so you can read the method before you buy it." Routes: `/` (1 in all).

### 3. Abstraction ladder

13 raw sentences, 13 distinct, on 12 routes. Three examples, each the most widely repeated sentence that fails only this rule where one exists:

- "Handover is a deliverable, not a formality, and it only counts once someone is actually watching the dashboard." Routes: `/blog/category/operating-model` (1 in all).
- "You own the deliverables and the code produced for you." Routes: `/terms` (1 in all).
- "Handover is a deliverable, not a courtesy." Routes: `/about` (1 in all).

9 of the 13 distinct sentences match only "architecture", "mechanism", "approach" or "solution". Those are often the exact word for a technical buyer, so this row is the least reliable of the six. The examples above avoid them where they can.

### Tells, rhythm and swap words

| AI tell (human gate rule) | Gate: pages | Every instance | Routes |
|---|---|---|---|
| antithesis-template | 0 | 0 | 0 |
| bolded-lead | 0 | 0 | 0 |
| emoji-bullet | 0 | 0 | 0 |
| controlled-word | 0 | 0 | 0 |
| two-sentence antithesis (the gate misses it) | - | 14 | 13 |
| sentence-variance, paragraph-variance, list-variety, heading-variety | 0 | 0 | 0 |

The two-sentence detector is loose: a "not" in one sentence and "It is" opening the next. Read each pair before acting. All 14:

- "Someone pastes a client’s contract into a personal chatbot account to move faster, not to leak it." "That is different from someone who was told a tool was blocked and used it anyway, or who hid AI involvement in work they signed off as their own." Route: `/blog/ai-acceptable-use-policy-for-a-50-person-company`.
- "An agent demo is easy and an agent in production is not, and the gap between them is almost never about the model." "It is about the same engineering discipline any other system needs, applied to a component whose output is not deterministic." Route: `/blog/category/agentic-architecture`.
- "Handover is a deliverable, not a formality, and it only counts once someone is actually watching the dashboard." "This is also why fractional works for companies of this size." Route: `/blog/category/operating-model`.
- "Ownership is not a shared inbox or a Slack channel." "It is one name attached to the outcome, with the budget and the authority to pause the system if it misbehaves." Route: `/blog/why-your-ai-pilot-never-reached-production`.
- "There is no test suite running against real examples before a change ships, so a regression surfaces first as a customer complaint or a bad downstream decision, not as a failed build." "That is the opposite of how the rest of the engineering organisation ships software." Route: `/blog/why-your-ai-pilot-never-reached-production`.
- "The Act applies to any company whose AI system is used in the EU, not only companies based there." "That is why a US-based startup with European customers cannot treat this as someone else's problem." Route: `/glossary/eu-ai-act`.
- "Privilege control and human approval for high-risk actions are guardrails, not model behaviour." "This is closer to what NIST's AI Risk Management Framework calls its Manage function: turning a risk decision into something the system enforces, not something merely written down." Route: `/glossary/guardrails`.
- "Where a system falls on that spectrum is a design decision, not a fixed property of the technology." "It is one of the first things a customer's security team or a regulator asks about, for anything that can affect a person's money, employment or legal standing." Route: `/glossary/human-in-the-loop`.
- "Because it is a certifiable standard, not a public framework, it carries more weight in a formal audit than a self-written policy." "That is why a customer’s legal team may put it on a checklist before reading what is in it." Route: `/glossary/iso-iec-42001`.
- "Passages are converted into embeddings, numerical representations of meaning, and a query is matched against them by similarity, not exact keyword." "That is what lets the system find a relevant passage even when the question shares none of the same words as the document." Route: `/glossary/retrieval-augmented-generation`.
- "The same retention duty covers the quality management system records and the EU declaration of conformity too, not the technical documentation alone." "It is different from a marketing spec sheet or an engineering wiki page." Route: `/glossary/technical-documentation`.
- "It is not a compliance certificate, and it is not legal advice." "It is the paperwork a reviewer expects to see before they look at your architecture." Route: `/resources/ai-governance-starter-kit`.
- "The risk to your customer does not care who wrote the code." "It is not a procurement process, and it will not pick the vendor for you." Route: `/resources/build-vs-buy-ai-kit`.
- "Then it does not ship, and the sprint ends with a written account of why." "That is a cheaper outcome than shipping it and finding out from a customer." Route: `/services/90-day-production-sprint`.

Rhythm is the trap for a rewrite. The gate floors are 6 for sentence-length variance (from 8 sentences up) and 5 for paragraph spread (from 3 paragraphs up). The smallest sentence variance today is 9.6 across 52 routes where it applies, and the smallest paragraph spread is 6.1 across 52. 0 routes sit within 50% of the sentence floor and 2 within 50% of the paragraph floor. A rewrite that levels every sentence to one short length spends that margin.

Plain-word swaps, core list (bucket A): 18 hits on 15 routes. All of them:

| Word | Hits | Routes |
|---|---|---|
| several | 5 | 5 |
| simply | 4 | 4 |
| excessive | 3 | 2 |
| capability | 2 | 2 |
| additional | 1 | 1 |
| attempt | 1 | 1 |
| currently | 1 | 1 |
| any idiom on the list | 1 | 1 |

Technical-term list (bucket B, never flagged): 97 hits. The most frequent: require 34, just 27, documentation 17, aggregate 4, mitigate 4, perform 4.

## 3. Semantic-core contradictions

### Title, description and H1 against the target query

102 of 102 gated routes have a target query in the content facts. "Cover" is the share of the query's content words found in a surface. Title falls short on 27 routes, description on 19, H1 on 0. 34 routes miss on at least one surface and 0 miss on all three. Stems are shown for the missing words.

| Family | Routes with a query | Title below 1 | Description below 1 | H1 below 1 | None full |
|---|---|---|---|---|---|
| static | 17 | 11 | 14 | 0 | 0 |
| article | 4 | 0 | 1 | 0 | 0 |
| category | 4 | 0 | 0 | 0 | 0 |
| tag | 12 | 0 | 0 | 0 | 0 |
| tag-index | 1 | 0 | 0 | 0 | 0 |
| case | 1 | 0 | 0 | 0 | 0 |
| faq | 25 | 15 | 2 | 0 | 0 |
| term | 30 | 1 | 1 | 0 | 0 |
| resource | 5 | 0 | 0 | 0 | 0 |
| service | 3 | 0 | 1 | 0 | 0 |

| Route | Target query | Cover (title/description/H1) | Missing from title | Missing from description | Missing from H1 |
|---|---|---|---|---|---|
| `/` | fractional chief ai officer | 1.00/0.50/1.00 | - | chief, officer | - |
| `/about` | dmitri meshin | 1.00/0.00/1.00 | - | dmitri, meshin | - |
| `/approach` | how a fractional ai officer works | 0.25/0.50/1.00 | fractional, ai, officer | fractional, officer | - |
| `/blog` | ai governance writing | 0.33/0.33/1.00 | ai, governance | governance, writ | - |
| `/blog/why-your-ai-pilot-never-reached-production` | ai pilot never reached production | 1.00/0.80/1.00 | - | never | - |
| `/case-studies` | fractional chief ai officer case study | 0.33/0.17/1.00 | fractional, chief, ai, officer | fractional, chief, ai, officer, study | - |
| `/contact` | book an ai leadership call | 0.00/0.50/1.00 | book, ai, leadership, call | ai, leadership | - |
| `/faq` | fractional chief ai officer questions | 0.20/0.80/1.00 | fractional, chief, ai, officer | question | - |
| `/faq/can-you-get-us-iso-iec-42001-certified-or-just-a-working-system` | can you get us certified to iso/iec 42001, or do you just build a working system? | 0.60/0.30/1.00 | just, build, work, system | us, certify, iso, iec, 42001, just, build | - |
| `/faq/can-you-work-with-our-existing-ai-vendor-or-platform` | can you work with our existing ai vendor or platform, or do you bring your own tools? | 0.50/1.00/1.00 | platform, bring, own, tool | - | - |
| `/faq/how-is-a-prompt-or-model-change-stopped-from-shipping-unnoticed` | how is a prompt or model change stopped from shipping unnoticed? | 0.50/1.00/1.00 | stopp, shipp, unnotic | - | - |
| `/faq/how-quickly-can-you-start-and-how-does-availability-work-for-a-remote-officer` | how quickly can you start, and how does availability work for a remote officer? | 0.67/1.00/1.00 | availability, work | - | - |
| `/faq/is-my-company-too-small-or-too-early-for-a-fractional-chief-ai-officer` | is my company too small, or too early, for a fractional chief ai officer? | 0.50/1.00/1.00 | early, chief, ai, officer | - | - |
| `/faq/what-do-nist-ai-rmf-iso-iec-42001-and-the-eu-ai-act-require` | what do nist ai rmf, iso/iec 42001 and the eu ai act each require of a company our size? | 0.67/1.00/1.00 | rmf, each, company, size | - | - |
| `/faq/what-do-we-do-about-tools-staff-are-already-using-without-approval` | what do we do about tools staff are already using without approval? | 0.60/1.00/1.00 | already, using | - | - |
| `/faq/what-does-a-fractional-chief-ai-officer-actually-do` | what does a fractional chief ai officer actually do, and how is that different from an advisor? | 0.57/1.00/1.00 | actually, different, advisor | - | - |
| `/faq/what-does-the-two-week-assessment-produce-and-is-the-fee-credited-if-we-continue` | what does the two-week assessment produce, and is the fee credited if we continue? | 0.43/1.00/1.00 | fee, credit, if, continue | - | - |
| `/faq/what-happens-if-the-evals-say-a-workflow-isnt-good-enough` | what happens if the evals say a workflow isn't good enough? | 0.63/1.00/1.00 | happen, isn't, good | - | - |
| `/faq/what-if-the-ai-we-are-building-goes-into-a-product-we-sell` | what if the ai we're building goes into a product we sell, not just an internal workflow? | 0.50/1.00/1.00 | we're, build, just, internal, workflow | - | - |
| `/faq/what-if-we-already-have-a-data-science-team-or-an-internal-ai-lead` | what if we already have a data science team or an internal ai lead? | 0.67/1.00/1.00 | internal, ai, lead | - | - |
| `/faq/whats-the-difference-between-the-assessment-the-sprint-and-the-retainer` | what's the difference between the assessment, the sprint and the retainer? | 0.50/1.00/1.00 | what', difference, between | - | - |
| `/faq/who-owns-the-frameworks-templates-and-playbooks-built-during-the-engagement` | who owns the frameworks, templates and playbooks built during the engagement? | 0.43/1.00/1.00 | template, built, dur, engagement | - | - |
| `/faq/why-hire-a-fractional-officer-instead-of-a-full-time-head-of-ai` | why hire a fractional officer instead of a full-time head of ai? | 0.71/0.29/1.00 | instead, ai | hire, fractional, instead, head, ai | - |
| `/glossary` | ai governance glossary | 1.00/0.67/1.00 | - | glossary | - |
| `/glossary/nist-ai-rmf` | nist ai rmf | 1.00/0.67/1.00 | - | rmf | - |
| `/glossary/serious-incident-reporting` | serious incident reporting | 0.67/1.00/1.00 | report | - | - |
| `/imprint` | imprint | 1.00/0.00/1.00 | - | imprint | - |
| `/now` | what i am working on now | 0.33/0.33/1.00 | am, work | work, now | - |
| `/pricing` | fractional chief ai officer cost | 0.00/0.00/1.00 | fractional, chief, ai, officer, cost | fractional, chief, ai, officer, cost | - |
| `/privacy` | privacy policy | 0.50/0.00/1.00 | policy | privacy, policy | - |
| `/resources` | ai governance templates | 0.00/1.00/1.00 | ai, governance, template | - | - |
| `/security` | security practices | 0.50/0.00/1.00 | practice | security, practice | - |
| `/services` | fractional ai leadership services | 0.25/0.50/1.00 | fractional, ai, leadership | leadership, service | - |
| `/services/fractional-caio-retainer` | fractional caio retainer | 1.00/0.00/1.00 | - | fractional, caio, retainer | - |

### The 30 buyer prompts

"Cover" is the share of a prompt's content words found in the title, description, H1 and opening of a route. A route answers a prompt at 0.6. 6 of 30 prompts have no route at that level, 10 are answered only by a route other than the must-win one, and 14 are answered by their must-win route. At a bar of 0.5 the no-route count is 1; at 0.75 it is 15. The semantic core marks 15 prompts as GAP itself.

| # | Prompt | GAP in core | Must-win route | Its cover | Best route | Best cover | Verdict | Promised passages found |
|---|---|---|---|---|---|---|---|---|
| 1 | who is a fractional chief AI officer for a 100-person SaaS company | no | `/` | 0.71 | `/` | 0.71 | must-win route answers | 1 of 1 |
| 2 | fractional CAIO vs full-time CAIO cost | yes | `/faq/why-hire-a-fractional-officer-instead-of-a-full-time-head-of-ai` | 0.50 | `/services/fractional-caio-retainer` | 0.75 | answered elsewhere only | 1 of 1 |
| 3 | AI readiness assessment template for SMB | no | `/resources/ai-readiness-scorecard` | 0.40 | `/faq/what-does-the-two-week-assessment-produce-and-is-the-fee-credited-if-we-continue` | 0.60 | answered elsewhere only | 1 of 1 |
| 4 | AI governance consultant ISO 42001 small company | yes | `/services/ai-readiness-and-risk-assessment` | 0.29 | `/blog/category/governance` | 0.71 | answered elsewhere only | 1 of 1 |
| 5 | named person responsible for AI risk in vendor procurement | no | `/faq/who-answers-customer-security-questionnaires` | 0.43 | `/glossary/ai-register` | 0.71 | answered elsewhere only | 1 of 1 |
| 6 | how to build an AI system register | no | `/blog/how-to-build-an-ai-system-register-in-a-week` | 1.00 | `/blog/how-to-build-an-ai-system-register-in-a-week` | 1.00 | must-win route answers | 1 of 1 |
| 7 | AI acceptable use policy template | no | `/blog/ai-acceptable-use-policy-for-a-50-person-company` | 1.00 | `/blog/ai-acceptable-use-policy-for-a-50-person-company` | 1.00 | must-win route answers | 1 of 1 |
| 8 | EU AI Act obligations for deployers small business | yes | `/glossary/eu-ai-act` | 0.57 | `/faq/what-if-the-ai-we-are-building-goes-into-a-product-we-sell` | 0.86 | answered elsewhere only | 1 of 1 |
| 9 | why do AI pilots fail to reach production | no | `/blog/why-your-ai-pilot-never-reached-production` | 0.80 | `/blog/why-your-ai-pilot-never-reached-production` | 0.80 | must-win route answers | 1 of 1 |
| 10 | LLM gateway for governance and audit | yes | `/glossary/llm-gateway` | 0.75 | `/glossary/llm-gateway` | 0.75 | must-win route answers | 1 of 1 |
| 11 | how to put evals for AI agents into CI | no | `/blog/evals-in-ci-for-llm-agents` | 0.80 | `/blog/evals-in-ci-for-llm-agents` | 0.80 | must-win route answers | 1 of 1 |
| 12 | AI vendor assessment questionnaire template | yes | `/resources/ai-governance-starter-kit` | 0.60 | `/resources` | 0.80 | must-win route answers | 1 of 1 |
| 13 | build vs buy AI 3-year TCO | yes | `/resources/build-vs-buy-ai-kit` | 0.60 | `/blog/how-to-build-an-ai-system-register-in-a-week` | 0.60 | must-win route answers | 1 of 1 |
| 14 | AI operating model for mid-size company | yes | `/approach` | 0.40 | `/blog/category/executive` | 0.60 | answered elsewhere only | 1 of 1 |
| 15 | how to hand over AI leadership to internal team | yes | `/faq/how-does-the-retainer-end` | 0.17 | `/` | 0.50 | no route answers | 1 of 1 |
| 16 | fractional AI officer Israel | yes | `/about` | 0.75 | `/` | 0.75 | must-win route answers | 1 of 1 |
| 17 | fractional AI leader Europe remote | yes | `/about` | 0.60 | `/about` | 0.60 | must-win route answers | 1 of 1 |
| 18 | agentic automation consultant for B2B | no | `/services/90-day-production-sprint` | 0.25 | `/` | 0.25 | no route answers | 1 of 1 |
| 19 | MCP security best practices | yes | - | - | `/security` | 0.50 | no route answers | 0 of 0 |
| 20 | multi-agent reference architecture production | yes | `/approach` | 0.25 | `/blog/category/agentic-architecture` | 0.50 | no route answers | 0 of 0 |
| 21 | adoption telemetry for AI tools | yes | - | - | `/blog/ai-acceptable-use-policy-for-a-50-person-company` | 0.50 | no route answers | 0 of 0 |
| 22 | AI incident response plan template | yes | `/glossary/serious-incident-reporting` | 0.40 | `/glossary/agentic-workflow` | 0.60 | answered elsewhere only | 1 of 1 |
| 23 | data classification for LLM usage | no | `/glossary/data-classification` | 0.50 | `/blog/category/governance` | 0.50 | no route answers | 1 of 1 |
| 24 | ISO 42001 gap assessment | yes | `/glossary/iso-iec-42001` | 0.50 | `/faq/what-does-the-two-week-assessment-produce-and-is-the-fee-credited-if-we-continue` | 1.00 | answered elsewhere only | 1 of 1 |
| 25 | NIST AI RMF for small companies | no | `/glossary/nist-ai-rmf` | 0.60 | `/faq/what-do-nist-ai-rmf-iso-iec-42001-and-the-eu-ai-act-require` | 0.80 | must-win route answers | 1 of 1 |
| 26 | fractional CAIO pricing | no | `/pricing` | 0.67 | `/faq/is-my-company-too-small-or-too-early-for-a-fractional-chief-ai-officer` | 0.67 | must-win route answers | 1 of 1 |
| 27 | what does a chief AI officer do in a 50 person company | no | `/faq/what-does-a-fractional-chief-ai-officer-actually-do` | 0.50 | `/` | 0.83 | answered elsewhere only | 1 of 1 |
| 28 | AI governance starter kit open source | no | `/resources/ai-governance-starter-kit` | 0.83 | `/resources/ai-governance-starter-kit` | 0.83 | must-win route answers | 1 of 1 |
| 29 | AI readiness scorecard five drivers | no | `/resources/ai-readiness-scorecard` | 0.80 | `/resources/ai-readiness-scorecard` | 0.80 | must-win route answers | 1 of 1 |
| 30 | board memo AI strategy one page | no | `/services/ai-readiness-and-risk-assessment` | 0.50 | `/faq/what-does-the-two-week-assessment-produce-and-is-the-fee-credited-if-we-continue` | 0.83 | answered elsewhere only | 1 of 1 |

## 4. Routes that need no work

14 of 85 graded routes have no flagged sentence, no tell instance, no core swap and no rhythm finding. 6 of those also carry the whole target query in title, description and H1. Leave those alone. 17 gated routes have under three prose sentences and get no grade; 14 of them have no flagged sentence and no core swap.

| Route | Family | Sentences | Ease | Grade | Mean | Longest | Cover (title/description/H1) | Head serves query |
|---|---|---|---|---|---|---|---|---|
| `/blog` | static | 3 | 84.2 | 4.5 | 12.0 | 16 | 0.33/0.33/1.00 | review |
| `/faq/how-is-a-prompt-or-model-change-stopped-from-shipping-unnoticed` | faq | 4 | 60.9 | 8.1 | 13.3 | 23 | 0.50/1.00/1.00 | review |
| `/faq/how-is-cost-per-outcome-measured` | faq | 5 | 72.6 | 5.9 | 11.0 | 17 | 1.00/1.00/1.00 | yes |
| `/faq/how-quickly-can-you-start-and-how-does-availability-work-for-a-remote-officer` | faq | 4 | 77.8 | 5.9 | 14.0 | 20 | 0.67/1.00/1.00 | review |
| `/faq/what-does-a-fractional-chief-ai-officer-actually-do` | faq | 4 | 49.8 | 9.7 | 13.8 | 16 | 0.57/1.00/1.00 | review |
| `/faq/what-happens-on-a-fit-call-and-does-it-cost-anything` | faq | 3 | 71.1 | 7.4 | 16.3 | 23 | 1.00/1.00/1.00 | yes |
| `/faq/what-if-we-already-have-a-data-science-team-or-an-internal-ai-lead` | faq | 4 | 58.1 | 9.4 | 17.3 | 23 | 0.67/1.00/1.00 | review |
| `/faq/what-size-of-company-do-you-actually-work-with` | faq | 4 | 56.2 | 8.6 | 12.8 | 14 | 1.00/1.00/1.00 | yes |
| `/faq/who-owns-the-frameworks-templates-and-playbooks-built-during-the-engagement` | faq | 4 | 62.8 | 8.2 | 14.8 | 19 | 0.43/1.00/1.00 | review |
| `/glossary` | static | 12 | 61.3 | 7.3 | 10.3 | 17 | 1.00/0.67/1.00 | review |
| `/glossary/prompt-injection` | term | 22 | 50.1 | 9.9 | 14.6 | 23 | 1.00/1.00/1.00 | yes |
| `/glossary/provider-vs-deployer` | term | 22 | 50.5 | 9.9 | 15.0 | 24 | 1.00/1.00/1.00 | yes |
| `/glossary/red-teaming` | term | 17 | 51.9 | 10.4 | 17.5 | 25 | 1.00/1.00/1.00 | yes |
| `/services` | static | 3 | 59.6 | 9.3 | 17.7 | 19 | 0.25/0.50/1.00 | review |

## 5. What a rewrite would break

Of the 1532 distinct sentences, 1064 (69%) carry at least one load class: a number, a scope qualifier, a quantifier, a condition, a cause, a stated uncertainty, a modal or a named standard. The classes are broad, so the narrower cuts matter: 451 carry two or more, and 264 of the 322 flagged sentences carry at least one, so a writer who works down the flag list reaches them first.

| Load class | Distinct sentences | Of which flagged |
|---|---|---|
| number | 366 | 86 |
| scope | 311 | 91 |
| quantifier | 430 | 112 |
| conditional | 251 | 84 |
| causal | 106 | 43 |
| uncertainty | 57 | 20 |
| standard | 93 | 26 |
| modal | 46 | 11 |

### Legal text

The terms, imprint, AI policy and security pages, and the privacy page beside them, are requested legal artefacts and keep their own register. A rewrite changes no sentence here without owner sign-off, and the survival diff must be empty. The sentences below carry the most load on each page; flagged ones come first.

| Route | Sentences | Carry load | Two or more classes | Flagged | Flagged and carry load |
|---|---|---|---|---|---|
| `/terms` | 13 | 11 | 3 | 2 | 1 |
| `/imprint` | 2 | 1 | 0 | 0 | 0 |
| `/privacy` | 16 | 12 | 3 | 6 | 6 |
| `/ai-policy` | 22 | 17 | 7 | 7 | 6 |
| `/security` | 20 | 15 | 6 | 7 | 7 |

**/terms**

- "The number that binds either of us is the one written into the signed statement of work for your engagement, which also fixes scope, duration and payment terms." Keeps: number, quantifier. Tempts a rewriter: over 25 words.
- "No price appears anywhere on this site, only fee shapes: a fixed fee, a fixed scope quoted once, or a monthly fee." Keeps: scope, quantifier, conditional.
- "That agreement overrides this page wherever the two differ." Keeps: number, conditional.
- "These terms are short, because the engagement contract is the document that matters and this page is not it." Keeps: causal.
- "If you act on something you read here without checking it against your own situation, that is your decision." Keeps: conditional.
- "Templates in the Resources section carry their own licence, stated on each entry, and that licence governs their use." Keeps: quantifier.
- "Nothing here is an offer capable of acceptance, and nothing here is legal, financial or compliance advice." Keeps: quantifier.
- "Each engagement runs under its own written agreement covering confidentiality, intellectual property, liability and termination." Keeps: quantifier.

**/imprint**

- "One person, and the details to prove it." Keeps: number.

**/privacy**

- "Enquiries that never become paid work are deleted twelve months after the last message." Keeps: number, scope, quantifier. Tempts a rewriter: passive, no actor.
- "You can ask what I hold about you, ask for it to be corrected, or ask for it to be deleted, and I will answer within thirty days." Keeps: number, scope. Tempts a rewriter: over 25 words, passive, no actor.
- "I keep no copy of your documents, exports, tickets or logs, and my own working notes are deleted at handover." Keeps: quantifier. Tempts a rewriter: passive, no actor.
- "Anything I have invoiced is kept for six years, for accounting." Keeps: number. Tempts a rewriter: passive, no actor.
- "There is no mailing list to be added to." Keeps: quantifier. Tempts a rewriter: passive, no actor.
- "No cookies are set and no accounts exist." Keeps: quantifier. Tempts a rewriter: passive, no actor.
- "If you email hello@meshin.co or book a call, I keep that thread and the booking so I can answer and account for the work." Keeps: conditional, causal.
- "Page views are counted by Plausible, which is cookieless and stores no personal data: a page path, a referrer, a country, and a device type." Keeps: quantifier.

**/ai-policy**

- "02 Every AI system I use for client work is listed in the register, with the data tier it may see and whether its output is reviewed before a client sees it." Keeps: number, scope, quantifier, conditional, uncertainty. Tempts a rewriter: over 25 words, passive, no actor.
- "05 If a vendor changes its terms, its register entry is re-checked before the next engagement day, not at renewal." Keeps: number, scope, conditional. Tempts a rewriter: passive, no actor.
- "06 Incidents are written down, including the ones with no consequence, because the pattern matters more than the single event." Keeps: number, quantifier, causal. Tempts a rewriter: passive, no actor.
- "If a document was drafted with an AI system, I have read every line of it and I stand behind it." Keeps: quantifier, conditional. Tempts a rewriter: passive, no actor.
- "03 Model output is never sent to a client unreviewed." Keeps: number, quantifier. Tempts a rewriter: passive, no actor.
- "04 Client data is never used to improve a model." Keeps: number, quantifier. Tempts a rewriter: passive, no actor.
- "Where a vendor offers training on inputs by default, that setting is off before the tool is used." Keeps: scope, conditional.
- "There is nobody else to delegate it to, which makes the register short and the accountability obvious." Keeps: quantifier.

**/security**

- "My own working notes are deleted at handover, and the handover lists every credential I held so revoking them is a checklist rather than a memory." Keeps: scope, quantifier, causal. Tempts a rewriter: over 25 words, passive, no actor.
- "If I find that your material has been exposed, I tell you within 24 hours of finding out." Keeps: number, scope, conditional. Tempts a rewriter: passive, no actor.
- "I reply within two working days and I will tell you when it is fixed." Keeps: number, scope, conditional. Tempts a rewriter: passive, no actor.
- "Anything further, including who else must be notified, is set in your contract rather than on this page." Keeps: scope, modal. Tempts a rewriter: passive, no actor.
- "No server code, no database, no user accounts, no data-collection forms: the search box on this site never submits anywhere, and the Content-Security-Policy blocks form submission outright." Keeps: quantifier. Tempts a rewriter: over 25 words.
- "Nothing client-owned is used to train or improve a model." Keeps: quantifier. Tempts a rewriter: passive, no actor.
- "Every inline block is hashed at build time." Keeps: quantifier. Tempts a rewriter: passive, no actor.
- "Two-factor authentication on every work account, and passwords in a password manager rather than in a file or a browser." Keeps: number, scope, quantifier.

### Text that names ISO/IEC 42001, NIST AI RMF, the EU AI Act or another standard

93 distinct sentences name a standard, and 26 of them are flagged. They sit on 44 routes (article 4, category 1, tag 1, faq 4, term 26, static 1, resource 5, service 2). The pages about the standards themselves are `/glossary/eu-ai-act`, `/glossary/iso-iec-42001`, `/glossary/nist-ai-rmf`; every other route that names one needs the same word-by-word care. The flagged sentences, most repeated first:

- "The EU AI Act is binding law: what you owe depends on being a provider (building AI into what you sell) or a deployer (only using it inside the business), plus the system's risk tier, not your size." Routes: `/faq/what-do-nist-ai-rmf-iso-iec-42001-and-the-eu-ai-act-require`. Keeps: scope, standard. Tempts a rewriter: over 25 words.
- "It covers a readiness score across strategy, data, delivery, people and governance, a gap list against NIST AI RMF, ISO/IEC 42001 and the EU AI Act, and three processes ranked by what automating them is worth this quarter." Routes: `/faq/what-does-the-two-week-assessment-produce-and-is-the-fee-credited-if-we-continue`. Keeps: number, standard. Tempts a rewriter: over 25 words.
- "The register, the policy and the classification are the GOVERN function (one of the framework’s four functions) of the NIST AI Risk Management Framework (AI RMF), applied to one company, not a whole sector." Routes: `/services/fractional-caio-retainer`. Keeps: number, standard. Tempts a rewriter: over 25 words.
- "The EU AI Act is an EU regulation, in force since August 2024, that sorts AI systems into risk tiers and sets legal obligations that scale with the tier, heaviest for high-risk systems." Routes: `/glossary/eu-ai-act`. Keeps: number, causal, standard. Tempts a rewriter: over 25 words.
- "Article 14 of the EU AI Act requires "effective" human oversight for high-risk systems: oversight that can genuinely catch and correct a bad output, not a person who clicks approve without reading it." Routes: `/glossary/human-in-the-loop`. Keeps: number, standard. Tempts a rewriter: over 25 words.
- "Human oversight is the EU AI Act requirement that a person watching a high-risk AI system has the training, time and authority to understand what it is doing and catch a wrong output." Routes: `/glossary/human-oversight`. Keeps: standard. Tempts a rewriter: over 25 words.
- "The starter takes no position on which cases you pick, and that part still maps to the MEASURE function (one of the framework’s four functions) in NIST’s AI Risk Management Framework (AI RMF)." Routes: `/resources/agent-evals-ci-starter`. Keeps: number, quantifier, standard. Tempts a rewriter: over 25 words.
- "The public registration duty under Article 49 of the EU AI Act applies separately, only to certain high-risk systems, and is filed in the database the Commission set up under Article 71." Routes: `/blog/how-to-build-an-ai-system-register-in-a-week`. Keeps: number, scope, standard. Tempts a rewriter: over 25 words, passive, no actor.
- "Post-market monitoring is the EU AI Act duty on a provider to keep collecting and analysing real-world performance data on a high-risk AI system for as long as it is in use." Routes: `/glossary/post-market-monitoring`. Keeps: standard. Tempts a rewriter: over 25 words.
- "Evals in CI apply the MEASURE function (one of the framework’s four functions) inside the NIST AI Risk Management Framework (AI RMF) to one production workflow instead of a whole AI programme." Routes: `/services/90-day-production-sprint`. Keeps: number, scope, standard. Tempts a rewriter: over 25 words.
- "The NIST AI Risk Management Framework (AI RMF) is a voluntary US framework, published in January 2023, for identifying and managing an AI system's risks across its design, development and use." Routes: `/glossary/nist-ai-rmf`. Keeps: number, standard. Tempts a rewriter: over 25 words.
- "Biometric identification uses Annex VII's notified-body route wherever harmonised standards, the detailed technical rules the Commission recognises as proof of compliance, are not fully applied or do not yet exist." Routes: `/glossary/conformity-assessment`. Keeps: scope, conditional, uncertainty, standard. Tempts a rewriter: over 25 words, passive, no actor.
- "Map what you already do against the NIST AI RMF or ISO/IEC 42001, not to get certified immediately, but so you have a recognised structure to point at." Routes: `/glossary/ai-governance`. Keeps: number, causal, standard. Tempts a rewriter: over 25 words.
- "NIST's own method for federal systems ties each category to a real question, not a subjective label: what actually happens to confidentiality, integrity or availability if this breaks?" Routes: `/glossary/data-classification`. Keeps: quantifier, conditional, standard. Tempts a rewriter: over 25 words.

### Commitments, prices and ownership

Selected by an H1 that asks about training, ownership, charging, credit, fees or confidentiality, plus the pricing page: `/faq/are-models-trained-on-our-customer-data`, `/faq/can-you-work-with-our-existing-ai-vendor-or-platform`, `/faq/how-do-you-charge-for-the-work`, `/faq/what-does-the-two-week-assessment-produce-and-is-the-fee-credited-if-we-continue`, `/faq/who-owns-the-code-and-the-data`, `/faq/who-owns-the-frameworks-templates-and-playbooks-built-during-the-engagement`, `/pricing`. 24 distinct sentences on them carry load. The ones a rewriter would also flag:

- "You hear the number on the fit call, and it is written down before any work starts, so there is no surprise invoice partway through." Route: `/faq/how-do-you-charge-for-the-work`. Keeps: scope, quantifier, causal. Tempts a rewriter: passive, no actor.
- "Yes: if you move to the 90-Day Sprint within three months, the full Assessment fee is credited off the Sprint price." Route: `/faq/what-does-the-two-week-assessment-produce-and-is-the-fee-credited-if-we-continue`. Keeps: number, scope, conditional. Tempts a rewriter: passive, no actor.
- "I use vendor terms that exclude your data from model training, the same enterprise or business-tier terms a compliance team would ask about, and I check that clause before any tool touches your data." Route: `/faq/are-models-trained-on-our-customer-data`. Keeps: scope, quantifier. Tempts a rewriter: over 25 words.
- "It covers a readiness score across strategy, data, delivery, people and governance, a gap list against NIST AI RMF, ISO/IEC 42001 and the EU AI Act, and three processes ranked by what automating them is worth this quarter." Route: `/faq/what-does-the-two-week-assessment-produce-and-is-the-fee-credited-if-we-continue`. Keeps: number, standard. Tempts a rewriter: over 25 words.
- "Sprints are quoted per engagement from the scope agreed in the statement of work, never per hour." Route: `/pricing`. Keeps: scope, quantifier. Tempts a rewriter: passive, no actor.
- "The Sprint is quoted once, from the scope in the statement of work." Route: `/faq/how-do-you-charge-for-the-work`. Keeps: conditional. Tempts a rewriter: passive, no actor.
- "The code lives in your repositories from the first commit, under your licence and your review rules, and the same principle applies to your data: nothing about the engagement moves ownership of either to me or to a vendor." Route: `/faq/who-owns-the-code-and-the-data`. Keeps: quantifier. Tempts a rewriter: over 25 words.
- "Travel, if you want me on site, is billed at cost and agreed in advance." Route: `/pricing`. Keeps: conditional. Tempts a rewriter: passive, no actor.

### Numbers on the content-facts allowlist

The content gate lets a page state only these 16 numbers. A rewrite that rounds, drops or rewords around one of them breaks a check and a claim. A count of 0 means no gate-body sentence holds that number as a separate token.

| Number | Distinct sentences | Routes | Flagged |
|---|---|---|---|
| `30` | 6 | 5 | 2 |
| `300` | 6 | 5 | 2 |
| `90` | 15 | 15 | 3 |
| `42001` | 18 | 12 | 6 |
| `27001` | 2 | 1 | 0 |
| `2` | 1 | 1 | 0 |
| `3` | 2 | 2 | 0 |
| `1` | 2 | 2 | 0 |
| `0.1` | 0 | 0 | 0 |
| `14` | 3 | 2 | 2 |
| `71` | 3 | 2 | 1 |
| `1,000` | 0 | 0 | 0 |
| `155` | 0 | 0 | 0 |
| `12` | 1 | 1 | 0 |
| `6` | 3 | 1 | 0 |
| `24` | 1 | 1 | 1 |

### Other load-bearing sentences a flag would send a rewriter to

Not legal and not a standard: the twelve flagged sentences with the most load classes.

- "One person accountable for AI risk, on the org chart, with the authority to say no. I decide what may reach a vendor and who has the final call when that is unclear." Routes: `/approach`. Keeps: number, quantifier, conditional, uncertainty. Tempts a rewriter: over 25 words.
- "If nobody does, that gap usually surfaces during an AI readiness and risk assessment before it ever reaches the policy stage, because there is no obvious person to hand the draft to." Routes: `/blog/ai-acceptable-use-policy-for-a-50-person-company`. Keeps: scope, quantifier, conditional, causal. Tempts a rewriter: over 25 words.
- "Engineering teams build them because "it worked when I tried it a few times" does not survive a prompt change six months later, once nobody remembers which cases mattered." Routes: `/glossary/evals`. Keeps: number, quantifier, conditional, causal. Tempts a rewriter: over 25 words.
- "Most proof-of-concepts skip four things production always needs: a named owner who still answers a year after launch and a decision about which data may leave the building." Routes: `/blog/why-your-ai-pilot-never-reached-production`. Keeps: number, scope, quantifier, uncertainty. Tempts a rewriter: over 25 words.
- "Tracing on every call, so a bad answer could be traced to the retrieval step rather than argued about." Routes: `/case-studies/only-help-agentic-support`. Keeps: scope, quantifier, causal, uncertainty. Tempts a rewriter: passive, no actor.
- "Pick the one flow with volume and a measurable outcome, build an eval set from real tickets before touching the prompt, then put the eval run in CI so a regression blocks the merge rather than the customer." Routes: `/case-studies/only-help-agentic-support`. Keeps: number, scope, causal. Tempts a rewriter: over 25 words.
- "A support inbox growing faster than the people reading it, and a prototype agent nobody would let near a real customer because there was no way to tell whether an answer was good." Routes: `/case-studies/only-help-agentic-support`. Keeps: quantifier, conditional, causal. Tempts a rewriter: over 25 words.
- "There is no test suite running against real examples before a change ships, so a regression surfaces first as a customer complaint or a bad downstream decision, not as a failed build." Routes: `/blog/why-your-ai-pilot-never-reached-production`. Keeps: scope, quantifier, causal. Tempts a rewriter: over 25 words.
- "It also decides whether a person checks AI output before it reaches a customer or a contract, and when a customer must be told they are dealing with an AI system." Routes: `/blog/ai-acceptable-use-policy-for-a-50-person-company`. Keeps: scope, conditional, modal. Tempts a rewriter: over 25 words, passive, no actor.
- "Silence is its own answer too: a policy that never states what happens after a breach gets tested once, and staff learn from the result whether any of it is real." Routes: `/blog/ai-acceptable-use-policy-for-a-50-person-company`. Keeps: scope, quantifier, conditional. Tempts a rewriter: over 25 words.
- "Work out early, before the system is built, which assessment route applies, since a notified-body review takes far longer to arrange than an internal one and cannot be rushed at launch." Routes: `/glossary/conformity-assessment`. Keeps: number, scope, causal. Tempts a rewriter: over 25 words, passive, no actor.
- "Put a cost ceiling per completed run in the same job as the quality score, so an expensive change fails the build for the same reason a wrong one does." Routes: `/blog/evals-in-ci-for-llm-agents`. Keeps: number, scope, causal. Tempts a rewriter: over 25 words.

## Rewrite plan

The unit of work is a slice of routes whose source files no other slice edits. Ownership comes from the editorial ledger: each ledger row lists the source files and the routes where its text ships.

The ledger names 123 source files. Rule: the path prefix names the owning family; everything else is shared.

| Owner | Files | Ledger rows | Routes reached | Reached outside own family |
|---|---|---|---|---|
| article | 8 | 94 | 21 | 17 |
| blog-category | 3 | 42 | 5 | 1 |
| case-study | 2 | 18 | 1 | 1 |
| faq-answer | 26 | 74 | 63 | 38 |
| resource | 7 | 65 | 56 | 51 |
| service | 5 | 134 | 67 | 64 |
| shared | 23 | 159 | 88 | 88 |
| static | 15 | 288 | 19 | 4 |
| tag | 2 | 13 | 3 | 3 |
| term | 32 | 183 | 53 | 23 |

Routes reached, by family of the route (column order: static, article, category, tag, tag-index, case, faq, term, resource, service):

| Owner | Files | Rows | Reached | static | article | category | tag | tag-index | case | faq | term | resource | service |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| article | 8 | 94 | 21 | 1 | 4 | 3 | 12 | 1 | 0 | 0 | 0 | 0 | 0 |
| blog-category | 3 | 42 | 5 | 0 | 0 | 4 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| case-study | 2 | 18 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| faq-answer | 26 | 74 | 63 | 0 | 0 | 0 | 0 | 0 | 0 | 25 | 30 | 5 | 3 |
| resource | 7 | 65 | 56 | 1 | 3 | 0 | 0 | 0 | 0 | 14 | 30 | 5 | 3 |
| service | 5 | 134 | 67 | 3 | 0 | 0 | 0 | 0 | 1 | 25 | 30 | 5 | 3 |
| shared | 23 | 159 | 88 | 15 | 4 | 4 | 0 | 1 | 1 | 25 | 30 | 5 | 3 |
| static | 15 | 288 | 19 | 15 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tag | 2 | 13 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 0 |
| term | 32 | 183 | 53 | 1 | 0 | 0 | 0 | 0 | 0 | 14 | 30 | 5 | 3 |

Source files whose own routes fall in more than one slice: 2 (`src/pages/faq/[id].astro`, `src/pages/glossary/[id].astro`). Any such file moves to slice 0 and is edited once.

| Slice | What | Routes | Prose words | Mean ease | Flagged sentences (raw) | Core swaps |
|---|---|---|---|---|---|---|
| S0 | Shared chrome, shared data and shared components | none own; 23 files reach 88 | 0 | - | 0 | 0 |
| S1 | Glossary terms, except the standards | 27 | 8785 | 52.4 | 99 | 6 |
| S2 | FAQ answers, except the commitments | 19 | 1095 | 63.2 | 13 | 0 |
| S3 | Articles, categories, tags and the tag index | 21 | 8582 | 62.0 | 111 | 5 |
| S4 | Services, case study and resources | 9 | 2572 | 63.5 | 40 | 3 |
| S5 | Static pages with their own source file | 5 | 801 | 68.6 | 9 | 2 |
| S6 | Hubs and the home page that excerpt other slices | 6 | 653 | 70.7 | 7 | 2 |
| S7 | Frozen: legal, standards, commitments and pricing | 15 | 2486 | 60.4 | 48 | 0 |
| S8 | Utility pages the gate skips | 3 | 426 | 74.2 | 6 | 1 |

Slice 6 (static routes that excerpt text owned by another family): `/`, `/blog`, `/case-studies`, `/glossary`, `/resources`, `/services`.

Slice 7 has 15 routes: `/ai-policy`, `/faq/are-models-trained-on-our-customer-data`, `/faq/can-you-work-with-our-existing-ai-vendor-or-platform`, `/faq/how-do-you-charge-for-the-work`, `/faq/what-does-the-two-week-assessment-produce-and-is-the-fee-credited-if-we-continue`, `/faq/who-owns-the-code-and-the-data`, `/faq/who-owns-the-frameworks-templates-and-playbooks-built-during-the-engagement`, `/glossary/eu-ai-act`, `/glossary/iso-iec-42001`, `/glossary/nist-ai-rmf`, `/imprint`, `/pricing`, `/privacy`, `/security`, `/terms`.

### Order

1. Slice 0 first and alone. It holds the chrome, shared data and shared components that every other slice excerpts. Promote the measurement into the repo here, with tests, so each later slice is checked by a command and not by trust. This needs a decision from Main, because this task deleted the throwaway script.
2. Slices 1 to 5 in parallel, one writer per slice. They share no source file, but they share routes: text owned by one family ships on routes of other families (routes reached outside the owner's own family: service 64, resource 51, faq-answer 38, term 23, article 17, tag 3, blog-category 1, case-study 1). A route-level measurement is only valid once the whole wave has landed and the site is rebuilt. Each slice commits its ledger changes in the same commit (disposition the rows, then seal), because a disposition is sealed against the words it reviewed and any edit returns the row to unreviewed.
3. Slice 6 after slices 1 to 5, because its cards and excerpts change when their sources change.
4. Slice 7 last, one sentence at a time, with the owner reading each diff. Nothing in it is rewritten for style.
5. Slice 8 stays out unless the owner asks for it.

### Acceptance test for every slice

1. During a slice, check the ledger rows it changed and the gates below. After the wave, announce on the hub, run `npm run build` and re-measure every route the wave owns and every route it reaches outside its family.
2. `npm run gate:human`, `npm run gate:content`, `npm run gate:editorial`, `npm run gate:registers`, `npm run gate:machine`, `npm run gate:jsonld`, `npm run gate:search`, `npm run gate:links` and `node scripts/semantic-core.mjs --check` pass. After a ledger change, run `npm run assets:seal` and `npm run assets:registers` and commit their output in the same commit.
3. For each route in the slice: no tell instance, no core swap, no agentless passive, no stacked hedge, no throat-clearing, no noun for a verb, no sentence over 25 words and no rhythm finding.
4. Ease does not fall and grade does not rise against Appendix A. A route that stays under ease 60 names the terms that hold it down.
5. Title, description and H1 still carry the target query. A route listed in section 3 gets a fix or a written reason.
6. Survival diff: every number, scope qualifier, quantifier, condition, cause, stated uncertainty, modal and named standard in an old sentence is in the new one. The sentences quoted in section 5 are compared word by word.
7. Guard check: plant one bad specimen of each rule in a scratch copy of a slice route (a core swap word, a 30-word sentence, a dropped number). The check must fail on it before it is trusted on the real edit.
8. Main runs the full gate set once after all slices land.

## Appendix A. Every route

Words are all words in the gate body. Prose is the part the readability figures use. Ease, grade, mean, longest and passive share are the gate's functions. The four tell columns count every instance (antithesis, bold lead, emoji bullet, controlled word). Rhythm counts gate rhythm findings. Swaps are core-list and technical-term hits. Flagged is the share of sentences that meet a flag rule. Cover is title/description/H1 cover of the target query. "n/g" marks a page the gate skips.

| Route | Family | Words | Prose | Sentences | Ease | Grade | Mean | Longest | Passive | Antith. | Bold lead | Emoji | Ctrl word | Rhythm | Core swaps | Tech terms | Flagged | Cover |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | static | 511 | 366 | 33 | 70.8 | 6.1 | 11.1 | 30 | 9% | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 18% | 1.00/0.50/1.00 |
| `/404` (n/g) | static | 20 | 12 | 2 | - | - | 6.0 | 7 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0% | - |
| `/about` | static | 183 | 94 | 7 | 58.2 | 8.5 | 13.4 | 28 | 14% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 43% | 1.00/0.00/1.00 |
| `/ai-policy` | static | 284 | 254 | 22 | 57.6 | 8.1 | 11.5 | 32 | 32% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 32% | 1.00/1.00/1.00 |
| `/approach` | static | 388 | 331 | 24 | 65.3 | 7.6 | 13.8 | 33 | 0% | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 4% | 0.25/0.50/1.00 |
| `/blog` | static | 55 | 36 | 3 | 84.2 | 4.5 | 12.0 | 16 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0% | 0.33/0.33/1.00 |
| `/blog/ai-acceptable-use-policy-for-a-50-person-company` | article | 2005 | 1784 | 102 | 60.3 | 9.2 | 17.5 | 32 | 9% | 0 | 0 | 0 | 0 | 0 | 0 | 6 | 26% | 1.00/1.00/1.00 |
| `/blog/category/agentic-architecture` | category | 381 | 365 | 25 | 63.1 | 8.1 | 14.6 | 25 | 4% | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 12% | 1.00/1.00/1.00 |
| `/blog/category/executive` | category | 362 | 346 | 22 | 69.6 | 7.5 | 15.7 | 27 | 14% | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 23% | 1.00/1.00/1.00 |
| `/blog/category/governance` | category | 400 | 384 | 23 | 64.1 | 8.5 | 16.7 | 27 | 9% | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 13% | 1.00/1.00/1.00 |
| `/blog/category/operating-model` | category | 365 | 349 | 25 | 54.5 | 9.1 | 14.0 | 27 | 8% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 16% | 1.00/1.00/1.00 |
| `/blog/evals-in-ci-for-llm-agents` | article | 2349 | 2093 | 134 | 66.0 | 7.9 | 15.6 | 33 | 5% | 0 | 0 | 0 | 0 | 0 | 2 | 3 | 14% | 1.00/1.00/1.00 |
| `/blog/how-to-build-an-ai-system-register-in-a-week` | article | 1740 | 1530 | 91 | 59.8 | 9.1 | 16.8 | 33 | 3% | 0 | 0 | 0 | 0 | 0 | 1 | 4 | 27% | 1.00/1.00/1.00 |
| `/blog/tag/acceptable-use-policy` | tag | 14 | 8 | 1 | - | - | 8.0 | 8 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0% | 1.00/1.00/1.00 |
| `/blog/tag/agentic-architecture` | tag | 12 | 7 | 1 | - | - | 7.0 | 7 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100% | 1.00/1.00/1.00 |
| `/blog/tag/ai-governance` | tag | 12 | 7 | 1 | - | - | 7.0 | 7 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0% | 1.00/1.00/1.00 |
| `/blog/tag/ai-pilots` | tag | 12 | 7 | 1 | - | - | 7.0 | 7 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0% | 1.00/1.00/1.00 |
| `/blog/tag/ai-register` | tag | 12 | 7 | 1 | - | - | 7.0 | 7 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0% | 1.00/1.00/1.00 |
| `/blog/tag/eu-ai-act` | tag | 14 | 8 | 1 | - | - | 8.0 | 8 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0% | 1.00/1.00/1.00 |
| `/blog/tag/evals-in-ci` | tag | 14 | 8 | 1 | - | - | 8.0 | 8 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0% | 1.00/1.00/1.00 |
| `/blog/tag/llm-as-judge` | tag | 14 | 8 | 1 | - | - | 8.0 | 8 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0% | 1.00/1.00/1.00 |
| `/blog/tag/policy-enforcement` | tag | 12 | 7 | 1 | - | - | 7.0 | 7 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0% | 1.00/1.00/1.00 |
| `/blog/tag/production-readiness` | tag | 12 | 7 | 1 | - | - | 7.0 | 7 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0% | 1.00/1.00/1.00 |
| `/blog/tag/security-review` | tag | 12 | 7 | 1 | - | - | 7.0 | 7 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0% | 1.00/1.00/1.00 |
| `/blog/tag/shadow-ai` | tag | 12 | 7 | 1 | - | - | 7.0 | 7 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0% | 1.00/1.00/1.00 |
| `/blog/tags` | tag-index | 69 | 13 | 1 | - | - | 13.0 | 13 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0% | 1.00/1.00/1.00 |
| `/blog/why-your-ai-pilot-never-reached-production` | article | 1819 | 1630 | 93 | 58.6 | 9.4 | 17.5 | 32 | 8% | 0 | 0 | 0 | 0 | 0 | 1 | 2 | 26% | 1.00/0.80/1.00 |
| `/case-studies` | static | 52 | 42 | 3 | 77.8 | 5.9 | 14.0 | 20 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 33% | 0.33/0.17/1.00 |
| `/case-studies/only-help-agentic-support` | case | 381 | 297 | 16 | 61.5 | 9.3 | 18.6 | 38 | 25% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 44% | 1.00/1.00/1.00 |
| `/contact` | static | 118 | 69 | 6 | 75.0 | 5.7 | 11.5 | 14 | 33% | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 33% | 0.00/0.50/1.00 |
| `/faq` | static | 532 | 218 | 28 | 75.1 | 4.7 | 7.8 | 17 | 4% | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 4% | 0.20/0.80/1.00 |
| `/faq/are-models-trained-on-our-customer-data` | faq | 73 | 56 | 3 | 70.1 | 8.1 | 18.7 | 34 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 33% | 1.00/1.00/1.00 |
| `/faq/can-you-get-us-iso-iec-42001-certified-or-just-a-working-system` | faq | 95 | 63 | 4 | 49.8 | 10.2 | 15.8 | 23 | 25% | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 25% | 0.60/0.30/1.00 |
| `/faq/can-you-work-with-our-existing-ai-vendor-or-platform` | faq | 87 | 60 | 3 | 52.6 | 10.9 | 20.0 | 33 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 33% | 0.50/1.00/1.00 |
| `/faq/how-do-you-charge-for-the-work` | faq | 82 | 67 | 5 | 82.1 | 5.1 | 13.4 | 25 | 40% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 40% | 1.00/1.00/1.00 |
| `/faq/how-does-ai-risk-get-recorded-and-who-signs-it-off` | faq | 77 | 56 | 3 | 47.4 | 11.3 | 18.7 | 39 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 33% | 1.00/1.00/1.00 |
| `/faq/how-does-the-retainer-end` | faq | 69 | 54 | 4 | 78.8 | 5.6 | 13.5 | 21 | 50% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 50% | 1.00/1.00/1.00 |
| `/faq/how-is-a-prompt-or-model-change-stopped-from-shipping-unnoticed` | faq | 74 | 53 | 4 | 60.9 | 8.1 | 13.3 | 23 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0% | 0.50/1.00/1.00 |
| `/faq/how-is-cost-per-outcome-measured` | faq | 69 | 55 | 5 | 72.6 | 5.9 | 11.0 | 17 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0% | 1.00/1.00/1.00 |
| `/faq/how-quickly-can-you-start-and-how-does-availability-work-for-a-remote-officer` | faq | 80 | 56 | 4 | 77.8 | 5.9 | 14.0 | 20 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0% | 0.67/1.00/1.00 |
| `/faq/is-my-company-too-small-or-too-early-for-a-fractional-chief-ai-officer` | faq | 78 | 54 | 3 | 66.4 | 8.5 | 18.0 | 26 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 33% | 0.50/1.00/1.00 |
| `/faq/what-counts-as-in-production-for-the-90-day-sprint` | faq | 82 | 63 | 4 | 67.3 | 7.8 | 15.8 | 26 | 25% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 25% | 1.00/1.00/1.00 |
| `/faq/what-do-nist-ai-rmf-iso-iec-42001-and-the-eu-ai-act-require` | faq | 113 | 73 | 4 | 65.5 | 8.7 | 18.3 | 38 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 25% | 0.67/1.00/1.00 |
| `/faq/what-do-we-do-about-tools-staff-are-already-using-without-approval` | faq | 77 | 55 | 3 | 49.8 | 10.9 | 18.3 | 32 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 33% | 0.60/1.00/1.00 |
| `/faq/what-does-a-fractional-chief-ai-officer-actually-do` | faq | 82 | 55 | 4 | 49.8 | 9.7 | 13.8 | 16 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0% | 0.57/1.00/1.00 |
| `/faq/what-does-the-two-week-assessment-produce-and-is-the-fee-credited-if-we-continue` | faq | 90 | 66 | 3 | 65.3 | 9.6 | 22.0 | 38 | 33% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 67% | 0.43/1.00/1.00 |
| `/faq/what-happens-if-the-evals-say-a-workflow-isnt-good-enough` | faq | 74 | 53 | 3 | 69.2 | 8.0 | 17.7 | 30 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 33% | 0.63/1.00/1.00 |
| `/faq/what-happens-on-a-fit-call-and-does-it-cost-anything` | faq | 68 | 49 | 3 | 71.1 | 7.4 | 16.3 | 23 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0% | 1.00/1.00/1.00 |
| `/faq/what-if-the-ai-we-are-building-goes-into-a-product-we-sell` | faq | 97 | 66 | 4 | 55.5 | 9.6 | 16.5 | 24 | 25% | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 25% | 0.50/1.00/1.00 |
| `/faq/what-if-we-already-have-a-data-science-team-or-an-internal-ai-lead` | faq | 93 | 69 | 4 | 58.1 | 9.4 | 17.3 | 23 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0% | 0.67/1.00/1.00 |
| `/faq/what-size-of-company-do-you-actually-work-with` | faq | 68 | 51 | 4 | 56.2 | 8.6 | 12.8 | 14 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0% | 1.00/1.00/1.00 |
| `/faq/whats-the-difference-between-the-assessment-the-sprint-and-the-retainer` | faq | 97 | 76 | 5 | 77.9 | 6.2 | 15.2 | 26 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 20% | 0.50/1.00/1.00 |
| `/faq/who-answers-customer-security-questionnaires` | faq | 56 | 41 | 2 | - | - | 20.5 | 33 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 50% | 1.00/1.00/1.00 |
| `/faq/who-owns-the-code-and-the-data` | faq | 75 | 58 | 3 | 57.4 | 10.1 | 19.3 | 39 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 33% | 1.00/1.00/1.00 |
| `/faq/who-owns-the-frameworks-templates-and-playbooks-built-during-the-engagement` | faq | 80 | 59 | 4 | 62.8 | 8.2 | 14.8 | 19 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0% | 0.43/1.00/1.00 |
| `/faq/why-hire-a-fractional-officer-instead-of-a-full-time-head-of-ai` | faq | 75 | 53 | 2 | - | - | 26.5 | 35 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 50% | 0.71/0.29/1.00 |
| `/glossary` | static | 293 | 124 | 12 | 61.3 | 7.3 | 10.3 | 17 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0% | 1.00/0.67/1.00 |
| `/glossary/agentic-workflow` | term | 366 | 319 | 17 | 57.8 | 9.9 | 18.8 | 28 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 24% | 1.00/1.00/1.00 |
| `/glossary/ai-governance` | term | 376 | 329 | 20 | 62.3 | 8.7 | 16.4 | 28 | 5% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 15% | 1.00/1.00/1.00 |
| `/glossary/ai-impact-assessment` | term | 389 | 338 | 18 | 53.9 | 10.4 | 18.8 | 28 | 6% | 0 | 0 | 0 | 0 | 0 | 0 | 5 | 28% | 1.00/1.00/1.00 |
| `/glossary/ai-management-system` | term | 394 | 345 | 20 | 47.3 | 10.9 | 17.3 | 30 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 5 | 15% | 1.00/1.00/1.00 |
| `/glossary/ai-register` | term | 380 | 333 | 18 | 59.0 | 9.6 | 18.5 | 33 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 17% | 1.00/1.00/1.00 |
| `/glossary/conformity-assessment` | term | 409 | 369 | 18 | 40.0 | 12.8 | 20.5 | 33 | 11% | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 28% | 1.00/1.00/1.00 |
| `/glossary/data-classification` | term | 369 | 311 | 22 | 53.5 | 9.3 | 14.1 | 28 | 5% | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 18% | 1.00/1.00/1.00 |
| `/glossary/dpia` | term | 404 | 347 | 20 | 47.8 | 10.9 | 17.4 | 30 | 20% | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 30% | 1.00/1.00/1.00 |
| `/glossary/eu-ai-act` | term | 388 | 345 | 20 | 52.0 | 10.3 | 17.3 | 34 | 15% | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 30% | 1.00/1.00/1.00 |
| `/glossary/evals` | term | 381 | 334 | 18 | 64.6 | 8.9 | 18.6 | 31 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 33% | 1.00/1.00/1.00 |
| `/glossary/guardrails` | term | 357 | 321 | 17 | 60.1 | 9.6 | 18.9 | 34 | 18% | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 35% | 1.00/1.00/1.00 |
| `/glossary/hallucination-rate` | term | 333 | 280 | 16 | 55.8 | 9.8 | 17.5 | 32 | 19% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 31% | 1.00/1.00/1.00 |
| `/glossary/high-risk-ai-system` | term | 438 | 392 | 22 | 37.5 | 12.5 | 17.8 | 28 | 0% | 0 | 0 | 0 | 0 | 0 | 1 | 3 | 9% | 1.00/1.00/1.00 |
| `/glossary/human-in-the-loop` | term | 358 | 317 | 16 | 54.4 | 10.6 | 19.8 | 33 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 25% | 1.00/1.00/1.00 |
| `/glossary/human-oversight` | term | 361 | 321 | 17 | 56.2 | 10.1 | 18.9 | 33 | 12% | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 41% | 1.00/1.00/1.00 |
| `/glossary/iso-iec-42001` | term | 373 | 332 | 17 | 42.8 | 12.1 | 19.5 | 32 | 12% | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 35% | 1.00/1.00/1.00 |
| `/glossary/llm-gateway` | term | 374 | 327 | 18 | 47.1 | 11.2 | 18.2 | 30 | 22% | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 39% | 1.00/1.00/1.00 |
| `/glossary/model-card` | term | 344 | 304 | 20 | 53.9 | 9.5 | 15.2 | 22 | 30% | 0 | 0 | 0 | 0 | 0 | 1 | 2 | 30% | 1.00/1.00/1.00 |
| `/glossary/model-provenance` | term | 345 | 305 | 17 | 51.6 | 10.5 | 17.9 | 29 | 24% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 29% | 1.00/1.00/1.00 |
| `/glossary/nist-ai-rmf` | term | 351 | 314 | 18 | 54.4 | 10.0 | 17.4 | 31 | 6% | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 28% | 1.00/0.67/1.00 |
| `/glossary/observability` | term | 340 | 307 | 19 | 54.6 | 9.7 | 16.2 | 27 | 16% | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 16% | 1.00/1.00/1.00 |
| `/glossary/post-market-monitoring` | term | 393 | 333 | 17 | 49.0 | 11.3 | 19.6 | 32 | 6% | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 18% | 1.00/1.00/1.00 |
| `/glossary/prompt-injection` | term | 361 | 322 | 22 | 50.1 | 9.9 | 14.6 | 23 | 5% | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0% | 1.00/1.00/1.00 |
| `/glossary/provider-vs-deployer` | term | 365 | 329 | 22 | 50.5 | 9.9 | 15.0 | 24 | 5% | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0% | 1.00/1.00/1.00 |
| `/glossary/red-teaming` | term | 342 | 298 | 17 | 51.9 | 10.4 | 17.5 | 25 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0% | 1.00/1.00/1.00 |
| `/glossary/retrieval-augmented-generation` | term | 335 | 298 | 19 | 47.3 | 10.6 | 15.7 | 23 | 16% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 16% | 1.00/1.00/1.00 |
| `/glossary/serious-incident-reporting` | term | 408 | 354 | 20 | 49.5 | 10.7 | 17.7 | 32 | 10% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 20% | 0.67/1.00/1.00 |
| `/glossary/shadow-ai` | term | 346 | 311 | 21 | 55.8 | 9.2 | 14.8 | 22 | 5% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5% | 1.00/1.00/1.00 |
| `/glossary/sub-processor` | term | 367 | 334 | 21 | 55.2 | 9.5 | 15.9 | 25 | 5% | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 10% | 1.00/1.00/1.00 |
| `/glossary/technical-documentation` | term | 352 | 307 | 17 | 47.4 | 11.1 | 18.1 | 24 | 12% | 0 | 0 | 0 | 0 | 0 | 0 | 8 | 12% | 1.00/1.00/1.00 |
| `/imprint` | static | 47 | 12 | 2 | - | - | 6.0 | 8 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0% | 1.00/0.00/1.00 |
| `/now` | static | 131 | 89 | 6 | 69.2 | 7.3 | 14.8 | 22 | 33% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 33% | 0.33/0.33/1.00 |
| `/pricing` | static | 190 | 134 | 10 | 68.2 | 7.1 | 13.4 | 20 | 20% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 20% | 0.00/0.00/1.00 |
| `/privacy` | static | 271 | 251 | 16 | 64.5 | 8.2 | 15.7 | 28 | 44% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 38% | 0.50/0.00/1.00 |
| `/resources` | static | 42 | 32 | 2 | - | - | 16.0 | 19 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0% | 0.00/1.00/1.00 |
| `/resources/agent-evals-ci-starter` | resource | 479 | 281 | 18 | 71.2 | 7.2 | 15.6 | 33 | 6% | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 17% | 1.00/1.00/1.00 |
| `/resources/ai-governance-starter-kit` | resource | 350 | 274 | 23 | 58.0 | 8.1 | 11.9 | 27 | 13% | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 26% | 1.00/1.00/1.00 |
| `/resources/ai-readiness-scorecard` | resource | 526 | 230 | 16 | 61.3 | 8.3 | 14.4 | 22 | 13% | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 13% | 1.00/1.00/1.00 |
| `/resources/build-vs-buy-ai-kit` | resource | 532 | 260 | 17 | 68.3 | 7.5 | 15.3 | 27 | 6% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 12% | 1.00/1.00/1.00 |
| `/resources/llm-gateway-governance-config` | resource | 500 | 263 | 18 | 57.2 | 8.9 | 14.6 | 29 | 11% | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 22% | 1.00/1.00/1.00 |
| `/search` (n/g) | static | 59 | 50 | 5 | 79.9 | 4.6 | 10.0 | 23 | 40% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 40% | - |
| `/security` | static | 307 | 279 | 20 | 60.5 | 8.3 | 13.9 | 27 | 30% | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 35% | 0.50/0.00/1.00 |
| `/services` | static | 66 | 53 | 3 | 59.6 | 9.3 | 17.7 | 19 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0% | 0.25/0.50/1.00 |
| `/services/90-day-production-sprint` | service | 594 | 334 | 24 | 70.9 | 6.8 | 13.9 | 32 | 13% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 17% | 1.00/1.00/1.00 |
| `/services/ai-readiness-and-risk-assessment` | service | 558 | 304 | 20 | 69.8 | 7.3 | 15.2 | 31 | 5% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 30% | 1.00/1.00/1.00 |
| `/services/fractional-caio-retainer` | service | 584 | 329 | 26 | 53.1 | 9.0 | 12.7 | 34 | 15% | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 23% | 1.00/0.00/1.00 |
| `/styleguide` (n/g) | static | 643 | 364 | 36 | 68.5 | 6.2 | 10.1 | 30 | 3% | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 11% | - |
| `/terms` | static | 213 | 199 | 13 | 55.3 | 9.4 | 15.3 | 28 | 0% | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 15% | 1.00/1.00/1.00 |

