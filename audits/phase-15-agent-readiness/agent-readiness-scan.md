# Agent readiness, measured

Generated-from: e6b3936

`POST https://isitagentready.com/api/scan` with `{"url": "https://meshin.co"}`.

## Before, 2026-10-24, against the live origin

`level: 1`, `levelName: "Basic Web Presence"`. Three pass, fourteen fail, six neutral.

| Check                                      | Status  | What the scanner said                                |
| ------------------------------------------ | ------- | ---------------------------------------------------- |
| `discoverability.robotsTxt`                | pass    | robots.txt exists with valid format                  |
| `discoverability.sitemap`                  | pass    | sitemap.xml exists with valid structure              |
| `discoverability.linkHeaders`              | fail    | No Link headers found on target page                 |
| `discoverability.dnsAid`                   | fail    | DNS-AID well-known entrypoint records not found      |
| `contentAccessibility.markdownNegotiation` | fail    | Site does not support Markdown for Agents            |
| `botAccessControl.robotsTxtAiRules`        | pass    | Found rules for AI bots                              |
| `botAccessControl.contentSignals`          | fail    | No Content Signals found in robots.txt               |
| `botAccessControl.webBotAuth`              | neutral | Web Bot Auth directory not found, informational only |
| `discovery.apiCatalog`                     | fail    | API Catalog not found                                |
| `discovery.oauthDiscovery`                 | fail    | No OAuth/OIDC discovery metadata found               |
| `discovery.oauthProtectedResource`         | fail    | No OAuth Protected Resource Metadata found           |
| `discovery.authMd`                         | fail    | auth.md not found                                    |
| `discovery.mcpServerCard`                  | fail    | MCP Server Card not found                            |
| `discovery.a2aAgentCard`                   | fail    | A2A Agent Card not found                             |
| `discovery.agentSkills`                    | fail    | Agent Skills index not found                         |
| `discovery.webMcp`                         | fail    | No WebMCP tools detected on page load                |
| `discovery.ard`                            | fail    | ARD capability manifest not found                    |
| `discovery.personalAgentProtocol`          | fail    | Personal Agent Protocol manifest not found           |
| `commerce.x402`                            | neutral | not a commerce site                                  |
| `commerce.mpp`                             | neutral | not a commerce site                                  |
| `commerce.ucp`                             | neutral | not a commerce site                                  |
| `commerce.acp`                             | neutral | not a commerce site                                  |
| `commerce.ap2`                             | neutral | no A2A Agent Card, not a commerce site               |

The scanner named one requirement for level 2: Content Signals in `robots.txt`.

## What this build changes, verified in `dist/`

`npm run gate:agents` reads 0 findings against the built output. Measured there:

- `dist/_headers` carries `Content-Signal: search=yes, ai-input=yes, ai-train=yes` on every
  response, and all 23 `robots.txt` groups carry the same value as a directive. The directive was
  dropped on 2026-10-24 because Lighthouse 12.6.1 called it unknown and scored SEO 0.92 on all 26
  routes, then restored the same day once the gate was lifted to Lighthouse 13.5.0, whose safelist
  accepts it. Row G45 is closed.
- `dist/openapi.json` describes 8 JSON routes: `/feed.json` and the seven search shards.
- `dist/.well-known/api-catalog` is a linkset with an anchor, a `service-desc` and a `service-doc`.
- `dist/.well-known/ai-catalog.json` lists 18 entries, each one a file the build ships.
- `dist/_headers` carries three `Link` headers on `/` and the linkset media type.

## After, 2026-10-24, against the live origin

`level: 2`, `levelName: "Bot-Aware"`. Eight pass where three did, five neutral, ten fail.

| Check                             | Before | After |
| --------------------------------- | ------ | ----- |
| `botAccessControl.contentSignals` | fail   | pass  |
| `discoverability.linkHeaders`     | fail   | pass  |
| `discovery.apiCatalog`            | fail   | pass  |
| `discovery.ard`                   | fail   | pass  |

Measured on the same request: the live `robots.txt` is byte-identical to `dist/robots.txt`, 139
lines with 23 `Content-Signal` directives; the home page answers `content-signal: search=yes,
ai-input=yes, ai-train=yes` and three `link` headers; `/openapi.json`,
`/.well-known/api-catalog` and `/.well-known/ai-catalog.json` answer 200 with
`application/vnd.oai.openapi+json;version=3.1`, `application/linkset+json` and
`application/json`.

The crawler register was re-run against the live origin on the same day: **22 of 22 answer 200**.
The nine that answered 403 did so because `ai_bots_protection` in the zone's bot settings read
`block`; it was set to `disabled`, and `ai_training` moved from `disallow` to `disabled` with it.

The ten remaining failures are the ones this site refuses to fake: `dnsAid`, `oauthDiscovery`,
`oauthProtectedResource`, `authMd`, `mcpServerCard`, `a2aAgentCard`, `agentSkills`, `webMcp`,
`personalAgentProtocol` — no accounts, no agent, no MCP server — and `markdownNegotiation`, which
the scanner names as the single requirement for level 3 and which needs edge logic this site's
hard rules exclude.
