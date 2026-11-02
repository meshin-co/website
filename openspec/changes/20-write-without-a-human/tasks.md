# Tasks

## 1. The watcher, before any model is called

- [x] 1.1 `npm run watch:pr` classifies a pull request from the GitHub API: it reads the checks of
      the head commit for the pull-request event's own run, names the single job whose conclusion
      is `failure`, and treats zero check runs, a `skipped` content gate and a stale judged commit
      as hard stops rather than as green
- [x] 1.2 The attempt ledger `audits/autowriter/<slug>.json` records attempt number, judged commit,
      failing rule and path, cumulative tokens and cost, and the terminal verdict
- [x] 1.3 The workflow dispatches a successor when checks are unsettled or the quarantine window
      has not elapsed, and exits; it never sleeps inside a job
- [x] 1.4 A failure the loop may not repair opens an issue and posts to Slack, with a delivery
      receipt written into the ledger — offline-proven; no webhook secret exists, so no message has
      been delivered live
- [x] 1.5 Settle by observation whether a push made with the configured token starts a CI run, and
      record the answer in the ledger format's documentation — settled on this repository's own
      history for the default token; the bot token does not exist yet, so the watcher treats a push
      that starts no run as a hard stop rather than assuming either answer
- [x] 1.6 `ci.yml` gains one aggregate job that depends on every job the merge decision cares about
      and fails when any of them failed or was cancelled, because GitHub counts a skipped job as a
      passing required check
- [ ] 1.7 `main` requires that aggregate check before a merge, so a defect in the watcher cannot
      merge a red pull request

## 2. Selection, before any model is called

- [x] 2.1 The daily workflow refreshes `audits/search-demand.md` with the service-account secret
      and escalates on failure instead of leaving the previous report in place — offline-proven; the
      secret is not in the repository yet, so the refresh has never run in CI
- [x] 2.2 Selection reads the committed report and always picks one blog post, recording the signal
      and the number that justified it
- [x] 2.3 Selection also picks the concepts measured demand names that the glossary does not
      define, up to a configured cap, when the term arm is enabled; the arm is on for this site
- [x] 2.4 A candidate whose concept already owns a register row is never written as a new page; it
      becomes a strengthen report for a human, with its route, query and number
- [x] 2.5 The title is checked against every title in the generated layer of `docs/SEMANTIC-CORE.md`
      and against unexpired claims; a collision takes the next candidate
- [x] 2.6 The claim is committed to `main` before the model is called, and expires after 14 days

## 3. The writer

- [x] 3.1 One adapter stands between the pipeline and the writing vendor, with the key read from a
      secret and never echoed; one implementation ships, and the seam exists so a second site or a
      later vendor change is not a rewrite
- [x] 3.2 The configured model id is validated against the vendor's model list on the first call of
      a run, failing with the variable name
- [x] 3.3 The generation record carries model, prompt digest, response id, the demand row that
      selected the topic, the tree fingerprint, tokens and cost; a redaction test asserts no secret
      value appears in it
- [x] 3.4 The writer emits a claim-to-source table in the same call, and every claim id resolves to
      an entry in the article's sources
- [x] 3.5 The article, its passage line, its dispositions, its content-facts row and its registers
      land in one commit
- [x] 3.6 The model id and its per-token rates are configuration, defaulting to the model the owner
      named, with the reason recorded beside the default

## 4. Repair and spend

- [x] 4.1 Repair rewrites only the article's prose and frontmatter, at most three attempts, with the
      ledger riding inside the repair commit
- [x] 4.2 A failure is fingerprinted by rule and path, so the same rule failing twice escalates
- [x] 4.3 Automation cannot reach the disposition seal or write the Lighthouse record, and a test
      proves the attempt fails
- [x] 4.4 A monthly spend ceiling stops the workflow and notifies Slack
- [x] 4.5 A merged article records the Lighthouse measurement debt it leaves for the owner

## 5. Guards

- [x] 5.1 `npm run gate:autowriter` validates the configuration against its schema, the ledger and
      claim shapes, the attempt cap, title uniqueness, and that the generated prose sits inside the
      sentence-length band measured from the hand-written corpus
- [x] 5.2 The gate is wired into CI and `npm run gate:plan` reports it
- [x] 5.3 A planted specimen proves each failure mode, each `plant` returning its restore, with a
      row in the mutation smoke manifest
- [x] 5.4 `site/scripts/README.md` carries a row for every new script

## 6. Portability

- [x] 6.1 One configuration file holds every site-specific value the engine reads, parsed by one
      loader and validated against a schema
- [x] 6.2 The CI diff classifier reads that file instead of re-expressing its rules in shell, and an
      unclassifiable path draws the full graph
- [x] 6.3 A skill states what a second site must set, and a self-check command names what is missing
- [x] 6.4 Locked rows record what the machine may publish unattended and under which bounds

## 7. Calibration Gate

- [x] 7.1 `npm run test:smoke` proves every guard family can still fail
- [ ] 7.2 Run the Calibration Gate and commit the report it generates for this change
