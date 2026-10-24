# The agent interfaces this build ships

Four machine files exist so that an AI agent arriving at the site can find what it can call, and
on what terms. They are build outputs: verify them in `dist/`, never in source.

| Route                          | Written by                      | What it says                                                                      |
| ------------------------------ | ------------------------------- | --------------------------------------------------------------------------------- |
| `/robots.txt`                  | `scripts/gen-robots.mjs`        | `Content-Signal` per group, and `Agentmap:` naming the capability manifest        |
| `/openapi.json`                | `scripts/gen-openapi.mjs`       | Every JSON resource the build ships, as OpenAPI 3.1                               |
| `/.well-known/api-catalog`     | `scripts/gen-agent-catalog.mjs` | An RFC 9727 linkset: `service-desc` to the document, `service-doc` to `/llms.txt` |
| `/.well-known/ai-catalog.json` | `scripts/gen-agent-catalog.mjs` | The ARD capability manifest, one entry per machine entry point                    |

`dist/_headers` carries the `Content-Signal` response header on every response, the three `Link`
headers on `/` and the media type for the extensionless catalog. `CommonMeta.astro` carries
`<link rel="ai-catalog">`, which is how an agent finds the capability manifest.

The signal is stated twice: as a response header and as a directive in every `robots.txt` group.
Both read `CONTENT_SIGNAL` from the headers generator, so they cannot be typed apart, and the gate
fails when they differ. Lighthouse rejected the directive as unknown until 13.1.0 added
`content-signal` to its safelist; the gate pins 13.5.0 through an `overrides` entry, because
`@lhci/cli@0.15.1` is the newest release and still depends on 12.6.1.

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

- a build whose responses declare no `Content-Signal`, declare two, or leave `search`, `ai-train`
  or `ai-input` unsaid
- a `robots.txt` group with no directive, with more than one, or with a value the header does not
  repeat word for word
- an OpenAPI path that is not shipped, or a shipped JSON route the document omits
- a linkset with no anchor or a missing service link, or any link target not shipped
- a manifest with no entries, a repeated identifier, or an entry URL not shipped
- a `Link` rule that is not on `/` exactly, a malformed `Link` value, a missing relation, or a
  target not shipped
- a head link naming a manifest the build does not ship, or no head link at all

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
and `Disallow: /`, and `ai_bots_protection` in the zone's bot settings was `block`, which answered
403 to nine crawlers before any file was read. Both are off now, and all 22 crawlers in the
register answer 200. Compare the live file against
`dist/robots.txt` byte for byte before concluding anything about what agents see.
