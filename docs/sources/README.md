# Source documents, as handed over

The three `.mhtml` files here are the originals this build started from, on 2026-09-06. They are
kept for provenance and are never the answer to a question about the site.

| File | What it is | What superseded it |
| --- | --- | --- |
| `prd-v2.mhtml` | The executable site specification, in Russian | `docs/PRD.md` is the extracted text; `docs/plan/reference/locked-decisions.md` overrides both |
| `master-plan.mhtml` | The owner's career master plan | Background only; nothing in the build reads it |
| `reference-stack.mhtml` | An AI engineering reference stack | Background only; the stack actually used is in `AGENTS.md` |

`.mhtml` is a binary MIME archive: `.gitattributes` marks it binary so git never rewrites its
line endings. Read it by extracting the text, not by opening it as Markdown.

→ verify: `git check-attr binary docs/sources/prd-v2.mhtml`
