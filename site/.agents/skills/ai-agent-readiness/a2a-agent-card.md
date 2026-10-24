An A2A Agent Card is a JSON document that describes an agent: who it is, where to call it, and what it can do. Other agents read it before they send work. It is defined by the [A2A Protocol Specification](https://a2a-protocol.org/latest/specification/) (AgentCard, section 4.4.1) and the [Agent Discovery](https://a2a-protocol.org/latest/topics/agent-discovery/) topic, which sets the well-known path (RFC 8615). A site that publishes a true card can be found and called by other agents without a human in the loop.

## Requirements

- Serve JSON at `/.well-known/agent-card.json` with HTTP 200 and `Content-Type: application/json`.
- `name`, `version`, `description`: strings. Human-readable identity and agent version (for example `"1.0.0"`).
- `supportedInterfaces`: array, first entry preferred. Each entry needs `url` (absolute HTTPS URL), `protocolBinding` (`JSONRPC`, `GRPC` or `HTTP+JSON`) and `protocolVersion` (for example `"1.0"`). `tenant` is optional. It names where to talk to the agent and over which transport.
- `capabilities`: object. All keys optional: `streaming`, `pushNotifications`, `extendedAgentCard` (booleans), `extensions` (array). Send `{}` if none.
- `skills`: array. Each skill needs `id`, `name`, `description` and `tags` (array of strings). `examples`, `inputModes`, `outputModes` are optional.
- `defaultInputModes`, `defaultOutputModes`: arrays of media types. Required by the spec.
- Optional: `provider` (`organization`, `url`), `documentationUrl`, `iconUrl`, `securitySchemes`, `securityRequirements`, `signatures`.

```json
{
  "name": "Example Agent",
  "version": "1.0.0",
  "description": "Answers questions about the published articles on example.com.",
  "supportedInterfaces": [
    {
      "url": "https://example.com/a2a",
      "protocolBinding": "JSONRPC",
      "protocolVersion": "1.0"
    }
  ],
  "capabilities": { "streaming": false, "pushNotifications": false },
  "defaultInputModes": ["text/plain"],
  "defaultOutputModes": ["text/plain"],
  "skills": [
    {
      "id": "article-search",
      "name": "Article search",
      "description": "Finds published articles that match a question.",
      "tags": ["search", "articles"]
    }
  ]
}
```

AP2 payments extension: a merchant, shopper, credentials provider or payment processor adds an `extensions` entry to `capabilities` with `uri` `https://github.com/google-agentic-commerce/AP2/tree/v0.1.0` and `params.roles` listing its role (`merchant`, `shopper`, `credentials-provider`, `payment-processor`). Set `required: true` for merchant agents. The rest is in `commerce-payments.md`.

## How to serve it on a static site

A static site can serve the card but cannot answer calls to it. Put the file in the public directory as `.well-known/agent-card.json`; it deploys at `/.well-known/agent-card.json`. On Cloudflare Pages, add a `_headers` rule for that path with `Content-Type: application/json` if the type is not inferred, and `Access-Control-Allow-Origin: *` so browser agents can read it. The `url` in `supportedInterfaces` must point at a live endpoint, such as a Cloudflare Worker built with the Agents SDK (A2A-compatible agents on Workers), or a route on a Node origin. Static hosting cannot be that endpoint.

## When not to publish it

A card is a promise that another agent will try to call. Publish it only when the endpoint in `supportedInterfaces` exists, speaks the declared `protocolBinding` and `protocolVersion`, and every listed skill works. A site with no agent behind it MUST NOT publish a card: callers will send requests that fail, or worse, trust invented skills. If you only have content to share, use an API catalog, an MCP server card or a skills index instead.

## Verify

```sh
curl -si https://example.com/.well-known/agent-card.json | head -20
curl -s https://example.com/.well-known/agent-card.json | jq '.supportedInterfaces[0].url'
```

Expect `HTTP/2 200`, `content-type: application/json` and the interface URL. Then run the scanner:

```sh
curl -s -X POST https://isitagentready.com/api/scan \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com"}' | jq '.checks.discovery.a2aAgentCard.status'
```

`checks.discovery.a2aAgentCard.status` MUST read `"pass"`.
