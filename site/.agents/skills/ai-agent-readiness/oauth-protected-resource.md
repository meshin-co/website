# OAuth Protected Resource Metadata

OAuth Protected Resource Metadata is a JSON document, defined by [RFC 9728](https://www.rfc-editor.org/rfc/rfc9728), that names an API (the resource) and the authorisation servers whose tokens it accepts. AI agents read it to learn how to authenticate against the API before they call it. The site gains agents that find the right authorisation server from the resource alone.

## Requirements

- Path: `/.well-known/oauth-protected-resource`.
- HTTP status: `200`.
- `Content-Type`: `application/json`.
- Required fields:
  - `resource`: the resource identifier, an `https` URL with no fragment. It MUST be the URL of the protected API, and clients compare it with the URL they requested.
  - `authorization_servers`: array of issuer URLs of OAuth 2.0 or OIDC authorisation servers. Each must serve discovery metadata (see `oauth-discovery.md`).
- Optional: `scopes_supported` (array of scope strings). Other RFC 9728 fields such as `bearer_methods_supported` and `resource_documentation` are also optional.
- Optional, on `401` responses from the API: a `WWW-Authenticate` header carrying `resource_metadata`, the URL of this document:

```
WWW-Authenticate: Bearer resource_metadata="https://example.com/.well-known/oauth-protected-resource"
```

Minimal document:

```json
{
  "resource": "https://example.com/api",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["read", "write"]
}
```

## How to serve it on a static site

A static file works for the document: place `oauth-protected-resource` (no extension) under a `.well-known` directory in the public directory, and set `Content-Type: application/json`. On Cloudflare Pages use the `_headers` file:

```
/.well-known/oauth-protected-resource
  Content-Type: application/json
```

A static site cannot emit the `WWW-Authenticate` header on `401` responses, because it has no API that returns `401`. That header needs code at the API: a Worker, a function, or an origin server. On Cloudflare, use a Worker to serve the metadata and to set the header, with Cloudflare Access as the authorisation server. The header is optional; the document alone satisfies the scan.

## When not to publish it

Publish it only when the resource is a real API that rejects unauthenticated calls, and at least one listed authorisation server really issues tokens for it. A site with no accounts, no API, and no authorisation server publishes none of this. An agent that reads the document will attempt a flow that cannot complete. Do not list an authorisation server you do not operate or trust.

## Verify

```
curl -si https://example.com/.well-known/oauth-protected-resource
curl -si https://example.com/api | grep -i '^www-authenticate'
```

Expect `200`, `application/json`, and a body with `resource` and `authorization_servers`. The second command applies only if the API returns `401` without a token. Then:

```
curl -s -X POST https://isitagentready.com/api/scan \
  -H 'content-type: application/json' \
  -d '{"url": "https://example.com"}'
```

`checks.discovery.oauthProtectedResource.status` must read `"pass"`.
