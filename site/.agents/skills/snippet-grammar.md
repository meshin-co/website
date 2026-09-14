# Write a Snippet a Search Engine Will Print

Titles, meta descriptions and social cards are the only copy most people ever read. Rows L42
and L43 bind them: one source for every card tag, whole-sentence descriptions inside
120-160 characters, and never a mid-clause ellipsis.

## The rules

Every page's Twitter Card is built from the same title/description/image Open Graph already
computed — `Metadata.astro` derives `twitter:title`, `twitter:description`, `twitter:image` and
`twitter:image:alt` from `buildOpenGraph()`'s output, once, for every family. Never add a
per-page Twitter override; if OG is right, Twitter is right.

No title or meta description is ever truncated with an ellipsis, mid-clause or otherwise.

- FAQ meta descriptions (`faqDescription` in `src/utils/faq-meta.mjs`) are a full sentence of
  120–160 characters, never the raw "first sentence of the answer": a first sentence already in
  range ships verbatim; a short one is padded by prepending the question, then further live
  answer sentences, until it clears the floor; an over-ceiling sentence is cut only at a comma or
  coordinating-conjunction boundary (never mid-word, never leaving a trailing "and"/"or"/"but").
  A hand-authored `description:` frontmatter override always wins over the computed default —
  use it when the mechanical rule cannot produce a coherent sentence (see
  `can-you-get-us-iso-iec-42001-certified-or-just-a-working-system.md` for a real example). The
  faq collection schema in `content.config.ts` refines the computed default and fails the build
  naming `description` when neither the override nor the mechanical rule clears 120–160 chars.
- FAQ `<title>`/`og:title` use the full question when it fits inside 58 characters (70 minus the
  ` — meshin.co` suffix). A longer question needs a hand-authored `shortTitle:` frontmatter
  field — the `<h1>` still shows the full question, only the title tag and OG title shorten.
  `pageTitle()`'s clause-boundary fallback (comma/`and`/`or`/`but` boundary, no ellipsis, no
  trailing conjunction) only fires when a `shortTitle` is missing; every FAQ entry needing one
  should carry it rather than rely on the fallback.
- `clauseTrim()` in `src/utils/faq-meta.mjs` is the one shared truncation primitive for both
  rules above. A specimen proving the description floor can fail lives at
  `tests/guard-mutations/fixtures/faq-description-too-short.md`, wired into
  `scripts/mutation-smoke.mjs`'s `faq-description-floor` family.
