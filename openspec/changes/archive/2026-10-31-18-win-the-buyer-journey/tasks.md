# Tasks

## 1. Every claim resolves or goes

- [x] 1.1 Remove "Open-source" from the home proof chip and the `license` field from the resource
      entries and their JSON-LD, until a licence exists
- [x] 1.2 Reword the Starter Kit, Agent Evals CI Starter and LLM Gateway leads to describe what the
      page holds, never what it would hold
- [x] 1.3 Every string changed enters the editorial ledger with a disposition (L52)

## 2. The booking path exists where buyers land

- [x] 2.1 The closing booking band renders on the glossary, tag, blog-index, glossary-index and legal
      templates
- [x] 2.2 The header booking button is reachable below 1024px without opening the menu
- [x] 2.3 Every booking CTA points at the 30-minute event the copy names

## 3. The money pages link each other

- [x] 3.1 `/pricing` is linked from both cost FAQs and the three offer pages, and links them back
- [x] 3.2 The pilot post links the Assessment and the Sprint at first mention
- [x] 3.3 The Assessment links the Sprint and the scorecard
- [x] 3.4 The prompt-2 FAQ carries "Fractional Chief AI Officer" and "CAIO" inside its 80-word answer

## 4. Freshness states one date

- [x] 4.1 The CI `build` job checks out at full depth, so a static page's `lastmod` is its own last
      commit
- [x] 4.2 One editorial date per static page feeds the sitemap, the `.md` sidecar and the JSON-LD

## 5. Guards, each with a planted specimen

- [x] 5.1 A template that renders no booking CTA fails the gate
- [x] 5.2 A route whose only inbound links are header, footer or hub listing fails the gate
- [x] 5.3 A page whose sitemap, sidecar and JSON-LD dates disagree fails the gate

## 6. Calibration Gate

- [x] 6.1 `npm run test:smoke` proves every guard family can still fail
- [x] 6.2 Visual baselines regenerated for the templates whose markup changed
- [x] 6.3 Run the Calibration Gate and commit the report it generates for this change
