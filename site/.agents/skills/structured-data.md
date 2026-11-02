# Structured Data and the Entity Graph

One JSON-LD `@graph` per page, built by `site/src/utils/jsonld.mjs` and enforced by
`site/scripts/jsonld-gate.mjs` (`npm run gate:jsonld`).

## One graph, every node identified

A page ships exactly one `application/ld+json` script, written only by
`site/src/components/common/JsonLd.astro`; a component never emits its own, so a page that
renders `Breadcrumbs` builds `breadcrumbNode` from the same `crumbs`. Every node's `@id` is
`${site}${path}#<role>` (`#webpage`, `#post`, `#faqpage`, `#breadcrumb`), a pure function of
origin and route. The page node reaches the rest: `breadcrumb` on every route but `/`, and
`hasPart` to `#faqpage` when `webPageNode` gets `faq: true`. `gate:jsonld` refuses a second
script, a node with no `@id` or a shared one, a reference that resolves nowhere, a graph-less route
outside `GRAPH_EXEMPT` (`/404`, `/search`, `/styleguide`) and a run that read no graph;
`site/scripts/jsonld-specimens.mjs` plants each.

## Node and property contract

Besides that, the gate checks two closed, fail-on-unknown tables, both in that script:

- `ROUTE_TYPES` — which node `@type`s a route pattern must carry. An unmatched route pattern
  fails the whole route (`matches no known jsonld route family`), not a skip.
- `REQUIRED_PROPERTIES` — for each `@type` that can appear in `ROUTE_TYPES`, the properties a
  node of that type must carry; a reachable `@type` absent from the table fails closed too
  (`matches no known jsonld property family`). Only require a property every builder call that
  can emit that `@type` on a real page guarantees; a genuinely conditional field (an empty
  `relatedTerms`, an optional FAQ `sources`) stays out rather than forcing callers to fake it.

### Adding a family

1. Add or extend the builder in `jsonld.mjs` that emits the new `@type`.
2. Add the route pattern (or extend an existing one) in `ROUTE_TYPES`.
3. Add a `REQUIRED_PROPERTIES` row naming only the fields every real emission of that type
   carries.
4. Prove the property gate can fail: plant a fixture missing one required field and confirm
   `jsonld-gate.mjs` reports it, the way `tests/guard-mutations` does for the whole family.
5. Unit-test the builder in `jsonld.test.mjs` and add the page to `PAGE_FAMILIES` in
   `site/src/utils/jsonld-graph.test.mjs`, which checks ids, references and the breadcrumb walk.

### Entity links: `about` / `mentions`

`about` and `mentions` point at glossary `DefinedTerm` `@id`s (`${site}/glossary/{slug}#term`).
They are never hand-authored guesses — each is derived from something already in the content:

- **Authored, not derived:** a `DefinedTerm`'s `mentions` comes straight from its own
  `relatedTerms` frontmatter field, which content authors already curate. No text matching.
- **`about` (posts):** glossary term ids that are also present in the post's own `tags` —
  tags share the glossary's id vocabulary by convention (`ai-governance`, `eu-ai-act`,
  `shadow-ai`, `ai-register`), so an overlap is a real, author-declared relationship, not a
  coincidence.
- **`about` (services, resources):** glossary term names found via `findGlossaryMentions`
  (word-boundary, case-insensitive) against the entry's own pitch fields — `name`/`tagline`/
  `shortAnswer`/`description` for services, `name`/`description` for resources.
- **`mentions`:** the same word-boundary text match run against the entry's full body and
  structured detail (post body, service `forWhom`/`deliverables`/`process`/`schedule`/`faq`,
  resource `whatInside`/`howToUse`/body). An id already in `about` is never duplicated into
  `mentions`.

Pass the full published glossary list (`{ id, term }` pairs) as the builder's `terms` option;
omitting it yields no `about`/`mentions`, never a fabricated one. `findGlossaryMentions`, exported
from `jsonld.mjs` and unit-tested directly, is the one place this matching logic lives.

### `citation`, images and `mainEntityOfPage`

- `citation` mirrors a collection's own `sources` field (`CreativeWork` per source) on every
  builder whose collection carries `sources` — unconditional where the schema requires
  `sources.min(1)` (post, service, resource, glossary), conditional on non-empty where it is
  optional (FAQ).
- `logo`/`image`/`primaryImageOfPage` are always a dimensioned `ImageObject`
  (`imageObject()` helper), never a bare URL string. Dimensions come from the real asset
  (`og-default.png` is 1200×630 — verified with the file itself, not assumed) or from the
  satori OG render, which is always 1200×630.
- `mainEntityOfPage` only appears on `@type`s that are actually `CreativeWork` per schema.org
  (`BlogPosting`, resource `CreativeWork`/`SoftwareSourceCode`). Non-`CreativeWork` types that
  need a page/entity backlink (`Service`, `DefinedTerm`) get a companion `webPageNode(...)`
  with `mainEntity` pointing at them instead — the schema-correct inverse direction — rather
  than carrying an invalid property on the entity itself. Page types that already extend
  `WebPage` (`FAQPage`, `CollectionPage`, `ProfilePage`, `ContactPage`) carry `isPartOf`
  directly and never get a redundant separate `WebPage` node.
