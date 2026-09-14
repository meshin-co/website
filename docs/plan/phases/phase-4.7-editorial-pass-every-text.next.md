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
procedure. Measured starting position: **1548 rows** across 105 routes and 242 files, all
`unreviewed`; **75** shipped paragraphs tracing to no source row; **264** source strings no page
renders. The untraceable count fell 674 to 75 during calibration — every reduction was a defect in
my extractors, not in the site — and the first confirmed real finding is
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

## 3. Structural decisions before prose

Decide moves, merges, splits and deletions from the gap analysis, and record each with its reason
in the phase report. A route removal goes through `routes-removed.json` and `gate:routes` (L36); a
new route needs its content-facts row, sidecar, feed entry, llms line, search entry and JSON-LD
family, so the cost is stated before the decision, not discovered after.

Rewriting prose before this step means rewriting text that is about to move.

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
