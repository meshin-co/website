# Test strategy (L14)

Written first, red before green, per `perfect-coder` §3.

| Unit                 | Test proves                                                                                                                        | Not tested                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| zod refinements      | Each boundary rejects just outside and accepts just inside (39/40/60/61 words, 155/156 chars, date order, 0/1 sources)             | that zod itself works                  |
| content pipeline     | A planted bad fixture makes `astro build` exit non-zero and name the field                                                         | per-file frontmatter shapes            |
| `jsonld.ts` builders | Emitted graph has one node per `@id`, every reference resolves, no fabricated fields                                               | exact JSON key order                   |
| machine interfaces   | Every public collection appears in `llms.txt`, `llms-full.txt`, `feed.json`, sitemap; `.md` sidecar exists per page with a sidecar | byte-for-byte file content             |
| OG images            | Rendered text nodes carry the entry's real title and category; PNG within budget                                                   | pixel appearance                       |
| page templates       | Playwright visual snapshot per template, two viewports, two themes                                                                 | class names, node counts, entry counts |

No test asserts a config file exists or parses. Budgets and CSP are asserted against measured
bytes and real response headers.

---
