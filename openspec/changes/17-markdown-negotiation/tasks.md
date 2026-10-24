# Tasks

## 1. Serve markdown from the same URL

- [x] 1.1 Ship `site/scripts/markdown-negotiation.mjs` as `dist/_worker.js`: on a `GET` whose `Accept` names
      `text/markdown`, serve the route's `.md` sidecar with `text/markdown; charset=utf-8`,
      `content-location`, and `Accept` added to `Vary`
- [x] 1.2 Map routes to sidecars the way the build writes them, including `/` to `/index.md` and a
      trailing slash to the same file
- [x] 1.3 Never cost a response: a route with no sidecar, a request that is not a `GET`, and any
      error inside the handler all fall through to the asset the request asked for

## 2. Gate what the build can see

- [x] 2.1 `markdownNegotiationGaps()` fails a build that ships no handler, and one that ships a
      handler with no home sidecar to serve
- [x] 2.2 Specimen `agents-markdown-handler-gone` removes the handler from a built copy and proves
      the gate fails

## 3. Prove what only the live origin can show

- [x] 3.1 `markdownNegotiationVerdict()` turns the live response into a pass or a named failure
- [x] 3.2 `npm run smoke:prod` asks the live home page for markdown, taking the run to 21 checks
- [ ] 3.3 Publish, then record the live result and rescan: the target is
      `contentAccessibility.markdownNegotiation` reading `"pass"` and `level` reading 3

## 4. Write the rule down

- [x] 4.1 Row L60 in `docs/plan/reference/locked-decisions.md`, with the bounds of the exception
- [x] 4.2 The hard rule in `AGENTS.md` names the one handler instead of forbidding all edge code
- [x] 4.3 `site/.agents/skills/agent-interfaces.md` carries the procedure

## 5. Calibration Gate

- [x] 5.1 `npm run test:smoke` proves every guard family can still fail
- [x] 5.2 Run the Calibration Gate and commit the report it generates for this change
