# Let the site write to demand on a schedule, and prove what the machine did

## Why

Change `19-write-to-demand` put the numbers in the repository and named the signal that chooses an
article. It left the work to a human: read `audits/search-demand.md`, pick, write, wire, gate,
publish. At the measured cadence that is one article every six days, and the owner wants the loop
to run without him.

The first query of the property also settled something the plan had assumed. Measured on
2026-11-01 over 2026-08-01 to 2026-10-30:

- none of the nine blog posts has recorded a single impression in 91 days
- 59 of 77 impressions belong to two glossary terms, `/glossary/eu-ai-act` (48) and
  `/glossary/ai-management-system` (11)
- the rest is site chrome: the front page, `/faq`, `/about`, `/resources`, `/now`
- the only page-one positions are `/faq` at 6.0 for `"fractional chief ai officer" remote` and the
  front page at 7.0 for the brand term

The blog post is therefore the unit the owner has chosen, and the glossary is the unit the data
points at. The pipeline writes both: a post every run, because publishing is the habit the owner
wants automated, and a glossary term whenever measured demand names a concept no page defines,
because that is the format this site has actually ranked with. A pipeline writing only posts would
automate the one format that has never earned an impression here.

## What changes

**The demand fetch moves into CI.** The service-account key becomes a repository secret and a
daily workflow refreshes `audits/search-demand.md` before anything else runs. This reverses one
line of change 19, which kept the key local; the reason it was local was that a gate must not need
a secret, and that still holds — `npm run gate:demand` stays offline against the committed report.
A fetch that fails escalates instead of leaving yesterday's report in place.

**A run writes a post, and writes the terms the glossary is missing.** The blog post is
unconditional: every scheduled run produces one, chosen from the strongest signal the report
offers and recorded with the number that justified it. Beside it, when measured demand names a
concept the glossary does not define, the same run writes that concept as a glossary term. The
term arm is a configuration switch, because another site may have no glossary; on this site it is
on, and a cap bounds how many terms one night may add. A concept that already owns a register row
is never written twice: that is a strengthen report for a human, not a second page.

**Selection commits before it spends.** The run writes a claim to `main` — slug, title, format,
target query, the measured impressions and position that justified it, the prompt it serves, run
id, status, expiry — before the model is called. The claim is the de-collision lock, the spend
receipt and the frozen passage source at once. A title that already exists anywhere in the
generated layer of `docs/SEMANTIC-CORE.md`, or in an unexpired claim, is refused and the next
candidate is taken.

**The writer sits behind an adapter and its model is checked.** One vendor ships, named in
configuration together with the model id and the per-token rates that price a run. The owner chose
GPT-6.1 Terra, which OpenAI's own catalogue describes as its model for clear, natural writing; the
reason is recorded beside the default so the next person knows why it is there. On its first call
of a run the adapter validates the configured model id against the vendor's own model list and
fails naming the variable, because a typo in an unattended daily job otherwise dies quietly at six
in the morning, and an id the vendor has scheduled for withdrawal is named in the digest while it
still works. The adapter exists as a seam rather than as a comparison: there is no second
implementation and no bake-off, and the reason to keep the boundary is that this engine is meant
to be copied to another site.

**One commit carries the whole route.** The entry, its `Passage:` line in the semantic core, its
dispositions, its content-facts row and its registers land together, because a commit that splits
them cannot be checked: a semantic-core-only commit is classified as prose, so the build never runs
and the gate that enforces the passage has no built HTML to read.

**A watcher runs the pull request without a human.** It is dispatched by the writer, it never waits
inside a job, and it reschedules itself until every check has settled. It classifies by the job
whose conclusion is `failure`, not by counting conclusions, because this repository cancels its own
run on any failure and `cancelled` therefore describes every ordinary gate failure. Zero check runs
on the head commit and a `skipped` content gate are hard stops, never green. When every check is
green and the quarantine window has elapsed, it merges.

**Repair is bounded and it is only ever about the text.** A failure owned by a content gate is
repaired by rewriting the article's prose and frontmatter, at most three times, with the attempt
ledger riding inside the repair commit so the head always carries the article and always draws the
full job graph. A failure is fingerprinted by rule and path only; the detail and the line number
move with the prose the repairer just rewrote. Anything else — a flaky browser shard, a failing
dependency, a gate the article did not cause — opens an issue and notifies Slack, and the owner
fixes it outside this loop.

**Spend is bounded and visible.** Every run records its tokens and its cost. A monthly ceiling
stops the workflow and notifies Slack rather than throttling silently.

**The engine is copyable.** Everything that knows about meshin.co — path prefixes, route families,
format rules, collection names, thresholds — lives in one configuration file read by one loader and
validated against a schema. The CI diff classifier reads that file instead of re-expressing its
rules in shell, and an unclassifiable path runs the full graph rather than skipping it. A skill
states what a second site must set and a self-check command names what is missing.

## What this does not change

The locked rows stand. One concept is still defined on exactly one page, so a query whose concept
already owns a register row is strengthened, never duplicated. Every user-facing string still
enters the editorial ledger with a reason, and **automation never runs the seal**: a re-seal
preserves a human's old reason while refreshing the digest, which is how unreviewed copy was
certified green in this repository once already. CI still never writes the Lighthouse record, and
the push hook still binds the owner, so a merged article leaves a measurement debt that the loop
records and the owner clears.

**Strengthening a page stays a report, not an act.** When the rule picks the strengthen arm, the
run names the route, the query and the number, and stops. Adding a page risks only that the page is
poor; rewriting a live one changes words that are already published, already carry a human's
disposition and reason, and already hold whatever ranking the route has. Automating that would mean
a machine writing a human's reason for text no human read, which is the one failure this project
has already paid to undo. Automating the strengthen arm needs the editorial-ledger question
answered first, and that is a later change.

No new route family is created. Nothing about bookings, appointments or outbound links changes.
The site ships no visible line saying a page was machine-written; the record of what the machine
did lives in the repository, not on the page.
