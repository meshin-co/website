Content Signals are `Content-Signal` lines in `robots.txt` that state, per crawler group, which categories of AI use the site allows after content is fetched. Crawlers and AI search products read them; the site gains an explicit, machine-readable preference instead of silence. The specification is published at https://contentsignals.org/. Cloudflare's agent-readiness scanner fails with "No Content Signals found in robots.txt" when none exist.

## Requirements

- Location: `https://example.com/robots.txt`, HTTP 200, `Content-Type: text/plain`.
- Directive: `Content-Signal: <name>=<value>[, <name>=<value>...]`. Comma-separated, one line.
- Signals (all three SHOULD be declared):
  - `search`: build a search index and show results (links, short excerpts). Does not cover AI-generated summaries.
  - `ai-input`: feed content into an AI model at answer time (retrieval, grounding, generated answers with citations).
  - `ai-train`: train or fine-tune AI models on the content.
- Values: `yes` = allowed, `no` = not allowed. A signal that is not listed means no preference stated.
- Scope: the line sits inside a `User-agent` group and applies to that group's crawlers. Put it under `User-agent: *` to cover all.
- It is a declaration of preference, not enforcement. A crawler can ignore it. `Disallow` rules still control crawling.

Maximum visibility (publish this if the site wants to be cited and learned from):

```
User-agent: *
Content-Signal: search=yes, ai-train=yes, ai-input=yes
Allow: /
```

Restrictive:

```
User-agent: *
Content-Signal: search=yes, ai-train=no, ai-input=no
Allow: /
```

## How to serve it on a static site

Add the line to the static `robots.txt` in the public directory. No server logic is needed. On Cloudflare Pages it is served as-is, but check the two Cloudflare switches below first.

Cloudflare zone feature "Bot Preference Sync" (formerly "managed robots.txt") PREPENDS its own block to the file the origin serves. That block carries `Content-Signal: search=yes,ai-train=no,use=reference` and `Disallow: /` for a list of AI crawlers. Your file is appended below it. Two groups then exist for the same user-agent. RFC 9309 resolves equal-length rules to the least restrictive, but several crawlers take the first matching group. The result is ambiguous. Turn the feature off, or accept its text as the real policy.

Separately, Cloudflare can return 403 at the edge to those crawlers (AI Crawl Control or Bot Fight rules). This happens before `robots.txt` is read, so no edit to the file can undo it. Check both switches in the dashboard before trusting your own file.

## When not to publish it

Do not publish `ai-train=yes` or `ai-input=yes` unless the owner of the content has decided to allow that use. Signals are a public statement agents act on. Do not publish maximum visibility while Cloudflare blocks the same crawlers at the edge: the file then promises access the edge refuses.

## Verify

```
curl -s https://example.com/robots.txt
curl -s -o /dev/null -w "%{http_code}\n" -A "GPTBot" https://example.com/
```

- Compare the first output to the built file. Any extra block above your own text comes from Cloudflare, not from your build.
- The second output MUST be `200` for every crawler you intend to allow. `403` means an edge rule blocks it. Repeat with `ClaudeBot` and `PerplexityBot`.

Scanner check: `POST https://isitagentready.com/api/scan` with `{"url": "https://example.com"}`. The JSON path `checks.botAccessControl.contentSignals.status` MUST read `"pass"`. It sits under `botAccessControl`, not `discovery`; read from a real scan response on 2026-10-24.
