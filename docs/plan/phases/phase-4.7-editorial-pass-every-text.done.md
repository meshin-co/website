# Phase 4.7 · Editorial pass over every text

Goal: every user-facing string on the site reads as one experienced person wrote it, serves a real
reader, and is placed where the semantic core says it belongs. Source brief:
`docs/briefs/refine-all-texts.md`. Evidence: `audits/phase-4.7/`.

The brief asks for a semantic core to be built. One exists — `docs/SEMANTIC-CORE.md`, generated
from `content-facts.json`, drift-gated by `semantic-core.mjs --check` inside `gate:content` (L48).
This phase reads and extends that document; it does not start a second one.

## What "every text" actually means here

Counted from the current tree, so the phase can be checked against a number rather than a feeling:

| Surface                  | Count                            | Where                                                                                                                                                             |
| ------------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collection entries       | 68                               | `site/src/data/{post,faq,glossary,resource,service,case}/*.md`                                                                                                    |
| Static pages             | 15                               | `site/src/pages/*.astro`                                                                                                                                          |
| Components carrying copy | 28                               | `site/src/components/**`, `site/src/layouts/**`                                                                                                                   |
| Copy in code and config  | 7                                | `home.ts`, `categories.mjs`, `tags.mjs`, `navigation.ts`, `config.yaml`, `content.config.ts`, `faq-meta.mjs`                                                      |
| Generated text           | —                                | `jsonld.mjs` names and descriptions, `machine-text.mjs` sidecars and llms lines, `feeds.mjs` titles and summaries, `og-template.mjs` card text, search shard text |
| Accessibility text       | 10 aria-labels, 0 alt attributes | `site/src`                                                                                                                                                        |
| Empty and edge states    | 10                               | tag, category, search, 404                                                                                                                                        |
| Routes rendered          | 105                              | derived from `dist/**/*.html`                                                                                                                                     |

Zero `alt` attributes is a finding, not a pass: the only images are the OG cards, which carry
`og:image:alt`. Any image added later needs alt text, so the inventory records the absence
explicitly rather than leaving it silent.

## 1. Exhaustive inventory (no edits in this step)

Build `audits/phase-4.7/inventory.json`, one row per distinct user-facing string, derived by a
script — never hand-listed — from four extractors: collection frontmatter and bodies, `.astro`
text nodes and attribute copy, string constants in `src/data` and `src/utils`, and the rendered
text of every route in `dist`.

Each row carries: `file`, `location` (component, frontmatter key, or route), `text`, `purpose`,
`audience`, `route context`, `entities`, `semantic topic`, `status`. Status starts as `unreviewed`
and ends as `rewritten`, `verified`, or `owner-blocked` with the reason.

The inventory is the phase's ledger. `scripts/editorial-gate.mjs` fails when any row is still
`unreviewed`, when a row's text no longer exists in the build, or when a string in the build has
no row — that last check is what makes "nothing skipped" mechanical instead of asserted.

Reused strings collapse to one row with every usage site listed, so a fix lands everywhere at once.

**Landed 2026-09-14, before any editing.** `npm run gate:editorial` builds the ledger from four
extractors and fails on all three checks; `site/.agents/skills/editorial-ledger.md` is the
procedure. Measured starting position: **1414 rows** across 105 routes, all `unreviewed`; **75** shipped
paragraphs tracing to no source row; **65** source strings no page renders. Calibration cut untraceable 674 to 75 and dead copy 264 to 65; every reduction was a defect in
my extractors, not in the site. The first confirmed real finding is
`src/data/author/dmitri.md`, whose body prose ships nowhere while only its frontmatter `bio`
renders. The gate is deliberately red until the pass is done, so it joins CI with CG-4.7, not
before.

## 2. Core extension, mapping, gap analysis

Extend `docs/SEMANTIC-CORE.md` with the layers the brief asks for and the existing document lacks:
entity register (primary and related entities with the pages that own them), concept register
(term, definition, the page that defines it, pages that may use it without defining it), intent
per route (already present) cross-checked against the buyer prompts, and topic relationships as
explicit pairs — service to audience, feature to problem, concept to definition, question to
answering route, topic to subtopics.

