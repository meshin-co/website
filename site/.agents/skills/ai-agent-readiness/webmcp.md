# WebMCP

WebMCP is a browser API, `navigator.modelContext`, that lets a web page register tools which an AI agent in the browser can call. It is specified at [webmachinelearning.github.io/webmcp](https://webmachinelearning.github.io/webmcp/) and introduced in the [Chrome blog](https://developer.chrome.com/blog/webmcp-epp). Browser-based agents read the registered tools from the loaded page. The site gains agent access to its key actions through the page itself, with no server-side MCP server.

## Requirements

- Call `navigator.modelContext.registerTool()` once for each tool you expose.
- Each tool needs four fields:
  - `name`: unique tool identifier.
  - `description`: what the tool does, written for an agent.
  - `inputSchema`: a JSON Schema object describing the arguments.
  - `execute`: callback that receives the arguments and returns the result.
- Expose the site's key actions: search, navigation, data retrieval.
- Use an `AbortController` signal to unregister a tool when it is no longer needed.
- The API is detected by loading the page in a browser. The script must run on page load.

```js
if ('modelContext' in navigator) {
  const controller = new AbortController();

  navigator.modelContext.registerTool(
    {
      name: 'search_site',
      description: 'Search the site and return matching page titles and URLs.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Search words' } },
        required: ['query'],
      },
      async execute({ query }) {
        const res = await fetch('/api/search?q=' + encodeURIComponent(query));
        return { content: [{ type: 'text', text: await res.text() }] };
      },
    },
    { signal: controller.signal }
  );

  // Unregister when the tool is no longer needed:
  // controller.abort();
}
```

## How to serve it on a static site

Ship the script as a normal `<script>` in the page, or inline it, so it runs on every page that should expose tools. No server is needed for registration. The `execute` callback needs a data source, such as a static JSON index or an existing endpoint.

This is the only item on the checklist that ships client JavaScript. Three costs apply:

- The script must run on page load to be detected. Lazy loading on interaction hides the tools from the scanner.
- The API is browser-only and currently behind an origin trial in Chrome. Other browsers and non-browser agents ignore it. Guard with `'modelContext' in navigator`.
- Every byte counts against a JavaScript budget. A site with a strict budget must weigh this item against it.

Do not estimate the added bytes. After shipping, measure: build, then compare the compressed (gzip or brotli) transfer size of the page's scripts before and after, from the build output or the browser network panel. Re-run the site's own budget check.

## When not to publish it

Register a tool only if its `execute` callback does the real action today. A tool that returns a placeholder or fails misleads agents that call it. Do not register tools that change data or spend money without the same confirmation a human would face. If the origin trial or the JavaScript budget is a blocker, skip this item.

## Verify

The check needs a browser, so `curl` only proves the script is delivered:

```sh
curl -sS https://example.com/ | grep -c 'registerTool'
```

Expect a count of `1` or more for an inline script. For an external script, request that file and run the same `grep`. In Chrome with the origin trial enabled, open DevTools and confirm the tool appears in the page's WebMCP tool list.

Scanner: `POST https://isitagentready.com/api/scan` with `{"url": "https://example.com"}`. The JSON path `checks.discovery.webMcp.status` must read `"pass"`.
