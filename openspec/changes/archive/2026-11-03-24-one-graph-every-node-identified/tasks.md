# Tasks

## 1. Find out why there are two blocks before merging them

- [x] 1.1 `git log --follow` on `site/src/components/common/Breadcrumbs.astro` and `git log -S BreadcrumbList` trace why the component writes a script of its own; the finding is in `proposal.md`
- [x] 1.2 Confirm nothing forces a second script: every page that renders `Breadcrumbs.astro` also renders `JsonLd.astro`, no layout renders either, and the three routes without a graph render no breadcrumbs

## 2. One graph, every node identified

- [x] 2.1 `breadcrumbNode` takes `${site}${path}#breadcrumb` and `faqNode(site, path, items)` takes `${site}${path}#faqpage` with `isPartOf` its WebPage, in `site/src/utils/jsonld.mjs`
- [x] 2.2 Every page-node builder except the home page's writes `breadcrumb`, and `webPageNode` writes `hasPart` when told the page hosts an FAQ
- [x] 2.3 `Breadcrumbs.astro` renders the trail only, and each of the 28 pages that render it builds `breadcrumbNode` from the `crumbs` it passes
- [x] 2.4 `site/src/utils/jsonld-graph.test.mjs` holds the composed graph of every page family to unique ids, resolving references and the walk from the page node to its breadcrumbs and its FAQ

## 3. The gate becomes as strong as the rule

- [x] 3.1 `npm run gate:jsonld` fails more than one script, a node with no `@id`, a shared `@id`, a reference to nothing and a graph-less route off the named list
- [x] 3.2 `GRAPH_EXEMPT` names `/404`, `/search` and `/styleguide` with a reason each
- [x] 3.3 The summary line counts the routes, scripts and nodes read, and a run that read no graph fails
- [x] 3.4 `site/scripts/jsonld-specimens.mjs` plants one specimen for each way the rule breaks, and `npm run test:smoke` carries a family for each

## 4. Proof in the built output

- [x] 4.1 One script per page and an `@id` on every node, read from `dist/` for every page type
- [x] 4.2 A machine-written post and a human-written post carry the same node list and id shapes

## 5. Calibration Gate

- [x] 5.1 `npm run test:smoke` proves every guard family can still fail
- [x] 5.2 Run the Calibration Gate and commit the report it generates for this change