Then map inventory to core and write `audits/phase-4.7/gaps.md`: topics well covered, weakly
covered, missing; duplicate or competing pages; entities named inconsistently; concepts used
without a definition anywhere; user questions unanswered; pages with keywords but no depth; pages
disconnected from the structure; content that is outdated or low value.

The 8 GAP buyer prompts already registered in the core stay owner-blocked — they need facts only
the owner has. Everything else gets a disposition.

**Step 2 landed 2026-09-14.** `docs/SEMANTIC-CORE.md` now carries three generated registers
between `REGISTERS` markers — 30 entities with inbound mention counts, 30 concepts each defined by
exactly one page, and 30 declared topic relationships — drift-gated by `npm run gate:registers`
and documented in `site/.agents/skills/semantic-registers.md`. A `relatedTerms` entry naming a
term that does not exist throws instead of rendering a dangling row.

`audits/phase-4.7/gaps.md` is generated by `npm run assets:gaps` from the ledger and the
registers. Measured, read from the generated report and not computed: **37 unlinked concept uses** across 11
concepts (worst: Evals 9, AI register 6, AI governance 5). Five false-positive classes — JSON-LD,
breadcrumbs, headings, anchor text and hyphenated tag slugs — took the raw count from 105 to 53,
then the noindex and taxonomy-lead filters left 37; **zero** entities with no inbound mentions, so every
glossary page is reachable by name; **9 buyer prompts** whose GAP row says no route owns them, all
owner-blocked. The unlinked-concept list is an opportunity list — the phase decision is first
mention per page, not every mention.

## 3. Structural decisions before prose

Decide moves, merges, splits and deletions from the gap analysis, and record each with its reason
in the phase report. A route removal goes through `routes-removed.json` and `gate:routes` (L36); a
new route needs its content-facts row, sidecar, feed entry, llms line, search entry and JSON-LD
family, so the cost is stated before the decision, not discovered after.

Rewriting prose before this step means rewriting text that is about to move.

**Decided 2026-09-15: no structural change in this phase.** The gap analysis evidences no
duplicate or competing page, no cannibalised intent and no overloaded route. Moving, merging or
splitting a route would invalidate every visual baseline plus the sitemap, feed, llms and search
surfaces for a gain nothing in the data supports. The 9 buyer-prompt gaps that would need new
routes stay owner-blocked and feed Phase 6. Copy, titles, meta descriptions and internal links are
in scope; the route set is frozen at 105.

## 4. Editing, in dependency order

1. The 30 glossary definitions first — they are the concept register every other page cites.
2. The 3 services and the 5 resources — commercial intent, and the entity anchors for posts.
3. The 25 FAQ answers — highest citation surface, and they must agree with services on every claim.
4. The 4 posts and the 1 case study.
5. The 15 static pages, `/now` and `/contact` included.
6. Chrome last: navigation labels, buttons and CTAs, footer, empty states, 404, aria-labels,
   search placeholder — these are read most often and are shortest, so they are edited once the
   vocabulary they must match is settled.

Every edit respects the locked rows: no invented owner fact, client, metric, testimonial or
credential (L12, L18); prices stay off the site (L8); no numbered section labels (L9a); direct
engineering tone, numbers instead of adjectives; every claim that needs a source keeps one; the
content gate's sentence-length, banned-phrase and duplicate-sentence rules hold throughout.

Unknown facts become `TODO(owner)` rows in `docs/COPY-CHECKLIST.md`, never a plausible guess.

**Steps 4 to 6 landed 2026-09-15.** Eight agents on disjoint file sets did the editing, then the
remaining rows were reviewed by owner. Ledger: **1412 rows, 377 rewritten, 1035 verified, zero
unreviewed**; shipped text tracing to no source row **0**; source copy no page ships **9**, each
declared in `audits/phase-4.7/conditional-copy.json` with the state that renders it and a stale
check so the list cannot rot. 259 dispositions, all sealed against the text they reviewed.

Real defects found by the pass, not by the gate: `/terms` still said "the published prices" three
days after L8 removed every price; `/search`'s noscript fallback shipped "theglossary" and
"thequestions" because Astro drops a line-break-only text node before a tag; the `/faq` index
teaser cut answers mid-clause on a bare article or possessive; five service and resource pages
called the NIST AI RMF functions "areas"; the home page carried an unconfirmed "12 to 24 months"
retainer claim; `/styleguide`'s `<Hero>` had duplicate attributes so three demo strings never
rendered; and `src/data/author/dmitri.md` carried body prose no page renders, now deleted under
L40.

