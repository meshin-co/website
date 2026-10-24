# ARD capability manifest

Agentic Resource Discovery (ARD) is an open draft from the `ards-project/ard-spec` repository (Google, Microsoft, Hugging Face). A domain publishes one JSON manifest that lists the agent resources it offers: MCP servers, A2A agents, APIs, skills. Agents and registries fetch it, read each entry, and follow its `url` to the real description. It is an envelope, not an execution protocol. Status: "Proposal"; v0.9 is dated 2026-05-28 and v0.91 is dated 2026-08-26. Names changed between them, see below.

## Requirements

Source: ARD v0.9 section 4 and section 5 (the names the scanner probes). The scanner tries five routes in order and reports `fail` when none resolves. Treat each route as a separate way to pass; the scanner does not document which one it requires.

- Manifest, `GET /.well-known/ai-catalog.json`, status `200`, JSON body. Top level: `specVersion` (`"1.0"`), `host` (optional: `displayName`, `identifier`), `entries` (array).
- Each entry MUST have `identifier` (`urn:air:<publisher-domain>:<namespace>:<name>`), `displayName`, `type` (a media type) and exactly one of `url` or `data`.
- Each entry MAY have `description`, `tags`, `capabilities`, `representativeQueries` (2 to 5 sample questions), `version`, `updatedAt`, `metadata`, `trustManifest`.
- Route 1, robots.txt: a line `Agentmap: https://example.com/.well-known/ai-catalog.json`.
- Route 2, head link: `<link rel="ai-catalog" href="https://example.com/.well-known/ai-catalog.json" />`.
- Route 3, the well-known path above.
- Routes 4 and 5, DNS. The spec names SVCB records (RFC 9460) with an optional TXT fallback. Owner names probed: `_catalog._agents.example.com` (TXT) and `_search._agents.example.com` (SRV). A TXT value holding the catalog URL is convention from third-party guides, not text from the spec. The SRV record shape is read off the scanner probe only.
- v0.91 renamed the file to `/.well-known/ard.json`, the link to `rel="ard"` and the static DNS name to `_entries._agents`. It has only `entries` at top level. It calls the v0.9 names its predecessor. The scanner still probes the v0.9 names. Serve both files from one list if you want both readers.

```json
{
  "specVersion": "1.0",
  "host": { "displayName": "Example Co" },
  "entries": [
    {
      "identifier": "urn:air:example.com:api:public",
      "displayName": "Example Public API",
      "type": "application/vnd.oai.openapi+json;version=3.1.0",
      "url": "https://example.com/api/openapi.json",
      "description": "REST API for orders and returns.",
      "representativeQueries": ["list my recent orders", "start a return for order 1042"]
    }
  ]
}
```

## How to serve it on a static site

The manifest and the head link need no runtime. Put `ai-catalog.json` in `.well-known` in the public folder, add the `<link>` to the page head, and add the `Agentmap:` line to the `robots.txt` that the build publishes. Serve the JSON as `application/json`. The DNS routes cannot live in site files: they need write access to the DNS zone at your provider. Skip them when the manifest route already passes.

## When not to publish it

ARD lists resources an agent can invoke or search. Publish it only when at least one real resource exists: a working MCP server, A2A agent, or API with a description document that resolves. A documentation site with no invocable surface has nothing to list. Do not add a manifest to satisfy the scanner. Every `url` must return `200` today and every `identifier` must name a domain you control. Both ARD and the AI Catalog draft that now owns `ai-catalog.json` say they may change. The 2026-07-31 adoption audit by API Evangelist found 12 manifests from 9 publishers in 37,751 reachable domains, none fully conformant.

## Verify

```
curl -s https://example.com/.well-known/ai-catalog.json | python3 -m json.tool
curl -s https://example.com/robots.txt | grep -i '^Agentmap:'
curl -s https://example.com/ | grep -i 'rel="ai-catalog"'
```

The first command must print `entries` without a parse error. The others must each print one line. For DNS, query `https://cloudflare-dns.com/dns-query?name=_catalog._agents.example.com&type=TXT` with `Accept: application/dns-json`.

Scanner: `POST https://isitagentready.com/api/scan` with `{"url": "https://example.com"}`. The value at `checks.discovery.ard.status` must be `"pass"`. The scanner's failure message is "ARD capability manifest not found".
