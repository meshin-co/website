# Make a site readable by AI agents

Twenty machine-facing protocols an agent looks for, each in its own file under
`site/.agents/skills/ai-agent-readiness/`. The library is written to be copied into any website
project unchanged: every example uses `example.com`, and nothing in it assumes this repository.

Read the one file for the protocol in hand. Read this page first only to decide **which** files
apply.

## The rule that governs all of them

A machine-readable file is a promise another program will act on. Publishing a card for a service
that does not exist is worse than publishing nothing: an agent reads the card, calls what it
names, and fails. Publish an item only when the thing behind it is real.

That rule decides most of the list. A site with no accounts publishes no `auth.md` and no OAuth
metadata. A site with no running agent publishes no A2A card, no skills index and no DNS records.
A site with no MCP server publishes no server card. A site that sells nothing publishes none of
the five commerce documents — the scanner marks those `neutral`, not `fail`, for exactly this
reason.

## What any static site can publish today

| File                      | What it gets you                                                               | Cost                            |
| ------------------------- | ------------------------------------------------------------------------------ | ------------------------------- |
| `content-signals.md`      | States whether AI may train on, search, and quote the content                  | A line in `robots.txt`          |
| `link-headers.md`         | Points agents at the machine-readable resources from the first response        | A headers rule                  |
| `api-catalog.md`          | Lists the JSON endpoints the site already serves, with a real OpenAPI document | Two static files                |
| `ard.md`                  | A capability manifest reachable five different ways                            | A static file plus a head link  |
| `markdown-negotiation.md` | Clean text instead of scraped HTML                                             | Needs edge logic or a paid plan |

## What needs a running service first

`a2a-agent-card.md`, `agent-skills-index.md`, `mcp-server-card.md`, `auth-md.md`,
`oauth-discovery.md`, `oauth-protected-resource.md`, `personal-agent-protocol.md`,
`dns-aid.md`, `web-bot-auth.md`, `webmcp.md`, `commerce-catalog.md`, `commerce-payments.md`.

`webmcp.md` is the only item that ships client JavaScript; weigh it against the site's byte budget
before shipping, and measure the added bytes afterwards rather than estimating them.

## Two switches that override everything you write

A platform can rewrite `robots.txt` and can refuse a crawler before any file is read. On
Cloudflare, Bot Preference Sync prepends a managed block carrying `ai-train=no` and `Disallow: /`
for a list of AI crawlers, and the AI-bot blocking setting returns **403 at the edge**, which
happens before `robots.txt` is fetched at all. Measured on this project on 2026-10-24: nine
crawlers answered 403 while thirteen answered 200, and the served `robots.txt` was 246 lines
against 116 in the build. Check both switches before trusting any file in this library.

## Measure, never assume

One scan returns every check at once:

```
curl -s -X POST https://isitagentready.com/api/scan \
  -H 'content-type: application/json' -d '{"url": "https://example.com"}'
```

The response carries `level`, `levelName`, `nextLevel` with the requirements for the next step, and
`checks.<group>.<item>.status` reading `pass`, `fail` or `neutral`. Each file names its own key.
Each check also carries an `evidence` array naming every probe the scanner ran, including the URLs
it fetched — read that before believing a `fail`.
