# Owner brief: refine every text

Handed over 2026-09-14. This is the source command for Phase 4.7. Where it conflicts with a
locked row in `docs/plan/reference/locked-decisions.md`, the locked row wins and the conflict is
recorded in the phase file.

One deliberate deviation, stated by the owner when handing this over: step 2 of the brief asks for
a semantic core to be built. One already exists at `docs/SEMANTIC-CORE.md`, generated and
drift-gated (L48). Phase 4.7 uses and extends that document instead of starting a second one.

## Scope: audit everything before editing anything

Inventory every user-facing text in the repository first, not only the obvious pages. Include
markdown and mdx, HTML, component templates, TypeScript and JavaScript, configuration that
carries copy, metadata and SEO fields, page titles, meta descriptions, Open Graph and social
metadata, JSON-LD text, navigation, header and footer, buttons, calls to action, forms, labels,
tooltips, empty states, error and validation messages, notifications, dialogs, onboarding, help
text, feature descriptions, pricing text, FAQ content, testimonial copy, legal and informational
UI copy, accessibility text such as aria-labels and accessible names, image alt text and captions,
constants and data files, localization dictionaries, and CMS or content configuration.

Do not skip content because it is inconvenient, deeply nested, stored in code, dynamically
generated, or outside the normal content directories. The inventory must be exhaustive, and it
must be structured enough to prove nothing was skipped: file, location or component, text or
topic, purpose, audience, page context, keywords and entities, semantic topic, status.

Do not start editing until the full content surface is understood.

## Semantic core

Identify primary, secondary and supporting topics; primary and related entities; concepts and
terminology; user problems and needs; informational, commercial, navigational and transactional
intents; topic relationships; the questions users ask; subtopics that should be covered; the
terminology users and experts actually use; what distinguishes this site from competitors; and
which claims need authoritative support.

This is a topic and meaning model, not a keyword list. For each topic: what it means, why it
matters, which intent it serves, which pages should address it, which related concepts belong
near it, which pages cover it today, whether coverage is sufficient, whether terminology is
consistent, and which relationships are missing.

## Content-to-core mapping and gap analysis

Map the inventory against the core. Identify topics well covered, weakly covered and missing;
duplicate or competing content; pages targeting the same intent without reason; entities mentioned
inconsistently; concepts used without explanation; unanswered user questions; pages carrying
keywords but no topical depth; useful pages poorly connected to the structure; and content that is
irrelevant, outdated, redundant or low value. The goal is topical coverage and clear semantic
relationships, not keyword count.

## Reader-first quality

For every text: who reads this, what are they trying to do, what question are they asking, what
do they need to know, what decision are they making, what could confuse them, what is missing,
what is unnecessary. Rewrite rather than preserve weak wording. The result must be clear, useful,
accurate, specific, credible, easy to understand, right for its audience, naturally written, and
efficient without being shallow.

## Human voice

The writing must read as an experienced professional wrote it. Avoid generic introductions and
conclusions, empty statements, repetitive explanation, predictable transitions, formulaic
sentences, "moreover" and "furthermore" padding, repeated "not only X but also Y", rhetorical
question runs, artificially balanced sentences, three-item lists everywhere, repeated paragraph
shapes, unnecessary summaries, corporate buzzwords, marketing cliche, hollow superlatives,
adjective stacking, fake enthusiasm, fake empathy, benefit language without substance, polish
without naturalness, needlessly sophisticated vocabulary, and the same idea restated with
synonyms. Do not overcorrect into fake casualness: human is not sloppy. The voice is natural,
intelligent, professional, direct, credible.

## Remove machine fingerprints

Rewrite generic openings, "this guide will help you" phrasing, formulaic transitions, repetitive
section structures, predictable closing paragraphs, unnecessary key-takeaways blocks,
artificially symmetrical wording, repeated sentence templates, em dash and semicolon and
parenthesis and colon overuse, excessive bolding, artificially fragmented paragraphs, unnecessary
bullet lists, unnecessary pros and cons, obvious keyword insertion, terms repeated only for SEO,
filler statements, assistant-like wording, and self-referential AI language. The objective is
better writing, not detector evasion.

