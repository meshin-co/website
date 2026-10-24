# Answer the same URL in markdown when an agent asks for it

## Why

The scan at `isitagentready.com` names one requirement above level 2:
`contentAccessibility.markdownNegotiation`. Its probe is a single request, recorded on 2026-10-24:
`GET https://meshin.co` with `accept: text/markdown`, and the answer was
`content-type: text/html; charset=utf-8`.

The site already writes a markdown sidecar for every page, and `/about.md` answers
`text/markdown; charset=utf-8` today. What was missing is that **one URL has to answer two media
types**, and no static file can do that: the choice happens per request, from a header.

Cloudflare's own feature for this needs a Pro plan, which L58 forbids. The owner asked for the
capability on 2026-10-24.

## What changes

**One bounded piece of edge code ships in the build.** `site/scripts/markdown-negotiation.mjs` is copied into
the build as `dist/_worker.js`, which Cloudflare Pages runs in front of the static assets. When a `GET` carries
`text/markdown` in `Accept`, it serves the sidecar the build already wrote for that route, with
`content-type: text/markdown; charset=utf-8`, `content-location` naming the sidecar, and `Accept`
added to `Vary`. Everything else passes through untouched.

**It cannot cost a page.** A route with no sidecar falls through to HTML rather than 404. A request
that is not a `GET` is never rewritten. Anything thrown inside the handler is caught and the
request is served from the assets, so an edge failure costs the markdown, never the response. Nine
tests hold those rules, driving the handler with a fake asset binding.

**The rule it lives under is written down, not implied.** Row L60 records the decision and its
bounds, and the hard rule in `AGENTS.md` changes from "no Pages Function" to this one named
exception, so the next reader does not have to guess whether an edge runtime is allowed.

**It is gated in two places, because one is not observable.** `npm run gate:agents` fails when the
build ships no handler, or ships one with no home sidecar to serve, with specimen
`agents-markdown-handler-gone`. The negotiation itself is invisible to a static file server, so
`npm run smoke:prod` asserts it against the live origin, which takes the production smoke from 20
checks to 21.

## What this does not change

No form, no mail, no state, no third-party call, no cookie, no client JavaScript: the handler runs
at the edge, not in the browser, so the blocking budgets in L13 are untouched. The Lighthouse gate
measures the built files through the local gate server, which does not run the handler, so its
scores are unaffected and the 100/100/100/100 bar still applies to the same tree.