Eleven defects were in my own extractors, each fixed with a precision control: `\bnew [A-Z]`
matched the phrase "a new AI tool" and silently dropped a 154-word answer from the ledger; `\w+\(`
rejected prose citing "Article 6(1)"; array literals, template literals and assignment-form
constants were never scanned, which hid every category pillar body; test fixtures counted as dead
copy; `media` attributes and font stacks counted as copy; JSON-LD text did not count as shipped;
and a teaser that adds a full stop failed containment.

## 5. Machine-fingerprint and consistency sweep

Extend `scripts/prose-rules.mjs` with checks for the patterns the brief names that nothing
currently measures, each with a planted specimen proving it can fail:

- formulaic transitions (`moreover`, `furthermore`, `additionally`, `in conclusion`)
- `not only … but also` constructions
- three-item list runs and repeated paragraph shapes within a page
- em dash, semicolon, parenthesis and colon density per 1000 words
- bold density per page
- hollow superlatives and the adjective stack list already in `banned-phrases.json`, extended
- the same concept restated with synonyms inside one page
- terminology drift: a concept written two ways across the corpus

Thresholds are calibrated against the current corpus first and set where they catch real offenders
without punishing legitimate prose — a gate tuned on a synthetic fixture cannot fire on real
content.

## 6. Two-level review

Local review is the per-row pass in step 4. Global review is a separate read of the whole corpus
by family: terminology consistent, no page redundant against another, coverage strengthened,
journey intact, entity understanding improved. Findings that need a second opinion go to the
six-judge panel (`judge-panel.md`) with the same independence rules as Phase 4.

## 7. Make it the standard, not a one-off pass

An editorial pass that lives only in this phase decays the moment the next page is written. Every
rule this phase applies becomes one of three things, and nothing stays as prose in a phase file.

**New skill, `write-copy.md`** — the editorial standard a future agent reads before writing any
user-facing string. It carries: the voice (natural, intelligent, professional, direct, credible,
and what each of those excludes); the machine-fingerprint list with the checks that enforce each
item; the answer-first rule for `shortAnswer` and the first paragraph; sentence and paragraph
length limits with their measured thresholds; the source requirement; the `TODO(owner)` rule for
unknown facts; formatting discipline (a list only when the information is list-shaped, a table
only when comparison earns it, sparing bold); and the accessibility copy rules for labels, link
text, empty states and alt text. It names the gate that proves each rule so a reader can check
rather than trust.

**New skill, `place-a-new-text.md`** — where a new string belongs before it is written: which
route family owns the topic, which entity and concept registers it must reuse rather than
re-define, which existing page it must not duplicate, the `content-facts.json` row it needs, and
the six surfaces that follow automatically once it exists (sidecar, feed, llms line, search entry,
JSON-LD family, sitemap). Reading this before writing is what keeps the corpus one system.

**Extensions to `docs/SEMANTIC-CORE.md`** — the entity register, concept register and topic
relationships added in step 2 become permanent sections, generated where they can be derived and
hand-authored where they carry judgment, and they stay drift-gated by `semantic-core.mjs --check`
(L48) so the registers cannot silently fall behind the corpus.

**New locked rows** in `docs/plan/reference/locked-decisions.md`, so later phases cannot quietly
drop the standard:

- editorial voice and the machine-fingerprint ban, naming `prose-rules.mjs` as its enforcement
- one definition per concept, owned by exactly one page, reused everywhere else by link
- every new user-facing string enters the inventory ledger in the same commit that adds it
- terminology is standardized corpus-wide; a second spelling of a concept is a gate failure

**Updates to existing standards** — `content-gate.md` gains the new prose rules and their
thresholds; `add-collection-entry.md` and `add-or-restore-a-collection.md` gain a first step
pointing at `place-a-new-text.md` and `write-copy.md`; `AGENTS.md` hard rules gain one line: no
user-facing string ships without passing the editorial gate. `check-skills.mjs` already fails on a
skill naming a path that does not exist, so the new skills are checked like the rest (L49).

