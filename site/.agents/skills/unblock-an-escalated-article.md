# Unblock an Escalated Article

The loop writes an article, opens a pull request and watches it. When a job that is not a content gate fails,
it files an escalation and stops. From then on `scripts/pr-watch.mjs` reports `ledger-decided` and does
nothing, even after the cause is fixed and `main` is green: the ledger holds a decision, and the loop does not
revisit one. The branch waits for a person. Dispatching Watch PR again will not move it.

## The order

1. **Fix the cause on `main` first.** Whatever turned the job red is almost never the article. On 2026-11-09 two
   articles were held by a spend report that no step regenerated (G82) and by two tests pinned to the shape of
   the corpus (G81, G83), and in each case the article was correct.
2. **Catch the branch up.** `node scripts/catch-up-entry.mjs --head <branch tip>` regenerates every shared
   derived file in `SHARED_DERIVED` of `scripts/derived-files.mjs` against the current `main` and commits the
   result. It prints `{"outcome":"repaired", ...}` and the paths it rewrote. Run it on the branch, not on
   `main`; it refuses a head that is not `HEAD`.
3. **Check the branch before pushing.** `npm run gate:autowriter` and `npm test`. The catch-up rewrote the
   spend report and the records, so both read differently from the run that produced them.
4. **Measure.** The branch carries a new article, so `.githooks/pre-push` refuses it until
   `npm run build`, `GATE_PHASE=<bucket> npm run gate:lh` and `npm run lh:record` have measured that tree (L59).
5. **Merge, then confirm the article is live.** `curl -s -o /dev/null -w "%{http_code}" https://meshin.co/blog/<slug>`.
   A green merge is not publication: `publish-live.yml` runs only when the `ci` run on `main` concluded
   `success`, and a failed run reads `cancelled` because `cancel-on-failure` ends it.

## Never put the fix on the article branch

The squash fuses whatever the branch carries with the generation record, so the merge commit reads as a
pipeline commit. `scripts/autowriter-refusal-rules.mjs` then refuses it for ever: `refused-path-committed` for
a path only a person may write, such as `audits/lighthouse-green.json`, and `unregistered-path-committed` for
any path no catch-up can heal.

Nothing catches this before the merge, because the commit the gate judges does not exist until the squash
writes it. The only remedy afterwards is an entry in `LEGACY_EXCEPTIONS`, because `main` is protected and a
revert leaves the judged commit in place while removing a generation record on top of it. G84 records the one
commit this was learned on and the three paths it is forgiven.

So: land the fix on `main`, then catch the branch up, and let step 4 carry only the Lighthouse record.

## Close the escalations

Each held pull request has two or more issues against it, one per failing job and one per missing check run.
They do not close themselves. Close them naming the cause and the commit that fixed it, so the next reader
finds the chain rather than the symptom.
