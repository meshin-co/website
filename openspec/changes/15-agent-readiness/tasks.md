# Tasks

## 1. Declare the AI preferences

- [ ] 1.1 Add `Content-Signal: search=yes, ai-train=yes, ai-input=yes` to the group that applies to
      every agent in `site/src/pages/robots.txt.ts`, and keep the existing `Disallow` rules
- [ ] 1.2 Guard it: the built `robots.txt` carries the signal, on a group, with all three values,
      with a planted specimen proving the guard fails when the line is dropped

## 2. Describe the endpoints that already exist

- [ ] 2.1 Publish `/openapi.json` describing the JSON resources the build ships today, generated
      from the same route data the build uses, never hand-maintained
- [ ] 2.2 Fail the build when the document names a path the build does not ship, or omits one it
      does, with a planted specimen for each direction
- [ ] 2.3 Publish `/.well-known/api-catalog` as `application/linkset+json` with an `anchor`, a
      `service-desc` pointing at `/openapi.json` and a `service-doc` pointing at a real page
- [ ] 2.4 Set the media type in the headers file, and assert it in the gate: a static host guesses
      from the extension, and this file has none

## 3. Point at them from the first response

- [ ] 3.1 Add `Link` headers on the home page route for `api-catalog`, `service-desc` and
      `describedby`, in the headers file the build emits
- [ ] 3.2 Guard that every `Link` target resolves inside the build, with a planted specimen

## 4. Publish the capability manifest

- [ ] 4.1 Serve `/.well-known/ai-catalog.json` listing the machine entry points the site offers
- [ ] 4.2 Add the `<link rel="ai-catalog">` head link and the `Agentmap:` line in `robots.txt`, so
      the manifest is reachable three ways
- [ ] 4.3 Guard that the manifest parses, that every URL in it is a route the build ships, and that
      the head link and the robots line agree with it

## 5. Prove it against the scanner, not against an opinion

- [ ] 5.1 Record the before scan as evidence: `level`, `levelName`, and every
      `checks.<group>.<item>.status`
- [ ] 5.2 After the build is live, rescan and record the after state. The targets are
      `botAccessControl.contentSignals`, `discoverability.linkHeaders`, `discovery.apiCatalog` and
      `discovery.ard` reading `"pass"`, and `level` reading 2 or higher
- [ ] 5.3 Re-run the crawler matrix on the live origin and record which user agents answer 200,
      alongside the note that a spoofed user agent is partial evidence

## 6. Keep the budgets and the gates intact

- [ ] 6.1 `npm run test:smoke` proves every new guard family can fail
- [ ] 6.2 The Calibration Gate passes: Lighthouse 100/100/100/100 on both form factors, the byte
      budgets unchanged, and a generated report recorded
