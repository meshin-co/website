# Make every route own every surface it is owed, and prove it

## Why

The site now writes its own articles. The owner's instruction was that every sitemap entry,
breadcrumb, structured-data node and every other search and answer-engine surface the site has
built must work for a generated article exactly as it does for a hand-written one, and that this
must never be missed anywhere. Checking that by hand once is a report. He asked for a guarantee.

The existing gates each check one surface across the build. None of them asks the question from the
route's side: what is this route owed, and does it have all of it. Measured on the build of
2026-11-02, by removing one surface from one route at a time and running the gates that read the
build, the result was:

- 1,209 single-surface removals across 112 routes; the gate suite failed on 781 and stayed green
  on 428
- the entry of a collection could drop out of its search shard, lose its `og:image` tag, lose the
  card file the tag points at, lose its `<link rel="alternate" type="text/markdown">` or its feed
  `<link>`, and every gate stayed green: 0 of 108 search-shard removals, 0 of 112 `og:image`
  removals, 0 of 50 card-file removals, 0 of 80 markdown-link removals and 0 of 75 entry feed-link
  removals were noticed
- two of the five collection-newest entries could drop out of the merged feed unnoticed
- `/blog/tags` could drop out of `llms.txt` unnoticed

Separately, `npm run gate:machine` printed `no live entry in case; entry coverage was not checked
for it`. A check that examined nothing said so on stdout and passed. The sitemap lastmod check in the same script walks a list derived from the build and passes when that list is empty, so a build that expects no lastmod at all reads the same as a build whose lastmods are all present.

## What changes

**A new gate, `npm run gate:parity`, asks the question from the route's side.** It derives what
each built route is from the build and the collection configuration, looks up the surfaces that kind
is owed, and fails naming the route and the surface for each one it lacks. The kinds are entry,
collection hub, public static page, tag index, taxonomy archive, pagination page, declared
exception and withheld route. The eleven surfaces are the sitemap entry with a lastmod, the
markdown sidecar, the sidecar `<link>`, the `llms.txt` line, the place in the collection's llms
file, the full text in `llms-full.txt`, the item in the collection feed, the feed `<link>`, the
place in the merged feed, the search-shard entry and the social card. The gate prints how many routes
it derived, how many owed cells it checked and how many it found present.

**Nothing is listed by path.** A route's kind is derived from its shape under a collection base
taken from the collection configuration, and from whether its built page is noindex. A new
collection, or a new entry, is owed everything the day it exists.

**The exceptions are one small register.** `site/src/utils/route-exceptions.mjs` declares the three
routes that carry less, `/404`, `/search` and `/styleguide`, and the one collection with no live
entry, `case`, each with its reason. The gate counts them in its summary. A declaration for a
route that no longer builds, for a page that is now indexable, or for a collection that now holds an
entry, is itself a finding. `NOINDEX_STATIC_PAGES` is now read from this register, so the sitemap,
`llms.txt` and sidecar generators and the gate share one list instead of two.

**The silent skip is closed.** `gate:machine` no longer prints that entry coverage was not
checked. A collection with no live entry that is not declared empty is a finding, a declared empty
collection is counted with its name on stdout, and a build in which no sitemap lastmod was expected now says so as a finding instead of passing.

## Not in scope

- JSON-LD. Change 24 owns the single graph and its gate; this change does not read or alter it.
- What any generator emits. No surface is added to or removed from any page.
- `<link rel="alternate" type="text/markdown">` on static pages. Static pages ship a sidecar and are
  served it by content negotiation, but the page layout has never advertised it in the head. That is
  recorded here as the owed set of a static page, not changed.

## Impact

- New: `site/scripts/route-parity-gate.mjs`, `route-parity.mjs`, `route-kinds.mjs`,
  `head-tags.mjs`, `site/src/utils/route-exceptions.mjs`, six specimens in
  `site/scripts/parity-specimens.mjs` and their `test:smoke` families.
- Changed: `site/scripts/machine.mjs`, `site/src/utils/machine-text.mjs`,
  `site/src/utils/machine-links.mjs`, the machine scene fixture, `package.json` and `ci.yml`, and `site/scripts/editorial-gate.mjs`, whose copy inventory now skips `route-exceptions.mjs` because the reasons in it are read by gates and never shipped on a page.
