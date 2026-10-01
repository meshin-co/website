# meshin.co

Astro 7 static site for a Fractional Chief AI Officer practice. The Astro app is in `site/`.

## Read order

1. `docs/plan/INDEX.md` — the plan index, and the only plan file you read up front. It names each
   phase, its status (carried in the filename: `.done.md`, `.active.md`, `.next.md`,
   `.planned.md`, `.dropped.md`) and where the reference material lives. Read the index, then the
   one `.active` or `.next` phase file, and nothing more until you need it. The locked decisions
   L1–L56 live in `docs/plan/reference/locked-decisions.md`; the gate procedure in
   `docs/plan/reference/calibration-gate.md`. Finishing a phase means renaming its file to
   `.done.md` and updating its index row in the same commit; `npm run gate:plan` fails when a
   status word is unknown, when two phases claim `active` or `next`, or when the index and the
   phases directory disagree.

   **On any conflict the order is: a locked row, then `docs/DECISIONS.md`, then `docs/PRD.md`,
   then this file's hard rules — and above all of them, the built output.**

2. `docs/PRD.md` — the requirements spec as handed over, frozen 2026-09-06 and superseded in
   places. Read it for the original intent behind a requirement, never for the site's current
   shape. The raw handover documents it came from are in `docs/sources/`.
3. `docs/DECISIONS.md` — the decision log closed before the build, rows `D1`–`D24`. The `L` rows
   are what the build actually locked; a `D` row marked superseded has an `L` row that answers
   instead.
4. `site/.agents/skills/` — one procedure per file, each named for the job it does: the design
   lane, snippet grammar, structured data, the search index, machine interfaces, running the
   gate, the content gate, the judge panel, adding a collection entry, restoring a collection,
   visual baselines, extending the mutation smoke, explaining a route removal, coordinating
   parallel agents, clearing dead weight, verifying in the built output, keeping the docs honest,
   smoking the live site, running the growth loop, and the launch checklist. Read the matching one
   before doing that job by hand; `design-lane.md` comes before any markup or CSS.
   `navigate-the-plan.md` explains the plan tree. `gate:skills` fails if a skill names a path or
   command that does not exist.

   `site/scripts/README.md` is the map of every script, grouped into gates, generators, audits,
   modules and servers, with the npm command that invokes each. Read it instead of listing the
   directory; `scripts-index.test.mjs` fails when a script is added without a row.

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
  CSS ≤20 KB gz, page ≤250 KB without images, fonts ≤120 KB across 2 families and 3 faces,
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
- Design lane: "engineering brief" — Fraunces (600) and IBM Plex Sans (400, 500): 2 families,
  3 faces, 63.4 KB gz measured from `dist/_astro/fonts/` (L39). The earlier plan to add IBM Plex
  Mono as a third family (L9b, 98 KB gz) is superseded: `--aw-font-mono` is never assigned, so
  monospace resolves to the system stack. Paper and ink with one deep teal accent in OKLCH. No
  gradients, no stock imagery, no purple. No numbered section labels and no figure-number chips
  anywhere.
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
- Every link leaving the site carries `rel="nofollow noopener noreferrer"` (L55). No ranking
  signal leaves, the opened page cannot reach `window.opener`, and the destination is not told
  who sent the visitor. The value has one source, `EXTERNAL_REL` in `site/src/utils/pipeline.mjs`:
  markdown gets it from the `rehypeExternalLinks` pass, components spread
  `externalRelAttrs(href)`. Never type the tokens into a new component. `npm run gate:external`
  fails on any outbound anchor missing one. Procedure: `site/.agents/skills/link-out.md`.
- The harness checks its own wiring (L56), because an unrun gate reads exactly like a passing one.
  `npm run gate:plan` fails when a `gate:*` script never runs in `ci.yml`, when `scripts/README.md`
  names a gate `package.json` does not define, when `playwright.config.ts` runs a browser project
  CI never installs, or when `localOnlyGates` declares a gate that no longer exists. A gate stays
  out of CI only via a `localOnlyGates` entry carrying a reason. Procedure:
  `site/.agents/skills/keep-the-harness-honest.md`.
- `investigation/` holds dated records, listed in `investigation/00-INDEX.md`. A record opens with
  `record: true` front matter, and `npm run gate:docs` does not resolve the paths, commands or
  locked-row ranges it cites, because it may describe another repository or a past day. A document
  that instructs is never a record: the marker is honoured only under `investigation/`, never on
  the index, and the gate prints how many records it skipped.
- Work is finished when the procedure that produced it lives in the methodology layer: a skill, a
  hard rule here, a locked row in the plan, or a machine check (L49).
- Ask Context7 about Astro 7, Tailwind v4 and satori APIs before relying on memory.
- The bigpowers catalogue is mapped once in `docs/plan/reference/bigpowers-mapping.md`: what was
  adopted, what the project already does under another name, and what is skipped and why. Read
  that row before adopting anything from it; two of its skills carry waiver-capable status models
  that would weaken the gate.

## Tests (F.I.R.S.T)

Every test earns its place against five criteria. A test that fails one is rewritten or deleted,
not kept for the count.

- **Fast** — the unit tests (run `npm test` for the current count) run in about four seconds
  together. A test that needs a build or a browser belongs in Playwright, not `node:test`.
- **Independent** — no shared mutable state, no ordering assumption. Each mutation family
  synthesises its own fixture tree; no test mutates the real `src/`.
- **Repeatable** — same result on any machine. Visual baselines are per platform for this reason,
  and an emulated container is never evidence about a runner (`visual-baselines.md`).
- **Self-validating** — the test asserts; it never prints for a human to read. A guard is only
  trusted once a planted specimen has made it fail.
- **Timely** — written before the code, red first. `npm run test:smoke` proves every guard
  family can still fail.

## Commands

```
cd site
npm run build      # production build, the only build Lighthouse may measure
npm run check      # astro check, eslint, prettier
npm run preview    # serve dist for local gate runs
npm run gate:lh    # both form factors, all audited routes, ~30 min
npm run gate:docs  # every path, command and locked-row range a document cites; a path git ignores fails; records exempt
npm run smoke:prod # 18 live requests against an origin, default https://meshin.co
npm run test:smoke # every guard family proven able to fail, ~60 s
```

CI classifies the diff first. A commit touching only `docs/`, `audits/`, `site/.agents/` or any
other Markdown (`investigation/` included) runs the `types-and-units` job and nothing else, because
prose cannot change what Lighthouse measures. Anything else — source, config, content Markdown under
`site/src/data/`, the workflow itself — runs the full parallel graph: one build, then
check+units, guard-mutations, cheap gates, Playwright (3 shards) and Lighthouse (2 form factors
x 4 route shards) in parallel, merged by `gate-report`.
A single shard locally: `LHCI_FORM_FACTOR=mobile LH_SHARD_INDEX=1 LH_SHARD_TOTAL=4 npm run gate:lh:one`.
