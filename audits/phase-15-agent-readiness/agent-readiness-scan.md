# Agent readiness, measured

Generated-from: 9ce5c01

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

- `dist/robots.txt` carries `Content-Signal: search=yes, ai-train=yes, ai-input=yes` on all 23
  user-agent groups, and an `Agentmap:` line naming the capability manifest.
- `dist/openapi.json` describes 8 JSON routes: `/feed.json` and the seven search shards.
- `dist/.well-known/api-catalog` is a linkset with an anchor, a `service-desc` and a `service-doc`.
- `dist/.well-known/ai-catalog.json` lists 18 entries, each one a file the build ships.
- `dist/_headers` carries three `Link` headers on `/` and the linkset media type.

## After

To be recorded once the owner publishes. The targets are `botAccessControl.contentSignals`,
`discoverability.linkHeaders`, `discovery.apiCatalog` and `discovery.ard` reading `"pass"`, and
`level` reading 2 or higher. Nine crawlers answered 403 at the edge on 2026-10-24, which no change
in this repository can lift.
