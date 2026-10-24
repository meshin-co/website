# OAuth / OIDC discovery

OAuth authorization server metadata is a JSON document that tells a client where to authorise, where to get tokens, and which keys verify them. It is defined by [RFC 8414](https://www.rfc-editor.org/rfc/rfc8414) for OAuth 2.0 and by [OpenID Connect Discovery 1.0](http://openid.net/specs/openid-connect-discovery-1_0.html) for OIDC. AI agents read it before they authenticate against an API. The site gains agents that can start a login flow without hand-written configuration.

## Requirements

- Path: `/.well-known/openid-configuration` (OIDC) or `/.well-known/oauth-authorization-server` (OAuth 2.0). One is enough.
- HTTP status: `200`.
- `Content-Type`: `application/json`.
- Required fields:
  - `issuer`: the issuer URL, an `https` URL with no query or fragment. It MUST equal the origin (and path, if any) that serves the document. Clients compare the two and reject a mismatch.
  - `authorization_endpoint`: URL of the authorisation endpoint.
  - `token_endpoint`: URL of the token endpoint.
  - `jwks_uri`: URL of the JSON Web Key Set. It MUST resolve to a real key set (`{"keys": [...]}`), because clients fetch it before they trust any token signature.
- Also list `grant_types_supported` (array of strings, for example `authorization_code`, `refresh_token`, `client_credentials`) and `response_types_supported` (array, for example `code`).
- Optional: `scopes_supported`, `registration_endpoint`, `code_challenge_methods_supported`, `token_endpoint_auth_methods_supported`.

```json
{
  "issuer": "https://example.com",
  "authorization_endpoint": "https://example.com/oauth/authorize",
  "token_endpoint": "https://example.com/oauth/token",
  "jwks_uri": "https://example.com/.well-known/jwks.json",
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "response_types_supported": ["code"]
}
```

## How to serve it on a static site

A static file works for the document itself: place `openid-configuration` or `oauth-authorization-server` (no extension) under a `.well-known` directory in the public directory. Set the type to `application/json` in a headers file; on Cloudflare Pages use `_headers`:

```
/.well-known/oauth-authorization-server
  Content-Type: application/json
```

The document is only a pointer. The endpoints and the key set must exist and work, so you need an identity provider. On Cloudflare, Cloudflare Access can act as the identity provider, or a Worker can proxy the provider's own metadata under your origin. If you proxy, rewrite `issuer` to match your origin only when your origin really is the issuer; otherwise point to the provider's own discovery URL from `oauth-protected-resource.md`.

## When not to publish it

Publish it only when a real authorisation server exists, its endpoints answer, and `jwks_uri` returns keys. A site with no accounts, no API, and no authorisation server publishes none of this. An agent that reads the document will attempt a flow that cannot complete. Never copy an example document with placeholder URLs into production.

## Verify

```
curl -si https://example.com/.well-known/oauth-authorization-server
curl -s https://example.com/.well-known/openid-configuration | jq '.issuer, .jwks_uri'
curl -s "$(curl -s https://example.com/.well-known/openid-configuration | jq -r .jwks_uri)" | jq '.keys | length'
```

Expect `200`, `application/json`, an `issuer` equal to the origin, and a key count above 0. Then:

```
curl -s -X POST https://isitagentready.com/api/scan \
  -H 'content-type: application/json' \
  -d '{"url": "https://example.com"}'
```

`checks.discovery.oauthDiscovery.status` must read `"pass"`.
