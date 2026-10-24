Markdown content negotiation means the same URL returns HTML to browsers and clean markdown to clients that send `Accept: text/markdown`. AI agents read it; the site gains cheaper, more accurate extraction, because agents no longer parse dense HTML layouts. Cloudflare documents it as "Markdown for Agents": https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/. The scanner fails with "Site does not support Markdown for Agents" when it is missing.

## Requirements

- Request: `GET https://example.com/page` with header `Accept: text/markdown`.
- Response to that request: HTTP 200, `Content-Type: text/markdown` (`; charset=utf-8` is allowed), body is a markdown representation of the same page.
- Same URL. The scanner does not look for a different path.
- Default stays HTML: a request without `Accept: text/markdown` (a browser sends `text/html`) MUST get `Content-Type: text/html`.
- Every response on that URL, HTML or markdown, MUST carry `Vary: Accept`. Without it a shared cache can store the markdown copy and serve it to a browser, or the reverse.
- The markdown SHOULD drop navigation, scripts, and styling, and keep headings, links, lists, and tables.

## How to serve it on a static site

A plain static host cannot vary a response by request header. Options:

1. Cloudflare built-in "Markdown for Agents": dashboard, AI Crawl Control, Overview, Quick Actions. It converts HTML to markdown at the edge and sets the headers. It REQUIRES a Pro plan or higher, which is paid. It is not available on the Free plan.
2. Edge function (free): a Cloudflare Pages Functions middleware, a Worker, or origin logic. Inspect `Accept`. If it asks for `text/markdown`, return the markdown body (pre-built or converted) with `Content-Type: text/markdown`. Otherwise pass through. Set `Vary: Accept` on both branches. On a Node origin, do the same in a request handler.
3. Sidecar file: publish `/{page}.md` next to each page at build time. Agents can fetch it and it is useful, but it does NOT satisfy content negotiation, because the scanner requests the same URL with an `Accept` header. Use it as the markdown source for option 2.

Cost of middleware: it runs on every matching request, including those from browsers. Scope the route pattern narrowly (page routes only, not assets), keep the pass-through path cheap, and re-measure page performance afterwards.

## When not to publish it

Do not serve markdown that differs in substance from the HTML. Agents trust it as the page. Do not enable it for pages that need login or contain content hidden from the HTML. Do not enable the Cloudflare built-in without confirming the plan includes it; on Free the toggle is not available.

## Verify

```
curl -sI -H "Accept: text/markdown" https://example.com/
curl -sI -H "Accept: text/html" https://example.com/
```

- First output: `HTTP/2 200`, `content-type: text/markdown`, `vary: Accept`.
- Second output: `content-type: text/html`, `vary: Accept`.
- Run the first command without `-I` and read the first lines of the body to check it is markdown.

Scanner check: `POST https://isitagentready.com/api/scan` with `{"url": "https://example.com"}`. The JSON path `checks.contentAccessibility.markdownNegotiation.status` MUST read `"pass"`. [INFERENCE: key names follow the pattern of `checks.discovery.apiCatalog.status`; read the response and confirm the exact path.]
