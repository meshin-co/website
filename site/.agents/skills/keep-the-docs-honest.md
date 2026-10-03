# Keep the Docs Honest

`npm run gate:docs` reads every tracked Markdown file — not just `AGENTS.md`, `docs/` and
`.agents/skills/`, its original three-root scope — excluding only `audits/` (generated evidence),
`site/dist/` (build output) and `site/src/data/` (content entries, not documentation prose). It
fails when a document claims something the repository does not hold. Four rules, each with a
precision control and a test. The rules live in `scripts/docs-gate.mjs`, their tests in
`scripts/docs-gate.test.mjs`, and `scripts/run-docs-gate.mjs` walks the tree:

- **dead-path** — a backticked repo-relative path that resolves to no file. Resolution tries the
  citing document's own directory first, so an index may link its siblings.
- **ignored-path** — a citation that resolves only to a file `git check-ignore` matches. The file is
  on disk but a clean checkout does not hold it, so the finding names the path and the rule that
  ignores it. When git cannot answer, the check is skipped and the summary line says so.
- **dead-command** — an `npm run X` that `site/package.json` does not define.
- **stale-row-range** — a claim naming the locked rows as a span from the first to a highest row
  whose number disagrees with `docs/plan/reference/locked-decisions.md`.

## Why the ranges are checked

`AGENTS.md`, `docs/PRD.md`, `docs/DECISIONS.md` and `docs/plan/INDEX.md` each quoted a locked-row
range. Three of the four had gone stale as rows were added, so a reader was told the decisions
ended at L19 or L49 when they ran to L54. Nothing caught it, because prose is not built.

## Why an ignored file does not count

A citation that resolves only to an ignored file passes on the machine that holds the file and fails
on a clean checkout, so the gate read green where nobody was looking. A known-gaps row once cited a
route list that `gate:routes` writes into an ignored audits directory: the gate passed wherever
`gate:routes` had run once and failed in a clean export, and rewording the row kept the backticked
path, so the defect survived the rewording. Describe such a file in words, or cite the generator
that writes it. Build output under `dist/` is the exception: it is ignored by design and is checked
against a real build when one exists. The specimen `docsIgnoredPath` in
`scripts/mutation-specimens.mjs` plants an ignored file and a tracked document that cites it, and
`npm run test:smoke` requires the gate to fail on it.

## What it deliberately does not check

Route paths (`/feed.json`), filename fragments (`.done.md`), placeholders (`audits/phase-N/`),
`skill://` URLs and paths inside another tool's tree (`.omp-perfect-coder/`, `extensions/`) are
excluded by name, each with a test. The first run produced 17 findings and 5 were the gate's own
imprecision; calibrate the rule, never the document.

## Records are skipped, and only where they live

A dated record under `investigation/` opens with `record: true` front matter, and the gate skips it
for every rule: it may name another repository, a path that has since moved or a command that
was later removed, and resolving those against today's tree would make it wrong about its own day.
`mayBeRecord` and `isRecord` in `scripts/docs-gate.mjs` hold the rule. The marker counts only on a
file under `investigation/` and never on `investigation/00-INDEX.md`, which instructs and is always
checked; anywhere else it is ignored. The summary line reports how many records were skipped. The
specimens `docsRecord`, `docsIndexMarked` and `docsRecordOutsideCorpus` in
`scripts/mutation-specimens.mjs` plant a near-miss marker, a marked index and a marked document
outside `investigation/`, and `npm run test:smoke` requires the gate to fail on each.

## When it fails

Fix the document, or fix the thing it names. Never delete the claim to silence the gate: a doc
that says less is not more honest, it is just quieter.
