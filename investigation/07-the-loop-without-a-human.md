---
record: true
---

# 07 — The loop without a human: why a bot push waited for a click, why an escalation was final, and what else stops a clean run, 2026-11-03

Dated 2026-11-03. Written on branch `feat/32-the-loop-does-not-need-a-human` after reading the loop
(`.github/workflows/write-daily.yml`, `watch-pr.yml`, `ci.yml`, `publish-live.yml`, and the scripts
`pr-watch.mjs`, `pr-classify.mjs`, `pr-checks.mjs`, `pr-github.mjs`, `escalate*.mjs`) and the repository
through the GitHub API. Every figure below was read from an API response on this day, and the command is
given so the owner can read it again. A sentence marked `[INFERENCE]` says what I did not observe.

## 1. Why GitHub held the CI run

Three things could have held it: the actor, the token, or the repository's "require approval" setting.

**The held run.** `gh api repos/meshin-co/website/actions/runs/41586576349/attempts/1` returns
`"conclusion":"action_required"`, `"event":"pull_request"`, `"actor":"github-actions[bot]"`,
`"triggering_actor":"github-actions[bot]"`, `"head_commit_author":"baseline-bot@meshin.co"`. The same path
with `/jobs` ends `"total_count":0`: the run never started a job. Attempt 2 (`/attempts/2`) shows
`"triggering_actor":"meshin-dev"`: the owner re-ran it by hand.

**The control, seven minutes earlier, same branch.** On `autowriter/ai-readiness-assessment-template-for-smb`
the watcher pushed head `6469253b` with `AUTOWRITER_PAT`. Run 41585893514 for it: `"actor":"meshin-dev"`,
`"triggering_actor":"meshin-dev"`, `"conclusion":"success"`, attempt 1, nothing held. Same repository, same
branch, same pull request, same workflow. Both commit authors (`autowriter-bot@meshin.co`,
`baseline-bot@meshin.co`) are e-mail strings that belong to no GitHub account. Only the token differs.

**The whole repository.** Of 115 `pull_request` runs (2026-09-16 to 2026-11-03), 109 have actor
`meshin-dev` and none was held. Six have actor `github-actions[bot]`: five concluded `action_required`
with zero jobs (38909671297, 38951667111, 38985777550, 39041810354, 41586576349) and one concluded
`failure` with zero jobs (41194290941, pull request 68). All six head commits are authored
`baseline-bot@meshin.co`, which is the commit the `regen-baselines` job of `ci.yml` makes. No run by
`meshin-dev` carries that author.

**The setting.** `gh api repos/meshin-co/website/actions/permissions/fork-pr-contributor-approval` returns
`{"approval_policy":"first_time_contributors"}`, and the same call on `orgs/meshin-co` returns the same
value. The setting decides which pull requests from forks wait for a maintainer. None of the branches above
is a fork, and the 109 unheld runs ran under the same value. GitHub's text says the same thing from the
other side: docs.github.com, "Triggering a workflow" — a `pull_request` event of type `opened`,
`synchronize` or `reopened` made by a workflow using `GITHUB_TOKEN` creates the run in an approval-required
state, and the way out is a GitHub App installation token or a personal access token; changelog
2026-06-11, "Bot-created pull requests can run workflows if approved". I found no setting, in the API or in
that documentation, that exempts `github-actions[bot]`.

**Verdict.** The cause is the token. The default `GITHUB_TOKEN` makes the pushing actor
`github-actions[bot]`, and GitHub holds the `pull_request` run that such a push starts. The actor is how
the token shows up. The approval setting is not involved, and no repository setting can be loosened to fix
it. The `regen-baselines` job checked out with the default token and ran `git push` with it.

**The change.** `regen-baselines` now checks out with `persist-credentials: false`, pushes with
`AUTOWRITER_PAT` in one step through a header given to that one command (the way the repair job of
`watch-pr.yml` pushes), fails with a message when the secret is missing, and holds `contents: read` so the
default token cannot push even by mistake. `site/scripts/bot-push-token.test.mjs` fails for any workflow
step that pushes without that pattern. The live proof is not observed yet, because dispatching the job is
not mine to do: after the next dispatch, `gh api repos/meshin-co/website/actions/runs?event=pull_request
--jq '.workflow_runs[0] | [.actor.login, .conclusion]'` must show `meshin-dev` and no `action_required`.

