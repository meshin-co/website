# Tasks

## 1. Record the rule

- [ ] 1.1 Add a locked row stating that every service the site depends on carries a permanent free
      tier, the domain excepted, and name the rule in `AGENTS.md`
- [ ] 1.2 Add a guard that fails when a known paid service appears in the built output, with a
      planted specimen proving it fails

## 2. Remove Plausible

- [ ] 2.1 Delete the Plausible script, its configuration and its CSP allowance
- [ ] 2.2 Remove Plausible from the subprocessor list and from every sentence that names it
- [ ] 2.3 Prove the built output contains no reference to plausible.io

## 3. Enable Cloudflare Web Analytics

- [ ] 3.1 Enable it for the Pages project and confirm the beacon in the live response
- [ ] 3.2 Confirm the site still sets no cookie, measured from a live response
- [ ] 3.3 Confirm the JavaScript byte budget still holds in the shipped build

## 4. Re-verify the published promises

- [ ] 4.1 Re-check every privacy, AI policy and imprint sentence against what is now true
- [ ] 4.2 Record each affected string in the editorial ledger with its disposition

## 5. Calibration Gate

- [ ] 5.1 Run the Calibration Gate and commit `audits/phase-13-free-analytics/REPORT.md`
