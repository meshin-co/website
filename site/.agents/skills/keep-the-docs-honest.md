# Keep the Docs Honest

`npm run gate:docs` reads every Markdown file in `AGENTS.md`, `docs/` and `.agents/skills/` and
fails when a document claims something the repository does not hold. Three rules, each with a
precision control and a test. The rules live in `scripts/docs-gate.mjs`, their tests in
`scripts/docs-gate.test.mjs`, and `scripts/run-docs-gate.mjs` walks the tree:

- **dead-path** — a backticked repo-relative path that resolves to no file. Resolution tries the
  citing document's own directory first, so an index may link its siblings.
- **dead-command** — an `npm run X` that `site/package.json` does not define.
- **stale-row-range** — a claim of the form `L1-L55` whose highest row disagrees with
  `docs/plan/reference/locked-decisions.md`.

## Why the ranges are checked

`AGENTS.md`, `docs/PRD.md`, `docs/DECISIONS.md` and `docs/plan/INDEX.md` each quoted a locked-row
range. Three of the four had gone stale as rows were added, so a reader was told the decisions
ended at L19 or L49 when they ran to L54. Nothing caught it, because prose is not built.

## What it deliberately does not check

Route paths (`/feed.json`), filename fragments (`.done.md`), placeholders (`audits/phase-N/`),
`skill://` URLs and paths inside another tool's tree (`.omp-perfect-coder/`, `extensions/`) are
excluded by name, each with a test. The first run produced 17 findings and 5 were the gate's own
imprecision; calibrate the rule, never the document.

## When it fails

Fix the document, or fix the thing it names. Never delete the claim to silence the gate: a doc
that says less is not more honest, it is just quieter.
