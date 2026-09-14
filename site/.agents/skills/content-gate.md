# Run the Content Gate

Two halves, both mandatory. `docs/CONTENT-GATE.md` is the authoritative row spec; this file is
how the gate is run and extended. A page that passes one half and fails the other does not
ship, and neither half can excuse the other.

## Half A — mechanical

Run `node scripts/content-gate.mjs dist` from `site/`. It reads every derived route except
/404, /search and /styleguide, judges each page under a profile (article, offer, term,
faq-answer, pillar, page — chosen by route prefix), and exits non-zero on any finding.
Two numeric rules gate most articles: every paragraph ≤75 words with no single-sentence
paragraph over 45 words, and median sentence length ≤22 words per page with the longest
sentence ≤45 words (full row spec: `docs/CONTENT-GATE.md` rows 5–6). Inputs:

- `site/content-facts.json` — the facts file: one `targetQuery` row per route, plus the
  `numbers` allowlist. Every number on every page must be computed in code, sourced to a
  primary domain, or listed in that allowlist.
- `site/banned-phrases.json` — AI fingerprints, filler, hedges, marketing verbs. Zero matches.

The duplicate-sentence rule is cross-route: no sentence of 12 or more words may appear on two
different routes.

## Add a route row

When a route ships, add `"route": "target query"` to the `targetQuery` object in
`site/content-facts.json`. Rules:

- The query must appear in the H1 and inside the first 100 words of body text.
- Queries are lowercase buyer phrasing a person would actually type, never marketing
  phrasing.
- Generated routes (pagination) are exempt by pattern in the gate script, not by row.

## Profiles

Per-family rows live in `docs/CONTENT-GATE.md` (articles carry the fullest set; offers drop
the article-only rows; terms and FAQ answers run a reduced set). The judge composition per
family is in the same scope table.

## Semantic core (L48)

`node scripts/content-gate.mjs dist` also runs `scripts/semantic-core.mjs`'s `checkFindings()`
as its last step — one call, no separate npm script. That call:

- Regenerates `docs/SEMANTIC-CORE.md`'s generated table in memory and diffs it against the
  committed file, failing with the exact drifted routes if they differ. A stale doc cannot pass
  `gate:content`, and `gate:content` is a CI step (L36) — so it cannot pass CI either.
- Confirms every `content-facts.json` `targetQuery` row maps to a built route and every gated
  route has a row (orphans in both directions), and that every built `<title>` follows its
  family's title grammar.
- Confirms every buyer-prompt "Must win" route (docs/SEMANTIC-CORE.md's 30 buyer prompts,
  PRD §17.3) is actually built, every quoted "Passage" is still a literal substring of its
  cited route's rendered text, and every GAP absence-claim (for example, "Israel" appears on
  no built page) still holds.

To regenerate the doc after adding, removing or reclassifying a route: run
`node scripts/semantic-core.mjs` from `site/` (writes `docs/SEMANTIC-CORE.md`), then
`node scripts/semantic-core.mjs --check dist` to confirm it is now clean before committing.
A new route family needs a `FAMILY_BY_PREFIX` entry and a matching `FAMILY_GRAMMAR` row in
`scripts/semantic-core.mjs` before regenerating, or it silently falls into the wrong family's
title grammar.

## Half B — judged

After Half A is green, run the six-judge panel (judge-panel.md). Half A first, always, so
judges never spend attention on mechanical faults.

## Honesty rows

No number, client name, metric, testimonial or credential ships without a confirmed row in
`docs/COPY-CHECKLIST.md`. Unknown owner facts become a checklist row, never page copy
(L6–L12, L24).

## Trap

A throwaway preview route enters the derived route set and widens every gate — content,
Lighthouse, budgets, sitemap. Delete scratch pages before the audited build
(docs/FRONTEND-EXCELLENCE-ISSUES.md).
