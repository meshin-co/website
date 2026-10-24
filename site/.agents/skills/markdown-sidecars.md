# Keep the Markdown Sidecars Complete

Every indexable route serves a `.md` twin at `<route>.md`. It is the copy an answer engine reads
when it wants the text without the chrome, so a missing or stub sidecar is a page an LLM can
quote less accurately than a competitor's.

## Where each sidecar comes from

Collection leaves — post, faq, glossary, resource, service, case — are rendered by the Astro
endpoint `src/pages/[...slug].md.ts` from their own frontmatter and body.

Static pages and collection hubs are written by `scripts/generate-static-sidecars.mjs`, which runs
inside `npm run build` after `astro build`. The route set is `sidecarRoutes()` in
`src/utils/machine-text.mjs`, the union of `publicIndexableStaticPages()` and `collectionHubs()`.
That union exists so llms.txt keeps its own Hubs versus Pages split: a hub is an index of a
growing collection, a static page is a standalone document, and flattening the two would cost a
real signal for a machine reader.

It is a build step rather than an endpoint because it scrapes the real prose out of the built
`<main>` HTML with script, style and chrome stripped. An Astro endpoint cannot do that — during
SSG the order in which `dist` files appear is not guaranteed, so the page you want to read may not
exist yet when your endpoint runs.

Dates come from the same `siteLastmods()` chain the sitemap uses. The script throws rather than
fall back to build time, because a build-time date is a freshness lie (L28).

## What the gate proves

`npm run gate:machine` requires a sidecar for every route in `sidecarRoutes()` plus every
collection leaf, and inspects the content of each one: a title, a canonical matching its own
route, a parseable `Updated:` date, and a non-empty body. Existence alone is not a pass.
`scripts/date-agreement.mjs` then holds a static page to one date: its sidecar `Updated:` day, its
JSON-LD `dateModified` and its sitemap `lastmod` all name it, and the two instants are midnight UTC.

## Adding a page

A new static page appears in `publicIndexableStaticPages()` once its catalog row carries an
`updatedDate`, which means its sidecar, its `llms.txt` line, its sitemap entry with a real
`lastmod`, and its search entry all follow without another edit. If you find yourself
hand-adding the same route to a second list, that list is the bug.
