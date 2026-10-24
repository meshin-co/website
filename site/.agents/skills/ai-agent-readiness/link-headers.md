# Link response headers

A `Link` response header points from one resource to another and names the relationship. It is defined by [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288). [RFC 9727 Section 3](https://www.rfc-editor.org/rfc/rfc9727#section-3) uses it to advertise the API catalog. Agents read the headers of the homepage response, without parsing HTML, and learn where the machine-readable resources are. The site gains discovery from a single `HEAD` request.

## Requirements

- Return `Link` headers on the homepage response (`https://example.com/`).
- Each link points to a machine-readable resource.
- Use registered relation types:
  - `api-catalog`: the API catalog, `/.well-known/api-catalog`.
  - `service-desc`: a machine-readable description of a service, such as an OpenAPI document.
  - `service-doc`: human documentation of a service.
  - `describedby`: a resource that describes this one, such as a schema or metadata file.
- Grammar of one link: `<URI-reference>; rel="relation"`.
  - The URI reference sits in angle brackets. A bare path without brackets is invalid.
  - `rel` is a parameter. Quote its value.
  - `type="media/type"` is optional. It hints at the target media type.
  - `title="text"` is optional. It is a human label.
- A relative URI reference is resolved against the request URL. `</.well-known/api-catalog>` is correct.
- Several links: send repeated `Link` headers, or one header with comma-separated links. Both are valid.

```
Link: </.well-known/api-catalog>; rel="api-catalog"
Link: </openapi.json>; rel="service-desc"; type="application/openapi+json"
Link: </docs/api>; rel="service-doc"; title="API documentation"
```

The same, in one header:

```
Link: </.well-known/api-catalog>; rel="api-catalog", </docs/api>; rel="service-doc"
```

## How to serve it on a static site

Use the host's headers file. On Cloudflare Pages, put a `_headers` file in the build output and match the homepage by route pattern:

```
/
  Link: </.well-known/api-catalog>; rel="api-catalog"
  Link: </docs/api>; rel="service-doc"
```

`/` matches the homepage only. `/*` matches every route. The rule costs nothing at runtime and the headers apply to the built response. Cloudflare Transform Rules or a Worker also work and need no change to the origin, but they add a rule or a billed request per call. Other static hosts have their own file (`netlify.toml`, `vercel.json`). On a Node origin, set the header in the response handler.

## When not to publish it

Publish a link only if its target exists and returns 200. A `Link` header that points at a 404 is worse than no header: agents trust it and fail. Add `api-catalog` only after [the API catalog](./api-catalog.md) is live. Add `service-desc` only if the spec exists. Add `service-doc` only if the page exists.

## Verify

```
curl -sI https://example.com/ | grep -i '^link:'
```

Each line must show `<...>; rel="..."`. Then request each target with `curl -sI` and confirm `200`.

Scanner: `POST https://isitagentready.com/api/scan` with `{"url": "https://example.com"}`. The value at `checks.discoverability.linkHeaders.status` must be `"pass"`.
