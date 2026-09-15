# meshin.co

Astro 7 static site for a Fractional Chief AI Officer practice. The Astro app is in `site/`.

## Read order

1. `docs/plan/INDEX.md` — the plan index, and the only plan file you read up front. It names each
   phase, its status (carried in the filename: `.done.md`, `.active.md`, `.next.md`,
   `.planned.md`, `.dropped.md`) and where the reference material lives. Read the index, then the
   one `.active` or `.next` phase file, and nothing more until you need it. The locked decisions
   L1–L49 live in `docs/plan/reference/locked-decisions.md`; the gate procedure in
   `docs/plan/reference/calibration-gate.md`. Finishing a phase means renaming its file to
   `.done.md` and updating its index row in the same commit; `npm run gate:plan` fails when a
   status word is unknown, when two phases claim `active` or `next`, or when the index and the
   phases directory disagree.
2. `docs/PRD.md` — the full requirements spec. `docs/plan/reference/locked-decisions.md` overrides it
   where they differ.
3. `docs/DECISIONS.md` — the closed decision log, rows `D1`–`D24`, written before the build
   started. Different file from the plan's locked rows: `D` rows are the original decisions, `L`
   rows are what the build actually locked. Where they disagree the `L` row wins and the `D` row
   is marked superseded.
4. `site/.agents/skills/` — one procedure per file, each named for the job it does: the design
   lane, snippet grammar, structured data, the search index, machine interfaces, running the
   gate, the content gate, the judge panel, adding a collection entry, restoring a collection,
   visual baselines, extending the mutation smoke, explaining a route removal, coordinating
   parallel agents, clearing dead weight, verifying in the built output, and the launch
   checklist. Read the matching one before doing that job by hand; `design-lane.md` comes before
   any markup or CSS. `navigate-the-plan.md` explains the plan tree. `gate:skills` fails if a
   skill names a path or command that does not exist.
5. `docs/SEMANTIC-CORE.md` — which title, meta description and target query each route family
   carries and why, plus the 30 buyer prompts mapped to the routes that must win them. Read it
   before writing or editing any page copy, title or meta description.
6. `skill://frontend-excellence` — all UI work. Load at most 3 references at a time via its
   routing tables.
7. `skill://perfect-coder` — all source code. Minimal viable change, test-first, per-language
   size caps.

## Hard rules

- Every phase ends with the Calibration Gate in `docs/plan/reference/calibration-gate.md`. No merge without a green gate
  and a generated `audits/phase-N/REPORT.md`. There is no waiver path and no "fix next phase".
- Lighthouse must read 100/100/100/100 on mobile and desktop for every audited route. A run at
  97–99 is re-run up to three times, then it is a failure.
- Blocking budgets, measured from the shipped build and never from a config file: JS ≤10 KB gz,
  CSS ≤20 KB gz, page ≤250 KB without images, fonts ≤120 KB across 2 families and 4 weights,
  CLS ≤0.02, LCP ≤1.85 s mobile (L13, amended 2026-09-15; `/styleguide` is not audited).
- Client JavaScript is limited to Plausible, the theme toggle, and the lazy search-index
  fetch on first query (custom build-time index, `public/search/index-model.mjs`; no
  third-party search runtime). No `ClientRouter`, no islands, no third-party embeds, no
  cookies.
- No contact form, no Pages Function, no Resend. `/contact` is an email address plus a Cal.com
  button. No newsletter anywhere.
- The route lists are derived from `dist/**/*.html`, never hand-authored. Cheap gates (content, links, budgets,
  machine interfaces, JSON-LD) run on every route. Lighthouse audits every unique page plus ONE leaf per repeated
  template family — the heaviest by built bytes — because leaves of one template differ only in content, not in
  what Lighthouse measures.
- From Phase 3 on, every template is gated against its heaviest real content entry, never
  placeholder text.
- Every guard (zod refinement, CSP directive list, byte budget) has a planted violating specimen
  and is proven to fail before it is trusted.
