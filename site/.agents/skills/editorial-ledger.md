# Keep the Editorial Ledger Honest

`npm run gate:editorial` builds the text inventory Phase 4.7 works from and checks three things.
It writes `audits/phase-4.7/inventory.json` and fails while any of them is outstanding.

## What it checks

1. **Every row dispositioned.** A row's `status` must be `rewritten`, `verified`, or
   `owner-blocked` with a `reason`. A fresh row is `unreviewed`, so the gate is red until the pass
   is done.
2. **Shipped text traces to a source row.** A paragraph in `dist/**/*.html` that matches no
   source string means copy was authored somewhere the extractors do not look. That is the check
   that makes "nothing was skipped" mechanical rather than asserted.
3. **Source copy reaches a page.** A string in the repo that no page renders is dead copy. The
   first real finding was `src/data/author/dmitri.md`, whose body prose ships nowhere — only its
   frontmatter `bio` is rendered.

## Where rows come from

Four extractors in `scripts/editorial-inventory.mjs`, never a hand-written list: collection
frontmatter parsed as real YAML plus bodies, `.astro` text nodes and prose-shaped attributes,
quoted string constants in `src/data`, `src/utils`, `src/pages` and `src/components`, and the
rendered text of every route in `dist`. One string used in several files collapses to one row that
lists every usage, so a fix lands everywhere at once.

Copy is decided by **value shape**, never by field name: more than one word, contains a letter, is
not a date or URL. A name-based allowlist was tried first and missed `shortDefinition`,
`definition`, and every component prop carrying prose.

## Changing an extractor

Calibrate against the real corpus and keep a precision control. Measured on 2026-09-14, the
untraceable count fell 674 → 75 through six fixes, each one a defect in the extractor rather than
in the site: undecoded HTML entities, markdown syntax inside the comparison, comparing against
`<main>` while titles ship in `<head>`, a character class that hid every string containing an
apostrophe, top-level-only frontmatter reading (a post's `faq:` list was invisible), and
whitespace left before punctuation by inline-link stripping.

Two classes are excluded on purpose, each with a test proving real prose still fails: render-
composed metadata (`08 Sept 2026 · 6 min read · AI governance`, tag slug runs) and bare hostnames
rendered from source URLs.

A number this gate prints is only worth reporting if you have sampled it. Both original checks
looked healthy while being wrong: the first `unrowed` check compared the build against a ledger
that already contained the build's own rows, so it could only ever print 0.

## Dispositioning a row

Edit `audits/phase-4.7/inventory.json`. Re-running keeps the disposition of any text that has not
changed, and resets a text that has, because the disposition was about the old words.

Unknown owner facts are `owner-blocked` with the reason, and the same fact goes on
`docs/COPY-CHECKLIST.md`. Never guess an owner fact to clear a row.
