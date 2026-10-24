# Personal Agent Protocol (Poppy)

The Personal Agent Protocol, "Poppy" or PAP, defines how a person's AI agent works with a company on that person's behalf: discovery, sign-in, web browsing, APIs and conversations with a company agent. A company publishes one JSON document, `poppy.json`, at a well-known path. Personal agents read it first. Source: the public draft 0.2 at `https://personalagentprotocol.org/docs/0.2/spec`. It states that any part may change before a stable version. The scanner's own checks are not documented in any public source found; only its failing probe was observed, so this file separates spec text from scanner evidence.

## Requirements

Source: PAP draft 0.2, section 3. All URLs MUST be HTTPS.

- Path: `https://example.com/.well-known/poppy.json`, served over HTTPS. Redirects are allowed and each must go to HTTPS.
- `protocol_version` (required): `"0.2"`. An agent must not use a document whose `major.minor` it does not support.
- `organization` (required): `name` and `domain`. `domain` MUST be the host that served the document, after redirects.
- `auth`: required when `agent`, `apis`, `feedback` or `web.browser_session_endpoint` is present. `issuer` is the company's OAuth issuer, an HTTPS URL. Sign-in types `direct`, `device`, `mediated` each list `scopes`. `custom_scopes` is optional.
- One of `agent`, `apis` or `web` is required. `apis` is a list of `type` (`openapi` or `mcp`), `url` and `description`.
- `feedback.endpoint` and `extensions` are optional.
- The issuer must publish OAuth Authorization Server Metadata (RFC 8414) whose `issuer` equals `auth.issuer` exactly and whose `poppy_domains` lists `organization.domain`.
- The scanner probe, read off its output: `GET /.well-known/poppy.json` with `Accept: application/json`. It reports `manifestDetected` and `issuerValidation`. A missing manifest returns 404, `manifestDetected: false` and `issuerValidation: "notChecked"`.

```json
{
  "protocol_version": "0.2",
  "organization": { "name": "Example Co", "domain": "example.com" },
  "auth": {
    "issuer": "https://auth.example.com",
    "direct": { "scopes": ["poppy:read", "poppy:write"] }
  },
  "apis": [{ "type": "openapi", "url": "https://api.example.com/openapi.json", "description": "Orders and returns" }]
}
```

## How to serve it on a static site

The file is static JSON. Put `poppy.json` in `.well-known` in the public folder and serve it as `application/json`. A static site can stop there for the file. The file alone is not a working integration: the issuer, the OAuth endpoints and the APIs it names must run somewhere. The spec's own examples put these on separate hosts. Static hosting cannot serve OAuth token endpoints.

## When not to publish it

`poppy.json` is a claim that personal agents can sign users in to your company. The spec has agents fetch the issuer's metadata and reject the document when `issuer` or `poppy_domains` does not match. So something must issue and verify tokens first: a real OAuth authorization server with `token_endpoint` and `revocation_endpoint`, DPoP support (RFC 9449) and a `poppy_domains` entry for your domain. A site with no accounts, no API and no company agent has nothing to list. A document with an invented `issuer` fails the spec's checks and tells agents to send users to a host that cannot sign them in. Do not publish it for the scanner alone.

What `issuerValidation` does inside the scanner is not documented. For a present manifest it may check the issuer rules above. That is an inference, not measured. Run the scan against a real, valid manifest to see its value.

## Verify

```
curl -si -H 'Accept: application/json' https://example.com/.well-known/poppy.json
curl -s https://auth.example.com/.well-known/oauth-authorization-server | python3 -m json.tool
```

The first command must show `HTTP/2 200` and a JSON body whose `organization.domain` is `example.com`. In the second, `issuer` must equal `auth.issuer` and `poppy_domains` must contain `example.com`.

Scanner: `POST https://isitagentready.com/api/scan` with `{"url": "https://example.com"}`. The value at `checks.discovery.personalAgentProtocol.status` must be `"pass"`. The scanner's failure message is "Personal Agent Protocol manifest not found".
