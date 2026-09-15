# Write Copy for meshin.co

Read this before writing or editing any user-facing string: page prose, a frontmatter field, a
button label, a meta description, an aria-label. `place-a-new-text.md` decides where a new text
belongs; this file decides how it reads.

## The voice

Direct and engineering. A reader is a founder or an engineering leader deciding whether to spend
money. Numbers and dates instead of adjectives. The sentence a competitor could also write about
themselves is the sentence to cut.

Natural, intelligent, professional, credible — and none of those means casual. No fake warmth, no
exclamation, no "let's dive in".

## Answer first

`shortAnswer`, `shortDefinition` and the first paragraph of any page answer the question in the
first sentence. No preamble, no "that depends", no restating the question. If the honest answer is
conditional, give the common case first and the condition second.

This is also what an answer engine quotes, so each of those strings must stand alone without the
page around it.

## What the gates refuse

`npm run gate:content` fails the build on each of these, and each has a test proving it can fail:

- 52 banned phrases in `banned-phrases.json` (leverage, seamless, cutting-edge, world-class, …)
- formulaic transitions: moreover, furthermore, additionally, in conclusion, in summary, as such
- `not only X but also Y`
- guide preambles: "this guide will help you", "in this article we"
- hollow credentials: industry-leading, leading provider, leading expert, passionate about,
  thought leader
- semicolons and em dashes above 6 per 1000 words, once a page has at least 3
- more than one question sentence in a row
- a sentence over 45 words, a paragraph over 75 words
- the same sentence on two routes

Zero of the machine patterns exist in the corpus today. Keep it that way.

## Facts

Never invent an owner fact, client name, metric, testimonial, credential, price or date. Prices
stay off the site entirely (L8). An unknown fact leaves the existing wording alone and becomes a
row in `docs/COPY-CHECKLIST.md` naming exactly what is needed.

Every claim that needs a source carries one, and zod fails the build without `shortAnswer`,
`updatedDate` and at least one source on a post, term or service. Bump `updatedDate` when you
change prose.

## Structure

A heading where the hierarchy is real. A list only when the information is list-shaped — not
because three items were easy to generate. A table only when a comparison earns it. Bold sparingly.
No numbered section labels and no figure-number chips (L9a).

A page ends on its last real point or a concrete next step. No recap paragraph, no
key-takeaways block that repeats the body in shorter words.

## Accessibility copy

A label says what the control does. Never "click here", never a restatement of the visible text.
An `aria-label` exists to add what the visual label cannot carry, not to duplicate it. Alt text
describes what the image shows for someone who cannot see it; a decorative image takes `alt=""`.

## Terminology

One spelling per concept, everywhere: `evals`, `AI register`, `shadow AI`, `ISO/IEC 42001`,
`NIST AI RMF`, `EU AI Act`. A concept is defined on exactly one page — the one the concept
register in `docs/SEMANTIC-CORE.md` names — and every other page links to it rather than
redefining it.
