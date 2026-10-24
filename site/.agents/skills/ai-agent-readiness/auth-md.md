# Auth.md

Auth.md is a markdown file served at `/auth.md` that tells AI bots how to register an account on behalf of a user and how to sign in afterwards. AI agents read it before they touch a login form. The site gains a documented, machine-readable entry path instead of agents guessing at HTML forms. Auth.md is not an RFC or a ratified standard. The path and the "markdown for agents" idea are the only checked parts; everything below that is a convention.

## Requirements

Checked by the scanner:

- Path: `/auth.md` on the site origin.
- HTTP status: `200`. A redirect, `404`, or an HTML login page fails.
- `Content-Type`: `text/markdown; charset=utf-8`. `text/plain` is tolerated by some readers; `text/html` is not.
- Body: non-empty markdown describing how bots register and sign in.

Convention (not a standard). State each item as a plain fact, not as prose a human must interpret:

- Registration endpoint: the full URL, HTTP method, and request body fields, each marked required or optional.
- On whose behalf: say that the bot acts for a user, and how the user consents (for example an approval URL the user opens).
- Result: what the bot receives (an API key, an OAuth access token, a session cookie), its lifetime, and how to renew it.
- Sign-in: the header or flow that uses the credential, for example `Authorization: Bearer {token}`.
- Authorisation server: if OAuth applies, link `/.well-known/oauth-authorization-server` or `/.well-known/openid-configuration`.
- Limits and contact: rate limits, forbidden actions, and an address for abuse reports.

Use headings and lists. Put exact URLs in code spans. Do not include real secrets or example tokens that look real.

## How to serve it on a static site

A static site can serve it. Put `auth.md` in the public directory of the build so it is emitted as `/auth.md`. Most static hosts guess the type from the extension; verify it. If the host returns `text/plain` or `application/octet-stream`, set it in a headers file. On Cloudflare Pages, add to the `_headers` file:

```
/auth.md
  Content-Type: text/markdown; charset=utf-8
```

The file is only text. The registration endpoint it describes needs a real backend (a Worker, a function, or an origin server). A static site cannot register anyone by itself.

## When not to publish it

Publish it only if the site has accounts that a bot can create, and a registration endpoint that works today. A site with no accounts, no API, and no authorisation server publishes nothing here. An agent that reads the file will attempt a flow that cannot complete, and may retry or report the site as broken. A content-only site passes this scan item by not having it; do not add a placeholder file to turn the check green.

## Verify

```
curl -sI https://example.com/auth.md | grep -iE '^(HTTP|content-type)'
curl -s https://example.com/auth.md
```

Expect `HTTP/2 200` and a `content-type` starting with `text/markdown`. Then run the scanner:

```
curl -s -X POST https://isitagentready.com/api/scan \
  -H 'content-type: application/json' \
  -d '{"url": "https://example.com"}'
```

The JSON path `checks.discovery.authMd.status` must read `"pass"`; read from a real scan response on 2026-10-24. Pair this item with `oauth-discovery.md` and `oauth-protected-resource.md` when the APIs are protected.
