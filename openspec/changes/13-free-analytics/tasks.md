# Tasks

## 1. Record the rule

- [x] 1.1 Add a locked row stating that every service the site depends on carries a permanent free
      tier, the domain excepted, and name the rule in `AGENTS.md`
- [x] 1.2 Add a guard that fails when a built route loads a third-party origin not declared free,
      and when a page's analytics copy disagrees with the beacon the build ships, in both directions
      planted specimen proving it fails

## 2. Remove Plausible

- [x] 2.1 Delete the Plausible script, its configuration and its CSP allowance
- [x] 2.2 Remove Plausible from the subprocessor list and from every sentence that names it
- [x] 2.3 Prove the built output contains no reference to plausible.io

## 3. Enable Cloudflare Web Analytics

- [x] 3.1 Enable it for the Pages project and confirm the beacon in the live response (G41)
- [ ] 3.2 Confirm the site still sets no cookie, measured from a live response
- [x] 3.3 Confirm the JavaScript byte budget still holds in the shipped build
- [x] 3.4 Rewrite the privacy sentence and the imprint row in the same change that ships the
      beacon, and re-disposition both

## 4. Re-verify the published promises

- [x] 4.1 Re-check every privacy, AI policy and imprint sentence against what is now true
- [x] 4.2 Record each affected string in the editorial ledger with its disposition

## 5. Calibration Gate

- [x] 5.1 Run the Calibration Gate and commit the report it generates for this change