## SEO

Optimize for search intent, topic relevance, topical depth, semantic relationships, useful
headings, natural keyword use, related terminology, entity clarity, search questions, content
hierarchy, internal linking, page uniqueness, titles, meta descriptions, Open Graph descriptions
and structured data. Avoid keyword stuffing, unnatural repetition, variants inserted for ranking,
text written only to target keywords, SEO filler, thin coverage and over-optimization. A search
engine should understand the page because the page is well structured and meaningful.

## Semantic SEO

Think in entities, concepts, relationships, intent, coverage and context rather than keyword
placement. Make relationships explicit where they help: product to category, product to use case,
feature to problem, feature to benefit, problem to solution, concept to definition, service to
audience, entity to related entity, question to direct answer, topic to subtopics. Avoid isolated
keyword mentions with no context.

## Answer-engine optimization

Make content easy to understand, retrieve, summarize, and associate with the right entity, topic
and intent. State answers clearly, keep key information next to its question or heading, use
precise terminology, define unfamiliar concepts, separate facts from opinion and explanation from
recommendation, make relationships explicit, give useful examples, use structure where it helps,
and support claims with credible sources where sources are required. It must still read
human-first.

## Information architecture

Check whether content sits in the right place, considering page purpose, search intent, user
journey, topic hierarchy, navigation, internal linking, duplication, cannibalization, missing
pages, overloaded pages and weak supporting pages. Move, split, merge or restructure when that
materially improves the architecture. Do not preserve a bad structure because it exists.

## Consistency

Standardize product and feature names, terminology, capitalization, tone, vocabulary,
definitions, claims, numbers, formatting and calls to action. The same concept must not be
described in contradictory ways on different pages. Reused content is edited consistently
everywhere it appears.

## Accuracy

Never invent statistics, research, customer claims, testimonials, quotes, product capabilities,
comparisons, sources, certifications, awards, results or technical capabilities. Do not strengthen
uncertain claims. Flag anything unsupported, contradictory, ambiguous, outdated, misleading or
factually questionable, and verify it where possible. Preserve nuance.

## Preserve intent

Improve wording and structure without changing the underlying intent unless the original is
clearly wrong or strategically weak. Do not introduce new promises, capabilities, business claims,
opinions or positioning without evidence or explicit justification.

## Accessibility and usability

Review button labels, link text, form labels, error messages, instructions, empty states, alt
text, accessible names, tooltips and navigation labels. Make actions and meanings clear without
verbosity. No vague "click here" when a meaningful description is possible.

## Formatting discipline

Headings where hierarchy is real, paragraphs of reasonable length, lists only when information is
list-shaped, tables only when comparison benefits, sparing bold, clear CTA wording. No decorative
formatting. Do not turn prose into bullets because bullets are easy to generate.

## Two levels of review

Local: does the text read naturally, communicate its purpose, match its audience, carry useful
information, use the right terminology, serve the intended intent, avoid padding, avoid machine
patterns. Global: does it fit the semantic core, use terminology consistently, complement other
pages, avoid duplication, strengthen coverage, support the journey, support the SEO strategy,
strengthen entity and topic understanding. A text can be locally excellent and globally redundant.
Fix both.

## Completion check

Repeat the repository-wide search and compare against the initial inventory. Verify every
inventoried text was reviewed, every source file checked, no user-facing text skipped, shared
components reviewed, metadata reviewed, dynamic text reviewed, accessibility text reviewed,
duplicates reviewed consistently, core topics represented, intents covered, and no major gap left
unnoticed. The final pass must explicitly hunt text hidden in source, configuration, components,
constants and metadata.

## Final standard

Judge the whole system: human quality, professional quality, reader quality, semantic quality,
SEO quality, answer-engine quality, consistency, authenticity, completeness. The result must feel
like one professionally edited content system, not a pile of separately rewritten outputs.

Order of work: exhaustive inventory, semantic core, content mapping, gap analysis, structural
review, human editing, SEO optimization, answer-engine optimization, consistency pass, exhaustive
verification.
