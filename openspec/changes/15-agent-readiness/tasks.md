# Tasks

## 1. Declare the AI preferences

- [x] 1.1 Serve `Content-Signal: search=yes, ai-input=yes, ai-train=yes` on every response, set in
      `site/scripts/gen-headers.mjs` under the catch-all rule. It was first written as 23
      `robots.txt` directives; Lighthouse's `robots-txt` audit called them unknown and scored SEO
      0.92 on all 26 routes, so the policy moved to the header form, which outranks `robots.txt`
      anyway. Row G45 records what that costs: the scanner parses `robots.txt` only
- [x] 1.2 `contentSignalGaps()` in `site/scripts/agent-interfaces-gate.mjs` fails on a build whose
      responses declare no signal, declare two, or leave one of the three unsaid. Specimen family
      `agents` strips `ai-input` from the built headers file

## 2. Describe the endpoints that already exist

- [x] 2.1 Publish `/openapi.json` describing the JSON resources the build ships today, generated
      from the same route data the build uses, never hand-maintained. `site/scripts/gen-openapi.mjs` walks the built output. Against the real build it describes 8 routes: `/feed.json` and the seven search shards. `gate-routes.json` is excluded by a named constant as a harness artifact
- [x] 2.2 Fail the build when the document names a path the build does not ship, or omits one it
      does, with a planted specimen for each direction. `openApiCoverageGaps()` reports both directions. Specimen `agents-openapi-drift` deletes `/feed.json` from the document and the gate names it
- [x] 2.3 Publish `/.well-known/api-catalog` as `application/linkset+json` with an `anchor`, a
      `service-desc` pointing at `/openapi.json` and a `service-doc` pointing at a real page. `site/scripts/gen-agent-catalog.mjs` writes `dist/.well-known/api-catalog` with an anchor, `service-desc` to `/openapi.json` and `service-doc` to `/llms.txt`, which is the only shipped page describing the machine layer
- [x] 2.4 Set the media type in the headers file, and assert it in the gate: a static host guesses
      from the extension, and this file has none. `Content-Type: application/linkset+json` is set in `site/scripts/gen-headers.mjs`, and `linkHeaderGaps()` plus the headers tests assert it. The media type has one definition, `OPENAPI_MEDIA_TYPE`, exported by the OpenAPI generator and imported by the other two

## 3. Point at them from the first response

- [x] 3.1 Add `Link` headers on the home page route for `api-catalog`, `service-desc` and
      `describedby`, in the headers file the build emits. Three `Link` headers on `/` exactly, not `/*`. A test fails if they are moved under the catch-all
- [x] 3.2 Guard that every `Link` target resolves inside the build, with a planted specimen. `linkHeaderGaps()` checks the grammar, the three relations and that every target is shipped. Specimen `agents-link-header-leaks` moves the rule under `/*`

## 4. Publish the capability manifest

- [x] 4.1 Serve `/.well-known/ai-catalog.json` listing the machine entry points the site offers. `dist/.well-known/ai-catalog.json` lists 18 entries, each discovered from the built output: the two llms indexes, five collection indexes, the OpenAPI document, the linkset, the sitemap index, the JSON feed and seven search shards
- [x] 4.2 `<link rel="ai-catalog">` in `CommonMeta.astro`, on every page. The `Agentmap:` line in
      `robots.txt` was dropped for the same Lighthouse reason as the signal; the manifest is still
      reachable by two of the five routes the scanner probes
- [x] 4.3 `manifestEntryGaps()` and `headLinkGaps()`. Specimens `agents-manifest-dangles` and
      `agents-head-link-drifts`; the second points the head link at a manifest the build never
      wrote, and the gate names it instead of crashing

## 5. Prove it against the scanner, not against an opinion

- [x] 5.1 Record the before scan as evidence: `level`, `levelName`, and every
      `checks.<group>.<item>.status`. `audits/phase-15-agent-readiness/agent-readiness-scan.md`: level 1, three pass, fourteen fail, six neutral, each key recorded
- [ ] 5.2 After the build is live, rescan and record the after state. The targets are
      `botAccessControl.contentSignals`, `discoverability.linkHeaders`, `discovery.apiCatalog` and
      `discovery.ard` reading `"pass"`, and `level` reading 2 or higher
- [ ] 5.3 Re-run the crawler matrix on the live origin and record which user agents answer 200,
      alongside the note that a spoofed user agent is partial evidence

## 6. Calibration Gate

- [ ] 6.1 `npm run test:smoke` proves every new guard family can fail
- [ ] 6.2 Run the Calibration Gate and commit the report it generates for this change: Lighthouse
      100/100/100/100 on both form factors, and the byte budgets unchanged
