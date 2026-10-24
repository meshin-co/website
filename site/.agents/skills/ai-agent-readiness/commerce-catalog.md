Optional, unscored by the scanner, and meaningless without a commerce backend. Publish only if the site sells something.

The Agentic Commerce Protocol (ACP, https://agenticcommerce.dev) lets an AI agent buy goods or services from a merchant. The Universal Commerce Protocol (UCP, https://ucp.dev/specification/overview/) lets an agent pay for content, such as premium articles or data feeds. Agents read one JSON discovery document per protocol to find the commerce API. A site that sells something gets agent-initiated orders and payments without a custom integration.

## Requirements

### ACP: `/.well-known/acp.json`

- Serve JSON at `/.well-known/acp.json` with HTTP 200.
- `protocol.name`: required, the string `"acp"`.
- `protocol.version`: required, the ACP version your API implements.
- `api_base_url`: required, an absolute HTTP(S) URL of your ACP API.
- `transports`: required, a non-empty array of supported transport types.
- `capabilities.services`: required, a non-empty array of offered services.

```json
{
  "protocol": { "name": "acp", "version": "2026-01-30" },
  "api_base_url": "https://example.com/api/acp",
  "transports": ["rest"],
  "capabilities": { "services": ["checkout"] }
}
```

The version, transport and service values above are examples. Copy the values your backend implements from the ACP spec.

### UCP: `/.well-known/ucp`

- Serve JSON at `/.well-known/ucp` with HTTP 200. The path has no file extension.
- `protocol_version`, `services`, `capabilities`, `endpoints`: all four required.
- Every spec URL and schema URL referenced in the document MUST be reachable.

Paywall example: an agent pays to read a premium article.

```json
{
  "protocol_version": "2026-01-11",
  "services": [{ "name": "content-access", "spec": "https://ucp.dev/specification/overview/" }],
  "capabilities": [{ "name": "article.read", "schema": "https://example.com/schema/read.json" }],
  "endpoints": {
    "checkout": "https://example.com/api/ucp/checkout",
    "catalog": "https://example.com/api/ucp/catalog"
  }
}
```

The object shapes inside `services`, `capabilities` and `endpoints` are examples. Take the exact member names from the UCP specification.

## How to serve it on a static site

Both documents are plain JSON. Put each in the public directory under `.well-known/`: `acp.json`, and `ucp` with no extension. The `ucp` file needs `Content-Type: application/json`. On Cloudflare Pages, add a rule for `/.well-known/ucp` in the `_headers` file. On other static hosts, use that host's header rule. Every URL in the documents must point to a live API. A static site has no such API. Serve the documents only if a separate checkout or paywall service exists, and host it on a Worker, a function or another origin.

## When not to publish it

The documents advertise an API that agents will call with real money. Publish ACP only when the `api_base_url` endpoints accept orders now. Publish UCP only when the `endpoints` accept payment and return the content. If you sell nothing, publish neither. A card for a shop that does not exist makes agents fail, retry and report the site as broken.

## Verify

```sh
curl -si https://example.com/.well-known/acp.json
curl -si https://example.com/.well-known/ucp
```

Expect `HTTP/2 200` and `content-type: application/json` for both. Then scan:

```sh
curl -s -X POST https://isitagentready.com/api/scan \
  -H 'content-type: application/json' \
  -d '{"url": "https://example.com"}'
```

- `checks.commerce.acp.status` must read `"pass"`.
- `checks.commerce.ucp.status` must read `"pass"`.
