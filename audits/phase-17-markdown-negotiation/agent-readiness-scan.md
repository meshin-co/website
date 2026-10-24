# Agent-readiness scan after the markdown handler

Generated-from: c48941b

Measured 2026-10-24 by `POST https://isitagentready.com/api/scan` with
`{"url":"https://meshin.co"}`, after the edge handler shipped.

**Level 4.** The run before this one, recorded in
`audits/phase-15-agent-readiness/agent-readiness-scan.md`, read level 2.

| Check                                      | Before | After |
| ------------------------------------------ | ------ | ----- |
| `contentAccessibility.markdownNegotiation` | fail   | pass  |

Nothing else moved: `robotsTxt`, `sitemap`, `linkHeaders`, `robotsTxtAiRules`, `contentSignals`,
`apiCatalog` and `ard` were already passing, `webBotAuth` and the five `commerce.*` checks remain
neutral, and nine checks still fail because the services behind them do not exist: `dnsAid`,
`oauthDiscovery`, `oauthProtectedResource`, `authMd`, `mcpServerCard`, `a2aAgentCard`,
`agentSkills`, `webMcp`, `personalAgentProtocol`. Publishing a card for a service that does not
answer is the one thing the agent-readiness skill forbids, so they stay failing.

Measured on the live origin the same day:

- `GET https://meshin.co/` with `accept: text/markdown` answers `200`,
  `content-type: text/markdown; charset=utf-8`, `content-location: /index.md`, `vary: Accept`,
  and 3109 bytes byte-identical to `dist/index.md`.
- The same URL without that header answers `200 text/html; charset=utf-8`, and every security
  header from `_headers` is still present, including the CSP and HSTS: the handler passes
  non-markdown requests through to the assets untouched.
- `npm run smoke:prod https://meshin.co` reports 21 of 21 checks passing.

One defect was found by this live run and fixed before the handler was final: `HEAD` on the home
page answered `text/html` while `GET` answered `text/markdown`, because the first version
negotiated only on `GET`. A `HEAD` that disagrees with its own `GET` misinforms the client that
asked, so `HEAD` now returns the headers `GET` would send, with no body.
