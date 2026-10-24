Optional, unscored by the scanner, and meaningless without a commerce backend. Publish only if the site takes payments.

Three protocols let an AI agent pay on behalf of its user. AP2 (Agent Payments Protocol, https://ap2-protocol.org/) uses cryptographically signed mandates and is announced in an A2A Agent Card. MPP (Machine Payment Protocol, https://mpp.dev, spec https://paymentauth.org/draft-payment-discovery-00.txt) announces payable endpoints in an OpenAPI document. x402 (https://x402.org, docs https://docs.x402.org) answers HTTP 402 with payment requirements that the agent fulfils. A site that takes payments gets agent buyers without a custom integration.

## Requirements

### AP2

- Needs an A2A Agent Card first: see `a2a-agent-card.md` in this library. Without it the scanner reports "AP2 not detected (no A2A Agent Card)".
- Add an entry to the card's `capabilities.extensions` with `uri` set to `https://github.com/google-agentic-commerce/AP2/tree/v0.1.0`.
- `params.roles`: your AP2 role: `merchant`, `shopper`, `credentials-provider` or `payment-processor`.
- Merchant agents MUST set `required` to `true`.

```json
{
  "uri": "https://github.com/google-agentic-commerce/AP2/tree/v0.1.0",
  "required": true,
  "params": { "roles": ["merchant"] }
}
```

### MPP: `/openapi.json`

- Serve `/openapi.json` at the site root with HTTP 200.
- Add an `x-payment-info` extension to every payable operation.
- `intent` (required): `charge` or `session`.
- `method` (required): `tempo`, `stripe`, `lightning` or `card`.
- `amount` (required). `currency`, `description` (optional).
- Top-level `x-service-info` with categories (optional).

Example `x-payment-info` value for the `get` operation on `/api/feed`:

```json
{ "intent": "charge", "method": "stripe", "amount": "0.01", "currency": "USD" }
```

### x402

- Add x402 payment middleware to the API routes: `@x402/express`, `@x402/hono` or `@x402/next`.
- Configure a facilitator URL and a wallet address.
- A protected route returns HTTP 402 with payment requirements, as below. Agents fulfil them automatically. Field names vary by x402 version: check https://docs.x402.org.

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "base",
      "maxAmountRequired": "10000",
      "resource": "https://example.com/api/feed",
      "payTo": "0xYourWalletAddress"
    }
  ]
}
```

## How to serve it on a static site

AP2 and MPP: the Agent Card and `openapi.json` are static files in the public directory. x402: a static site cannot do it. The middleware runs code on every request, so it needs a Node origin, a Worker or an edge function. On Cloudflare Pages, use a Pages Function. Settlement needs a third-party facilitator and a wallet.

## When not to publish it

Each document promises that a purchase works. Publish AP2 only after the A2A Agent Card exists and your backend handles signed mandates in the declared role. Publish `x-payment-info` only on operations that really charge the stated `amount`. Enable x402 only on routes that return paid content after settlement. If the site sells nothing, publish none of them.

## Verify

```sh
curl -si https://example.com/openapi.json
curl -si https://example.com/api/feed
curl -s -X POST https://isitagentready.com/api/scan \
  -H 'content-type: application/json' -d '{"url": "https://example.com"}'
```

The first returns 200 with `x-payment-info`. The second returns `HTTP/2 402` and a body like the example above. The scan checks:

- `checks.commerce.ap2.status` must read `"pass"`; it reads `"neutral"` on a site the scanner does not judge to be commerce.
- `checks.commerce.mpp.status` must read `"pass"`.
- `checks.commerce.x402.status` must read `"pass"`.
- AP2 has no scanner path here: it reads "AP2 not detected" until the card carries the extension.