**What the owner weighs.** A push by the PAT starts CI with no human look at the commit, and the
`deploy-preview` job of `ci.yml` hands `CLOUDFLARE_API_TOKEN` to a job of that run. The writer's own pushes already behave this way (the
article pull request's first run is the unheld run 41623809660), so the regen push adds more of the same
and no new kind of exposure. Two alternatives: leave it and click Approve on every regen run, which is what
happened; or replace the owner's personal token with a GitHub App installation token, so the actor is an
app, the token expires within the hour, and the owner's account stops being the thing that is exposed.

## 2. Why an escalation was final, and how a pull request re-enters

`pr-classify.mjs` treats any verdict in the ledger as final (`decidedBefore`, "ledger-decided"), and the
escalation commit writes one. Nothing looked at the pull request again. Issues #79 (pull request 78, closed
unmerged 2026-11-02T22:36:46Z), #82 (pull request 81, **merged** 2026-11-03T08:09:03Z) and #85 (pull
request 84, open) are the three on record; #79 and #82 are still open because nothing closes an
escalation issue, not even for a pull request that merged.

**A second hole, found on the way.** `ci.yml` job `changes` classified `github.event.before`..`github.sha`,
which on a `synchronize` event is the last push only. The watcher's escalation commit on pull request 84
(head `ca4cabcdfd`) changes only the ledger, so it classified as prose, every heavy job was skipped and
`all required jobs passed` went green (run 41625241714), while the run before it (41623809660) had been
cancelled after `visual-and-axe (2)` failed. Today `gh api repos/meshin-co/website/pulls/84` reads
`"mergeable_state":"clean"`, and `branches/main/protection` answers 404 "Branch not protected" and
`rulesets` is `[]`: one click merges an article that failed its visual gate. The classifier now takes
`github.event.pull_request.base.sha` first, so a pull request is judged by its whole diff against its
base. A re-entry that wrote a ledger-only commit would have hit the same hole.

**How a pull request re-enters.** The workflow `resume-pr.yml` runs on a push to main and on an owner
dispatch naming a pull request. It has no schedule. For each open `autowriter/*` pull request whose ledger
holds an escalated verdict, `npm run resume:pr` decides, and on a resume it appends an entry to the
ledger's `resumes` array, pushes that ledger commit with the PAT (a push by the PAT starts CI unheld), comments on the escalation
issue, and dispatches the watcher. The same run closes the issue of any pull request that has since merged or closed, which closes
#79 and #82 the first time it runs. A verdict is in force only while no resume is newer than it.

**How it tells a repaired pull request from one nobody will fix.** It never guesses whether the pull
request will pass. Three brakes decide whether it tries at all:

