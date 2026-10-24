# What an AI agent finds when it arrives

## Why

A scan of `https://isitagentready.com/api/scan` against the live site on 2026-10-24 returned
`level: 1, levelName: "Basic Web Presence"`. Three checks passed — `discoverability.robotsTxt`,
`discoverability.sitemap`, `botAccessControl.robotsTxtAiRules`. Fourteen failed, five are
`neutral` because the scanner does not judge this site to be commerce, and one,
`botAccessControl.webBotAuth`, is `neutral` because this site sends no outbound bot. The single
requirement the scanner names for level 2 is Content Signals in `robots.txt`.

The same day measured two platform settings that override anything the build publishes. Cloudflare
Bot Preference Sync was prepending a managed block to `robots.txt`: the served file was 246 lines
against 116 in `site/dist/robots.txt`, carrying `Content-Signal: search=yes,ai-train=no,use=reference`
and `Disallow: /` for a list of AI crawlers, which contradicted the `Allow: /` lines below it for ten
agents. The owner turned that off, and the served file is now byte-identical to the build. A second
switch still stands: nine crawlers — `GPTBot`, `ClaudeBot`, `CCBot`, `Amazonbot`, `Bytespider`,
`anthropic-ai`, `Claude-Web`, `cohere-ai`, `Diffbot` — answer 403 at the edge, before `robots.txt` is
read. Thirteen others, including every search-facing agent, answer 200.

The owner's goal is maximum visibility and adoption across AI systems and search. That decides the
content of the signal: this site asks to be trained on, searched, and quoted.

## What changes

**The site states its AI preferences instead of leaving them unsaid.** `robots.txt` gains
`Content-Signal: search=yes, ai-train=yes, ai-input=yes` on the group that applies to every agent.
Silence is not permission in the Content Signals model: an agent that reads no signal is told
nothing, and the default it applies is its own.

**The machine endpoints this site already serves become discoverable as endpoints.** It publishes
`/openapi.json` describing the JSON resources that exist today — `/feed.json`, the per-collection
feeds, the search index shards — and `/.well-known/api-catalog` in `application/linkset+json`
pointing at that document and at the documentation page. Nothing is catalogued that is not already
served and tested.

**The first response points at them.** The home page carries `Link` headers with
`rel="api-catalog"`, `rel="service-desc"` and `rel="describedby"`, so an agent needs no second guess
to find the machine layer. They are set in the headers file the build already emits, at no runtime
cost.

**A capability manifest, reachable more than one way.** `/.well-known/ai-catalog.json` plus the
`<link rel="ai-catalog">` head link and the `Agentmap:` line in `robots.txt`.

**Every guard that holds this true is proven able to fail.** A gate asserts the files exist in the
build, parse, carry the right media type, and reference only routes the build actually ships; each
rule gets a planted specimen.

## Out of scope

Refused on the honesty rule, which `site/.agents/skills/ai-agent-readiness.md` states: a published
card is a promise an agent acts on, so nothing is published without the service behind it.

- `auth.md`, OAuth discovery, OAuth protected-resource metadata, Personal Agent Protocol — this site
  has no accounts, no authorisation server and no protected resource.
- A2A agent card, agent skills index, MCP server card, DNS-AID records — this site runs no agent and
  no MCP server.
- Web Bot Auth — this site sends no outbound bot. The scanner already reads it `neutral`.
- The five commerce protocols — this site sells nothing through an agent.
- WebMCP — it is the only item that ships client JavaScript, and L13 holds the blocking budget at
  10 KB gzipped with the client script list fixed by a locked row.

Deferred to an owner decision, recorded as a gap row rather than silently dropped:

- **Markdown negotiation.** `Accept: text/markdown` must return markdown from the same URL. The
  Cloudflare feature that does it needs a Pro plan, which L58 forbids. The only free route is an edge
  function, which the hard rules in `AGENTS.md` exclude. The site already serves a `.md` sidecar for
  every page, which is reachable but does not satisfy the check.
- **The nine edge 403s.** Lifting them is a Cloudflare setting, not a change to this repository.
