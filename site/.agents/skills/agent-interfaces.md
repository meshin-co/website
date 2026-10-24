# The agent interfaces this build ships

Four machine files exist so that an AI agent arriving at the site can find what it can call, and
on what terms. They are build outputs: verify them in `dist/`, never in source.

| Route                          | Written by                      | What it says                                                                      |
| ------------------------------ | ------------------------------- | --------------------------------------------------------------------------------- |
| `/robots.txt`                  | `scripts/gen-robots.mjs`        | `Content-Signal` per group, and `Agentmap:` naming the capability manifest        |
| `/openapi.json`                | `scripts/gen-openapi.mjs`       | Every JSON resource the build ships, as OpenAPI 3.1                               |
| `/.well-known/api-catalog`     | `scripts/gen-agent-catalog.mjs` | An RFC 9727 linkset: `service-desc` to the document, `service-doc` to `/llms.txt` |
| `/.well-known/ai-catalog.json` | `scripts/gen-agent-catalog.mjs` | The ARD capability manifest, one entry per machine entry point                    |

`dist/_headers` carries the three `Link` headers on `/` and the media type for the extensionless
catalog. `CommonMeta.astro` carries `<link rel="ai-catalog">`, which must name the same manifest
as the `Agentmap:` line.

## Everything here is derived

No list of routes is typed out. `publicJsonRoutes()` walks the built output; the capability
manifest lists a file only when that file is in `dist`; the content signal is emitted per group by
the same loop that emits the groups. A hand-kept array would drift from the build within one
change, and the gate exists because that drift is invisible to a human reader.

`gate-routes.json` is excluded from the OpenAPI document by name: it is a harness artifact, not an
interface. If another internal JSON file ever lands in `dist`, exclude it the same way, with its
reason visible in the constant.

## The gate

`npm run gate:agents` (`scripts/agent-interfaces-gate.mjs`) reads `dist/` and fails on:

- a user-agent group with no `Content-Signal`, with more than one, or leaving `search`, `ai-train`
  or `ai-input` unsaid
- a `Sitemap:` or `Agentmap:` URL whose path is not shipped
- an OpenAPI path that is not shipped, or a shipped JSON route the document omits
- a linkset with no anchor or a missing service link, or any link target not shipped
- a manifest with no entries, a repeated identifier, or an entry URL not shipped
- a `Link` rule that is not on `/` exactly, a malformed `Link` value, a missing relation, or a
  target not shipped
- a head link naming a different manifest from the one `robots.txt` names

Five specimen families in `scripts/mutation-specimens.mjs` prove it can fail: `agents`,
`agents-openapi-drift`, `agents-manifest-dangles`, `agents-link-header-leaks`,
`agents-head-link-drifts`.

## Before adding a fifth interface

Read the matching file in `.agents/skills/ai-agent-readiness/`, which covers twenty protocols and
is written to be copied into another project unchanged. Its rule governs here: publish a card only
when the service behind it is real. This site has no accounts, no agent, no MCP server and nothing
to sell, so it publishes none of those cards, and
the proposal of the change `15-agent-readiness` records each refusal with its reason.

## Two switches that outrank the build

A platform can rewrite `robots.txt` and can refuse a crawler before any file is read. Measured
2026-10-24 on Cloudflare: Bot Preference Sync had been prepending 128 lines carrying `ai-train=no`
and `Disallow: /`, and nine crawlers still answer 403 at the edge. Compare the live file against
`dist/robots.txt` byte for byte before concluding anything about what agents see.