- Content rules: every post, glossary term and service carries `shortAnswer`, `updatedDate` and at
  least one source. Zod enforces it and the build fails otherwise.
- Never invent an owner fact, a client name, a metric, a testimonial or a credential. Unknown
  facts become `TODO(owner)` and go on the copy checklist.
- Copy tone: direct and engineering. Numbers and dates instead of adjectives. No "leading",
  "expert", "passionate".
- Design lane: "engineering brief" — Fraunces, IBM Plex Sans and IBM Plex Mono (3 families,
  98 KB gz, a documented deviation from the 2-family rule), paper and ink with one deep teal
  accent in OKLCH. No gradients, no stock imagery, no purple. No numbered section labels and no
  figure-number chips anywhere.
- Structured data: one JSON-LD `@graph` per page from `site/src/utils/jsonld.mjs`. Every node has
  an `@id`, every referenced `@id` resolves, and CI validates it.
- Machine interfaces (`/llms.txt`, `/llms-full.txt`, `/llms/{collection}.txt`, `/{page}.md`,
  `/feed.json`, `/rss.xml` plus six per-collection feeds, `/og/*.png`, search shards, sitemap)
  are build outputs. Verify them in `dist/`, not in source.
- Verify a claim about the site in the built output — `dist/`, a response from the gate server, or
  a command's real stdout. Never in source, never in a doc. When a doc and the build disagree, the
  doc is wrong. Procedure: `site/.agents/skills/verify-in-the-built-output.md`.
- Evidence in git is the generated report, never the raw run. `audits/phase-N/REPORT.md`, the
  sweeps, the checklists, the ledgers and the dispositions are committed; `lh-mobile/`,
  `lh-desktop/`, `baseline/` and every `*.json.gz` under `audits/` are gitignored, because they
  are reproducible from any build by re-running the gate and had grown to 272 MB. Playwright
  baselines stay tracked — they are fixtures the visual gate reads — but their history was
  collapsed once, on 2026-09-15, when five regenerations had accumulated 579 MB.
  Every commit hash changed on that date; a hash quoted before it will not resolve. Translate it
  through `docs/plan/reference/history-rewrite-2026-09-15.md`, which maps all 84 surviving
  commits and names the 7 that were pruned as empty.
- Found dead weight (unreferenced components, exports, baselines, scripts, contradicted config) is
  removed in the session that found it, never deferred (L40). Procedure:
  `site/.agents/skills/clear-dead-weight-now.md`.
- No user-facing string ships unreviewed. Every one enters the editorial ledger and carries a
  disposition of `rewritten`, `verified`, or `owner-blocked` with a reason (L52). Read
  `site/.agents/skills/write-copy.md` before writing copy and
  `site/.agents/skills/place-a-new-text.md` before adding any new text; one concept is defined on
  exactly one page (L50, L51, L53).
- Work is finished when the procedure that produced it lives in the methodology layer: a skill, a
  hard rule here, a locked row in the plan, or a machine check (L49).
- Ask Context7 about Astro 7, Tailwind v4 and satori APIs before relying on memory.

## Commands

```
cd site
npm run build      # production build, the only build Lighthouse may measure
npm run check      # astro check, eslint, prettier
npm run preview    # serve dist for local gate runs
npm run gate:lh    # both form factors, all audited routes, ~30 min
npm run test:smoke # every guard family proven able to fail, ~40 s
```

CI classifies the diff first. A commit touching only `docs/`, `audits/`, `site/.agents/` or
root-level Markdown runs `check`+units+`gate:skills`+`gate:plan` and nothing else, because prose
cannot change what Lighthouse measures. Anything else — source, config, content Markdown under
`site/src/data/`, the workflow itself — runs the full parallel graph: one build, then
check+units, guard-mutations, cheap gates, Playwright (3 shards) and Lighthouse (2 form factors
x 4 route shards) in parallel, merged by `gate-report`.
A single shard locally: `LHCI_FORM_FACTOR=mobile LH_SHARD_INDEX=1 LH_SHARD_TOTAL=4 npm run gate:lh:one`.
