# Run the Judge Panel

Half B of the content gate: six adversarial judges per page, run in parallel, each blind to
the others. `docs/CONTENT-GATE.md` defines the frames and which families get which judges.

## Batch files

Group routes into one batch file per family (articles, offers, money pages, pillars, policy,
terms split in two when large) and write each batch to a session-local artifact —
`local://judge-<group>.md` in the proven 2026-09-12 run. One ROUTE block per route:

    ## ROUTE /blog/example-slug
    Target query: the content-facts row for the route
    H1: the rendered h1
    Sections: the h2 list, pipe-separated
    Tables: N Figures: N Takeaways: N
    Outbound: the source URLs

    the full rendered page text

Each judge receives the block and nothing else: no sibling verdicts, no author intent.

## The six frames

Answer engine (would I quote this, can I attribute it) · the buyer (40 seconds, a
140-person company) · procurement and security reviewer · competing consultant · search
intent · plain-language editor reading aloud.

## Output contract

Each judge returns one JSON object. A finding without a quoted excerpt is discarded:

    { "verdict": "BLOCKER" | "NIT" | "CLEAN",
      "findings": [ { "excerpt": "...", "problem": "...", "fix": "..." } ] }

## Disposition rules (2026-09-12 session)

- Fix every BLOCKER. Fix NITs, or record a one-line reason for declining each one.
- Re-run only the judges that returned findings. Repeat until no BLOCKERs remain.
- Answer-engine findings marked quotable are sentences to keep, not change.
- Mismatched-query findings retarget the row in `site/content-facts.json`, not the page.
- A judge may never ask for an unconfirmed owner fact (it gets a `docs/COPY-CHECKLIST.md`
  row), never ask for more words, never rewrite in its own voice.
- Write the verdict table, every finding, what changed and the round count per route under
  `audits/phase-4/`, the location `docs/CONTENT-GATE.md` names.

## Architecture and plan reviews

For design and plan reviews, use the six ADHD frames instead — crawler, kiss, launch,
maintainer, rival, scale (branch evidence in `audits/phase-4.5/adhd/`). Branches run isolated;
findings are scored by cross-frame agreement, where an idea found by two or more independent
frames is the convergence signal; each finding is dispositioned accept, defer or reject, with
owner-reopen items listed separately and the plan amended in the same pass.
