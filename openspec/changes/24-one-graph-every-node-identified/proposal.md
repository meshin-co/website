# One graph per page, and every node in it identified

## Why

`AGENTS.md` states the structured-data rule in one sentence: one JSON-LD `@graph` per page, every node
carries an `@id`, every referenced `@id` resolves, and CI validates it. A build of `main` on 2026-11-02
broke the first two halves and `npm run gate:jsonld` passed: 108 of 112 pages shipped two
`application/ld+json` scripts, and 119 graph nodes carried no `@id`. The gate printed
`jsonld: 109 of 112 routes carry a graph` and exited 0, on that build and on the repaired one alike. The
defect is site-wide and older than the unattended writer; a generated post and a human-written one have
the same shape.

## What was found

Measured on that build, 112 routes:

- 108 pages shipped two scripts: the page graph from `site/src/components/common/JsonLd.astro` and a
  second one from `site/src/components/common/Breadcrumbs.astro`. The home page shipped one. `/404`,
  `/search` and `/styleguide` shipped none.
- The 119 nodes without an `@id` were the BreadcrumbList on all 108 pages that have one and the FAQPage
  that 11 posts and services embed.
- The gate pooled every script of a page into one list, so a second script could not fail it, and it
  checked an `@id` only where one existed, so a node without one could not fail it either.

The unattended writer's post `/blog/fractional-caio-vs-full-time-caio-cost` and the human-written post
`/blog/evals-in-ci-for-llm-agents` have the same shape.

**How it got there.** In phase 3 (`f9c27d7`, 2026-09-08) 23 pages built their BreadcrumbList with
`breadcrumbNode` inside their own graph, and no page rendered `Breadcrumbs.astro`, which the AstroWind
template had left behind carrying a script of its own. On 2026-09-13 `9f1068b` rewrote the component to
draw the visible trail from a `crumbs` array and to emit the matching graph itself, and 20 of those
pages dropped `breadcrumbNode`. By `184ea4f` the same day all 27 pages rendered the component and none
called the builder; its message reads "single BreadcrumbList per page, gate-enforced". Locked row L29
states the aim: the visible trail and its structured data share one source.

**Whether merging is safe.** The merge was deliberate in aim and accidental in effect. No constraint
required a second script: every page that renders the component also renders `JsonLd.astro`, no layout
renders either, and the three routes without a graph render no breadcrumbs. What the component did solve
is that the trail and its data cannot be built from two different arrays, and merging has to keep that.

## What changes

**One script per page, written by one component.** `Breadcrumbs.astro` renders the visible trail and
nothing else. Each of the 28 pages that render it builds one `crumbs` array and hands it to both
`<Breadcrumbs crumbs={crumbs} />` and `breadcrumbNode(site, crumbs)`, so the trail and its data still
come from one source.

**Every node carries an `@id`.** `breadcrumbNode` takes `${site}${path}#breadcrumb` for the page its
trail ends at, and `faqNode(site, path, items)` takes `${site}${path}#faqpage`, the shape `faqPageNode`,
`webPageNode` and `postNode` already use. An id is a function of the origin and the route alone.

**The page node reaches both.** Every page-node builder except the home page's writes `breadcrumb`
pointing at the page's BreadcrumbList, and `webPageNode` writes `hasPart` pointing at the FAQPage when
told the page hosts one, which points back with `isPartOf`, the way BlogPosting already points at its
WebPage.

**The gate is as strong as the rule.** `npm run gate:jsonld` fails a page with more than one script, a
graph node with no `@id` or one that shares an `@id`, a reference that resolves to nothing, a route
with no graph that is not on the named list, and a run that read no graph. The named list is
`GRAPH_EXEMPT`, three `noindex` utility routes added on 2026-09-12 in `bddaafb`: `/404`, `/search` and
`/styleguide`, each with the reason it ships no graph. Its summary line counts the routes, scripts and
nodes it read.

**Six guards, each with a planted specimen.** `site/scripts/jsonld-specimens.mjs` plants a breadcrumb
list moved into a second script, a node stripped of its `@id`, an id declared twice, a reference to
nothing, a route with no graph and a build with no graph at all. `npm run test:smoke` carries one family
for each.

## What this does not change

Which nodes a page emits is untouched: every page keeps the same node types, and no property of an
existing node changes beyond the new `@id` values and the `breadcrumb` and `hasPart` links. Schema.org
validity beyond `@id` integrity is not tested here. The three utility routes stay without a graph; they
are `noindex` and no consumer reads one. The visible breadcrumb trail is unchanged. On the built output
the HTML grows by 10279 bytes across 112 pages and gzips 4996 bytes smaller, so the byte budgets are
not in play. No gate compares the visible trail with the graph's names; today they agree on all 108
pages that render a trail, and that comparison is a separate rule this change does not state.
