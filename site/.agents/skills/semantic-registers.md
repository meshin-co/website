# Keep the Semantic Registers True

`docs/SEMANTIC-CORE.md` carries three generated registers between the `REGISTERS` markers. They
are the vocabulary the whole corpus is written against, so they are derived from the content and
never hand-edited.

## Regenerating

    npm run assets:registers    # rewrites the block in docs/SEMANTIC-CORE.md
    npm run gate:registers      # fails when the committed block no longer matches the content
    npm run assets:gaps         # rewrites audits/phase-4.7/gaps.md from the ledger and registers

`gate:registers` is the drift guard. Adding, renaming or redefining a glossary term changes the
registers, so run `assets:registers` and commit the result in the same commit as the term.

The generators are thin: `scripts/generate-registers.mjs` and `scripts/generate-gaps.mjs` read the
content and the build, while the logic they call lives in `scripts/registers.mjs` (registers and
drift) and `scripts/editorial-gaps.mjs` (grouping, orphans, rendering), which is where the tests
point.

**Never run prettier on `docs/SEMANTIC-CORE.md`.** `docs/` sits outside the checked scope, and
reformatting the generated tables breaks both drift gates at once — `gate:registers` and the
`doc-drift` half of `gate:content`, which reported 102 findings when this happened on
2026-09-14. The fix is to regenerate, not to reformat: `node scripts/semantic-core.mjs` then
`npm run assets:registers`.

## What each register means

- **Entity register** — one owning route per entity, plus the count of other routes that mention
  it. An entity with zero inbound mentions is either a page nothing needs or a concept the writing
  avoids naming.
- **Concept register** — a concept is defined on exactly one page. Every other page links to that
  page instead of redefining it. The definition shown is the term's `shortDefinition`.
- **Topic relationships** — read from each term's `relatedTerms`, never inferred. A `relatedTerms`
  entry naming a term that does not exist throws rather than rendering a dangling row, so a typo
  fails the generator instead of shipping.

## Reading the gap report

`audits/phase-4.7/gaps.md` combines four measured lists: the editorial ledger's state, concepts
used without a link to their definition, entities with no inbound mentions, and the buyer prompts
whose GAP register row says no route owns them.

A mention only counts inside body prose: `prosePassages()` keeps `<p>` and `<li>` text and drops
`<script>` (JSON-LD names every concept), `<nav>` (breadcrumbs), every heading (a tag page's H1 is
the tag name), and anchor text (already a link, just to somewhere else). Word boundaries exclude
hyphens, so the tag slug `evals-in-ci` is not a use of `Evals`. Taxonomy hub leads are dropped
too, because the template injects the term. Sampling five raw findings on 2026-09-14 showed all
five of those classes were false positives: the count fell 105 to 44, and the survivors are body
prose with no link to the definition.

The unlinked-concept list is an opportunity list, not a defect list. Linking every mention would
over-link; the phase decision is first mention per page. Noindex utility routes (`/404`,
`/search`, `/styleguide`, and the search shard page) are excluded, because nothing there competes
for a query.

Buyer-prompt gaps need owner facts or a new page. They stay `owner-blocked` in Phase 4.7 and feed
the Phase 6 content plan.
