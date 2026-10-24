# API catalog

An API catalog is a JSON document at `/.well-known/api-catalog` that lists the HTTP APIs a site offers. It is defined by [RFC 9727](https://www.rfc-editor.org/rfc/rfc9727) and uses the Linkset format of RFC 9264. AI agents and crawlers fetch one known URL and learn where each API's machine-readable description and human documentation live. The site gains automatic discovery with no guessing and no scraping.

## Requirements

- Path: `/.well-known/api-catalog`, on the site origin.
- HTTP status: `200`.
- `Content-Type: application/linkset+json`.
- Body: one JSON object with a `linkset` array. One entry per API.
- Each entry has an `anchor`: the absolute URL of the API (its base URL or entry point).
- Each entry has link relations, each an array of objects with `href`:
  - `service-desc`: the OpenAPI document for this API. Required.
  - `service-doc`: the human documentation page. Required.
  - `status`: a health endpoint. Optional.
- `type` on a relation object is optional. It gives the media type of the target.
- Examples: [RFC 9727 Appendix A](https://www.rfc-editor.org/rfc/rfc9727#appendix-A).

```json
{
  "linkset": [
    {
      "anchor": "https://example.com/api",
      "service-desc": [
        {
          "href": "https://example.com/api/openapi.json",
          "type": "application/openapi+json"
        }
      ],
      "service-doc": [{ "href": "https://example.com/docs/api", "type": "text/html" }],
      "status": [{ "href": "https://example.com/api/health", "type": "application/json" }]
    }
  ]
}
```

## How to serve it on a static site

1. Create a file named `api-catalog`, with no extension, inside a `.well-known` directory in the public folder of the build.
2. Add a headers rule that sets `Content-Type: application/linkset+json` for that path. Static hosts guess the type from the file extension. A file with no extension gets `application/octet-stream` or `text/plain`, and the check fails.
3. On Cloudflare Pages, add this to the `_headers` file in the build output:

```
/.well-known/api-catalog
  Content-Type: application/linkset+json
```

A static site has no classic API. It may still serve JSON endpoints: feeds, a search index, a sitemap in JSON. These are HTTP JSON resources and may be catalogued, if a real OpenAPI document describes them and the `service-doc` link resolves to a real page. Write the OpenAPI document by hand and publish it at the `service-desc` URL.

## When not to publish it

- No machine-readable endpoint exists: skip this check. Do not fake it.
- `anchor` names an endpoint that returns 404: do not publish.
- `service-desc` points at a spec nobody wrote or maintains: do not publish.
- `service-doc` points at a page that does not exist: do not publish.
- `status` points at an endpoint that does not report real health: omit it. It is optional.

Agents act on this file. A catalog entry for a missing API sends them to a dead end.

## Verify

```
curl -sI https://example.com/.well-known/api-catalog
curl -s https://example.com/.well-known/api-catalog | python3 -m json.tool
```

The first command must show `HTTP/2 200` and `content-type: application/linkset+json`. The second must print the `linkset` array without a parse error.

Scanner: `POST https://isitagentready.com/api/scan` with `{"url": "https://example.com"}`. The value at `checks.discovery.apiCatalog.status` must be `"pass"`.
