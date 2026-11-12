# Satisfy the llms.txt audit

Lighthouse 13.5.0 has a category, Agentic Browsing, with an audit `llms-txt` that fetches `/llms.txt`.
It fails the file for any of three reasons: no H1 line, fewer than 50 characters, or no Markdown link
`[text](url)`, a bare address not counting as one. The installed audit tests each with a regular
expression, not a Markdown parser (the file `llms-txt.js` in the `lighthouse` package). A status of 400
or above is not applicable; 500 or above, or a failed fetch, fails. Read 2026-11-12 from the package and
from <https://developer.chrome.com/docs/lighthouse/agentic-browsing/scoring>. The rule is L79. Nothing
was broken when it was written; it guards the next change to the generators.

## What the gate holds

`npm run gate:agents` (`scripts/agent-interfaces-gate.mjs`) reads `dist/llms.txt`, `dist/llms-full.txt`
and every file under `dist/llms/`, and refuses a build that lacks either of the first two. It reads
stricter than the audit, so that passing it implies passing the audit:

- the H1 is the first non-empty line, where the audit accepts one anywhere
- the size is counted in UTF-8 bytes, where the audit counts characters
- a link inside a code fence or inline code, and an image, do not count

Each finding starts with the file's path. Three specimen families prove it can fail, in
`scripts/mutation-smoke.mjs`: `agents-llms-summary-without-an-h1`, `agents-llms-summary-under-the-floor`
and `agents-llms-summary-with-only-a-bare-url`. The fixtures are in `tests/guard-mutations/fixtures/`.

## Verify in dist, not in the generator

After `npm run build`:

```
head -n 1 dist/llms.txt
wc -c dist/llms.txt
grep -c ']([^)]' dist/llms.txt
npm run gate:agents
```

The first line starts with `# `, the byte count is 50 or more, the last count is at least 1. Then the
live file: take the address from `site.site` in `src/config.yaml` and fetch `/llms.txt` from it.
The same bytes must come back under any `Accept` header, `text/markdown` included. To see the audit
itself, serve the build and run Lighthouse on one category:

```
GATE_SERVER_PORT=4791 node scripts/gate-server.mjs dist
npx lighthouse http://127.0.0.1:4791/ --only-categories=agentic-browsing --output=json
```

Read `audits.llms-txt` and `audits.ard-schema` in the JSON. The category reports a fraction, not a score
out of 100, and needs Chrome 150 or later.

## What is refused, and what is open

WebMCP is refused and the category is not a gate (L80). The reasons: registering a tool is a fourth
client script where `AGENTS.md` allows three, it needs a Chrome origin-trial token, and the site has no
action beyond search that an agent cannot already take. The three WebMCP audits read `notApplicable`
without it. The category is a fraction over proposed standards, where the Lighthouse rule is 100 on
four named categories. Measured by hand 2026-11-12 on the home page: category 0.98, `llms-txt` 1,
`ard-schema` 0.9 with 26 low-severity warnings and no error. Those warnings are G94, left to the owner.
Before spending effort on either, read L80 and G94 in `docs/plan/reference/`.