1. The kind. Two escalations are eligible. One is raised because a job that is not a content gate failed
   (ledger kind `unrepairable`, the watcher's reason `not-a-content-gate`; the case of #79, #82 and #85);
   it waits for the event of brake 2. The other is raised because a run waits for approval (kind
   `hard-stop`, reason `approval-required`); it resumes once and at once, since a change on main cannot
   release a held run, and a second one waits for brake 2. A content gate still failing at the attempt cap,
   the spend ceiling, a rejected credential, any other reason, and any commit by a human on the branch are
   real reasons and are never resumed automatically.
2. The event. A commit on main after the verdict, and after the last resume, must change the build
   surface (the `needsFullGraph` rule CI already uses). The daily demand-report commit changes only
   `audits/`, so it never resumes anything.
3. The cap. Two automatic resumes per pull request, ever (`RESUME_CAP`). The number is mine; no locked row
   gives one, so the owner confirms or changes it.

A pull request nobody fixes costs one short job per push to main and no CI run until main changes in code,
and at most two full CI runs after that (pull request 84's first run lasted 9 minutes 28 seconds, from
10:59:34Z to 11:09:02Z, before the failed visual job cancelled it).
A failure that persists burns the cap and ends at a human: every escalation opens its own issue
(`escalate-channels.mjs` posts a new one each time and never looks for an open one), and the sweep closes
them all once the pull request merges or closes. A resume is never silent: it is in the ledger and on the
latest issue. The owner can force one past brakes 1 and 2
with `gh workflow run resume-pr.yml -f pr=N`; the ledger records `by: owner`.

**Not covered.** `[INFERENCE]` A pull request with a merge conflict gets no `pull_request` runs from GitHub,
and the watcher has no rule for it (`grep -n "mergeable\|dirty\|conflict" site/scripts/pr-*.mjs` finds only
the quarantine and a refused merge). I did not trace what the watcher does with a pull request that has no
checks for hours. A watcher chain that died would also be silent; all 8 `Watch PR` runs on record
concluded `success`, so I have not seen it happen.

## 3. The walk, from the schedule to the published page

"Unattended" means no human has to notice or act on a normal day.

1. **Trigger.** `schedule`, cron `17 3 * * *`. The first scheduled run, number 8, was created at
   2026-11-03T10:55:18Z, 7 h 38 min after 03:17 UTC; GitHub does not promise the minute. Completes, late.
   Expect the article any time before midday UTC. Nothing to change.
2. **`configured`.** Needs `AUTOWRITER_PAT`, `AUTOWRITER_OPENAI_API_KEY`, `GSC_SERVICE_ACCOUNT_JSON`,
   `SLACK_WEBHOOK_URL` and four `vars`. All eight exist today (`gh api .../actions/secrets`, `.../variables`).
   If one is deleted the run still ends green, writes nothing, and says so only in the step summary; the
   workflow text says why: "rather than failing every morning". Completes today. Owner decision, not
   changed: if a missing name should be loud, the change is `exit 1` after the summary in that step.
3. **Spend ceiling.** Stops before any model call, commits a notice, posts to Slack. A human is told, by
   design.
4. **Demand refresh.** A Search Console failure stops the day and escalates: the step is named "escalate a
   refresh that failed, because selecting from the previous report is never allowed" and holds the Slack
   webhook. A human is told, by design.
5. **Pick and claim.** "Nothing to write" posts to Slack. A write commits the claim to main first.
   Completes.
6. **Write, push, open the pull request, start the watcher.** Done unattended on 2026-11-03: run 8 made
   pull request 84 and dispatched `Watch PR`. Completes.
7. **First CI run.** The pull request is opened with the PAT, so it starts unheld (run 41623809660, actor
   `meshin-dev`). Completes.
8. **CI verdict.** On pull request 84, `visual-and-axe (2)` failed. Whether a new article can pass the
   visual gate is the visual-gate work, not this change. The watcher may not repair a job that is not a
   content gate, so it escalated. Until that work lands a human is needed here. After this change the
   escalated pull request re-enters on its own once main is repaired in code.
9. **Regenerating Linux baselines.** `regen-baselines` is `workflow_dispatch` only, and every dispatch on
   record is by `meshin-dev`; the loop never starts it. Its push no longer waits for a click, but pressing
   the button is still a human act. Owner decision: let the watcher dispatch it for a missing baseline, or
   make new article pages not need one.
10. **Watcher.** Ticks every 3 minutes (environment `autowriter-tick`, wait timer 3), repairs content-gate
    failures up to the attempt cap, merges with the PAT after quarantine. Completes. Escalation used to end
    here; now it can resume (section 2).
11. **Telling the owner.** An escalation opens an issue with no assignee and no label, created by
    `github-actions[bot]`, and the repository has `subscribers_count: 0`. Whether the owner is e-mailed
    depends on his own notification settings. Setting: Watch, All activity, on the repository, or an
    assignee on the issue. The Slack message payloads are another change's work and are untouched here.
12. **Merge to the public page.** `publish-live.yml` is `on: workflow_dispatch` only. The last five runs
    (12 to 16) are all dispatched by `meshin-dev`; run 16 started 08:17:26Z, 8 minutes after pull request
    81 merged at 08:09:03Z. The skill `publish-the-build.md` records it: "Production is **Publish Live**,
    pressed by hand". So a merged article is not public until the owner presses it. Owner decision. The
    exact change to remove the click: add `workflow_run` with `workflows: [ci]`, `types: [completed]`,
    `branches: [main]` to `on:`, and `if: github.event.workflow_run.conclusion == 'success'` to the job.
    The `production` environment has no protection rules (`protection_rules: []`), so nothing else would
    hold it. The cost: a merged article goes public with no human look in between.
13. **Main is not protected.** 404 on `branches/main/protection`, `[]` on `rulesets`. The watcher's own
    rules are the only thing that keeps a red pull request from merging. Setting: a ruleset on `main`
    requiring the check `all required jobs passed`, with the PAT's user as the one bypass.
14. **Measurement debt.** Lighthouse runs only on the owner's machine (L59). Each unattended article
    merges without it and adds debt to its ledger. Only the owner clears it. By design.

Of these, steps 1 to 7 and 10 complete unattended today, step 8 completes once the visual-gate work lands,
and steps 9, 11, 12, 13 and 14 need the owner. Step 2 is a decision already made.
