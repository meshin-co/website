# Risk register

| Risk                                         | Why it bites                                                                 | Mitigation in this plan                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Gate route list rots as pages are added      | New templates ship unaudited while the dashboard shows 100                   | CG step 2 derives routes from `dist/`                                |
| Placeholder content flatters CLS/LCP         | Real variable-length copy in Phase 4 breaks a layout that was never stressed | Real heaviest entry per template from Phase 3                        |
| Budgets proven once on the empty shell       | Cumulative additions overflow by Phase 5                                     | CG step 6 re-measures every phase, including the lazy Pagefind chunk |
| CSP verified in source, weakened at the edge | Best Practices 100 is a pre-deploy claim only                                | Edge header check after first deploy                                 |
| A guard that cannot fail                     | Refinements exist but never reject                                           | Planted specimens + mutation smoke per gate                          |
| Owner facts unavailable                      | Invented credentials or metrics                                              | L11, L12, copy checklist handoff, `TODO(owner)`                      |
| Word-count refinements gamed by padding      | Schema-valid, semantically empty content                                     | Human read-aloud check in CG step 10; citability pass in Phase 4     |
