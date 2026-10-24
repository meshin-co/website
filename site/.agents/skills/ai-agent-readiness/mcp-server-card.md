# MCP Server Card

An MCP Server Card is a JSON file at a fixed well-known path that describes a Model Context Protocol (MCP) server: its name, version, transport endpoint, and capabilities. It is defined by [SEP-1649](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127). MCP clients and agent scanners read it to learn that a site has an MCP server and how to connect, without first opening a session. The site gains discovery: an agent finds the server from the domain name alone.

## Requirements

- Path: `/.well-known/mcp/server-card.json`. Method `GET`. HTTP status `200`.
- `Content-Type: application/json`.
- `serverInfo` (required): object with `name` (string, server identifier) and `version` (string, server version).
- `endpoint` (required): URL of the MCP transport, for example `/mcp` for Streamable HTTP. A relative path or an absolute URL is accepted by the requirement text; an absolute URL is safer for clients.
- `capabilities` (required): the features the server supports. Three kinds exist:
  - `tools`: functions the agent can call.
  - `resources`: read-only data the agent can fetch by URI.
  - `prompts`: reusable prompt templates the agent can request.
- List only kinds the server really implements. Use an empty object `{}` for a kind with no sub-features.
- The endpoint speaks Streamable HTTP: one HTTP URL that accepts JSON-RPC `POST` requests.

```json
{
  "serverInfo": { "name": "example-mcp", "version": "1.0.0" },
  "endpoint": "https://example.com/mcp",
  "capabilities": {
    "tools": {},
    "resources": {},
    "prompts": {}
  }
}
```

## How to serve it on a static site

The card itself is a static file: put `server-card.json` under `.well-known/mcp/` in the public directory and it is served with `200` and `application/json` by file extension. Dot-directories must not be excluded by the build or the host.

The card alone is not enough. The check passes only with a live MCP server behind `endpoint`. A static site has no server, so this item needs a Worker or another always-on endpoint that answers MCP requests.

- On Cloudflare, use the Agents SDK and Workers to build and deploy an MCP server with server card support. A Worker route such as `/mcp` on the same domain keeps `endpoint` same-origin.
- On a Node origin, run any MCP SDK server with the Streamable HTTP transport and route `/mcp` to it.
- Add `Access-Control-Allow-Origin: *` on the card so browser-based clients can read it.

If the site has no reason to run a server, skip this item. That is the cheapest honest choice.

## When not to publish it

Do not publish the card until all of these are true:

- A server answers `POST` on `endpoint` and completes the MCP `initialize` handshake.
- Every kind listed in `capabilities` has at least one working tool, resource, or prompt.
- `serverInfo.version` matches what is deployed.

A card that points at a missing or empty server tells agents to connect and then fail. Agents act on the card without a human check.

## Verify

```sh
curl -sS -i https://example.com/.well-known/mcp/server-card.json
curl -sS -X POST https://example.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

Expect `HTTP/2 200`, `content-type: application/json`, the card body, and a JSON-RPC `result` from the second call.

Scanner: `POST https://isitagentready.com/api/scan` with `{"url": "https://example.com"}`. The JSON path `checks.discovery.mcpServerCard.status` must read `"pass"`.