The test of this step is not that the documents exist. It is that a fresh session writing one new
FAQ answer, reading only `AGENTS.md` and the skills it points at, produces copy that passes
`gate:editorial` and `gate:content` on the first run.

## 8. Exhaustive verification

Re-run the extractors against the final build and diff against the opening inventory. The phase
cannot close while any row is `unreviewed`, any build string is unrowed, or any `TODO(owner)` is
undeclared in the copy checklist.

## Calibration Gate 4.7 — PASS 2026-09-15

`audits/phase-4.7/REPORT.md` reads **Result: PASS**: 54 of 54 route×form-factor rows at
100/100/100/100, every metric budget inside its cap, `check` 0, 588 unit tests, 696 Playwright on
darwin, 14/14 mutation families, and `html`, `links`, `content`, `orphans`, `machine`, `skills`,
`jsonld`, `plan`, `registers`, `editorial`, byte budgets and search budgets all exit 0.

The owner amended L13 to close it: mobile LCP budget 1850 ms rather than 1800, and `/styleguide`
out of the audited set as a development-only noindex page. The 100/100/100/100 score bar is
unchanged and still has no waiver path. What follows is the measurement history that led there.

## Calibration Gate 4.7 — measurement history

Everything green except the Lighthouse bar: `check` 0, 583 unit tests, 696 Playwright on darwin
twice, 14/14 mutation families, and `html`, `links`, `content`, `orphans`, `machine`, `skills`,
`jsonld`, `plan`, `registers`, `editorial`, byte budgets and search budgets all exit 0. Home page
14.8 KB gzip.

`audits/phase-4.7/REPORT.md` records **55 of 56 route×form-factor rows at 100/100/100/100**. Two
open items, both the same root cause and both needing an owner decision, because clearing either
one means amending a locked row:

1. **LCP 1803–1806 ms against our own 1800 ms budget** on five of 28 audited routes. The cause is
   63 KB of webfonts arriving on the simulated 1.47 Mbps mobile link; LCP tracks the swap repaint
   of the text. Two real optimisations landed first and are measured: the brand mark as a shared
   `<symbol>` (HTML 101 KB → 69 KB) and Plausible off the critical path (LCP 1806 → 1656 in
   isolation). Measured dead ends: inlining all CSS moved FCP 1055 → 904 and left LCP unchanged;
   `unicodeRange` did not re-subset the files; dropping the font preloads moved LCP to 1654 but
   FCP to 1500 and performance to 0.99; preloading only the body family gave LCP 1806 and FCP
   1206; Astro hoists preloads so head order cannot be changed from the layout.
   Options: amend **L39** to `font-display: optional` for the body face (LCP ≈1350, first visit
   paints in the metric-matched fallback), amend **L39** to two faces by dropping IBM Plex Sans 500
   (≈1670, nav and labels render at 400), or amend the budget row with the evidence that Chrome
   scores 100 at 1804 and Google's own "good" threshold is 2500.
2. **`/styleguide` mobile performance 99**, same LCP cause. It is a noindex internal demo page,
   excluded from the sitemap. The owner decides whether it belongs in the audited set at all.

## Calibration Gate 4.7

The standard gate (`docs/plan/reference/calibration-gate.md`) plus:

- `gate:editorial` green: every inventory row dispositioned, no unrowed build string
- the new prose rules green on all 105 routes, each proven able to fail
- `semantic-core.mjs --check` green against the extended core
- `gate:content`, `gate:machine`, `gate:jsonld`, `gate:links`, `gate:orphans`, `gate:routes` green
- Lighthouse 100/100/100/100 on the derived audited set, mobile and desktop
- `audits/phase-4.7/REPORT.md` generated, with the inventory ledger, the gap dispositions, the
  structural decisions and their reasons, and the owner-blocked list
- `docs/COPY-CHECKLIST.md` updated with every fact the owner still owes
- `write-copy.md` and `place-a-new-text.md` exist, `gate:skills` green over them, and the new
  locked rows are in `locked-decisions.md`
- the fresh-session test in step 7 actually run and its result recorded in the report

## Not in this phase

No design or layout change; no new route unless step 3 justifies it in writing; no new client JS;
no price anywhere; no invented fact; no launch work — Phase 5 stays untouched and runs after this.
