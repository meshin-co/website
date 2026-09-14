# Verify in the Built Output, Never in a Doc or in Source

A claim about what the site does is only true if the built artifact does it. Source code states
intent; a doc states a plan; only `dist/`, a running `npm run preview`, or a real network
response proves either one held. This generalizes a rule that was previously written narrowly
per surface — machine interfaces, Lighthouse, CSP, JSON-LD — into one habit that applies
everywhere on this project.

## Where this already bit

- **Machine interfaces** (`/llms.txt`, `/{page}.md`, feeds, OG images, search shards): these are
  build outputs. A route existing in `src/pages/` proves nothing about whether it rendered,
  whether its frontmatter passed validation, or whether it is in the derived route list. Check
  `dist/`.
- **Lighthouse**: scores measured against `lhci`'s own static file server are wrong, because it
  serves everything uncompressed and headerless. `scripts/gate-server.mjs` gzips and serves the
  real `_headers` — the only server Lighthouse may read `dist` through. A score from any other
  server is not evidence.
- **CSP**: a directive list in a config file is a claim, not a fact — the real edge headers
  (`scripts/gen-headers.mjs`'s output in `dist/_headers`, or the live response headers post-
  deploy) are the only place a CSP violation is provable.
- **JSON-LD**: a builder function returning the right shape in isolation does not prove the page
  emits it — check the `<script type="application/ld+json">` block in the rendered `dist` HTML.

## Procedure

1. Before asserting a surface works, name the exact artifact you checked: a `dist/` path, a
   `gate-server`-served response, or a command's real stdout — not the source file that is
   supposed to produce it.
2. If the surface cannot be checked yet (pre-deploy edge behavior, a step gated later in the
   phase), say so explicitly rather than treating the source as proof by proxy.
3. When a doc and the built output disagree, the doc is wrong. Fix the doc; never adjust the
   built-output check to match a doc's claim.
