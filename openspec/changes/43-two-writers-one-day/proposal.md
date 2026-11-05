# Two writers in one day

## Why

The unattended writer now writes two articles a day, and the second pull request of the day cannot merge. Pull request
#94 against the `main` of 2026-11-05 fails `git merge-tree --write-tree origin/main refs/tmp/94` with exit status 1 and a
content conflict in four files: `audits/phase-4.7/dispositions/routes.json`, `audits/routes.json`,
`audits/spend-report.md` and `docs/SEMANTIC-CORE.md`. Every one of them is derived: a generator the repository already
owns regenerates it wholesale from the corpus, and nothing in it is text that a merge has to reconcile.

The defect is structural. A writer run branches from `main`, regenerates these files from the corpus as it stood at that
moment and commits each file whole. While its pull request waits out the quarantine, a second run, or a human merge, moves
`main` and rewrites the same whole files from a different starting point. Git sees two full-file rewrites and gives up.
With one article a day nobody saw it. With two, the second pull request of every day is dead on arrival, and the loop
stops needing a human exactly where it was meant to stop needing one.

## What changes

**A pull request that `main` moved a derived file under is caught up on `main` by the watcher, with no human, before it is merged.**

- `site/scripts/derived-files.mjs` is the registry. It names the five files a run rewrites whole
  (`audits/routes.json`, `audits/phase-4.7/dispositions/routes.json`, `audits/spend-report.md`,
  `docs/SEMANTIC-CORE.md`, `site/content-facts.json`) and classifies any path as the run's own, shared, restated or foreign.
  The fifth file, `site/content-facts.json`, was not in the owner's list of four: it holds one target-query row for each
  route, and the same tail of the file is where two runs add their rows.
- `site/scripts/catch-up.mjs` merges `origin/main` into the branch without committing, refuses any conflict outside the
  derived set (`git merge --abort`, the branch left as it was), takes the side of `main` for every shared derived path,
  then replays what the branch added, from its own claim: the target query row with `addTargetQuery` and the buyer prompt
  passage with `insertPassage`. It then regenerates through `healRoute`, in `route-assembly.mjs`, which runs the same
  `regenerate` steps as `assembleRoute` (build, semantic core, registers, route ledger, restated dispositions, blocking
  checks) and re-stamps the digests of the branch's own disposition file. The spend report is regenerated with the later
  of the two `Generated-at` stamps and the new base as `Generated-from`.
- The catch-up is kept only when four things hold: a second `healRoute` and a second spend report change no byte, no row
  the branch added to `audits/routes.json`, `site/content-facts.json` or the semantic core is missing, nothing is left
  unstaged, and `git merge-tree --write-tree origin/main HEAD` exits 0 with no foreign path in the net diff. Otherwise
  the branch is reset to the head it started from.
- `site/scripts/pr-github.mjs` reads the drift with the compare API (`readDrift`) and the snapshot carries it.
  `pr-classify.mjs` has a new verdict, `catch-up`: green after quarantine, `main` ahead, and a derived path among the
  files `main` changed (a list that reached GitHub's page size counts as moved). It is the merge case with one step in
  front, so the quarantine is waited out first. A branch that already holds `CATCH_UP_CAP` (3) merge commits of the bot
  whose subject starts `chore(autowriter): catch up ` escalates `catch-up-cap` as no convergence. Nothing is stored: the
  count is a function of the pull request's own commits.
- `watch-pr.yml` is the same three jobs. The `watch` job passes a `kind` output to the `repair` job. A new secret-free
  step, `catchup`, runs `npm run catch-up:entry` (`site/scripts/catch-up-entry.mjs`) when the kind is `catch-up`, and
  `rewrite` runs for every other kind. The one `push` step, the only holder of the bot token in that job, is the same
  fast-forward push as before. Two outcomes are new, `conflict` (a hard stop) and `unconverged` (no convergence); a
  merge that was made is `repaired`, a branch that already holds `main` is `stale`.
- `gate:autowriter` has a new history rule, `unregistered-path-committed`: every path a pipeline commit changes must be
  the run's own, a registered derived path, or a restated disposition. A new derived file the writer starts to commit
  cannot start colliding without `derived-files.mjs` and the catch-up learning about it first. The one commit that
  predates the rule, `e8874d4`, committed Linux screenshot baselines of the blog and is allowed by its sha and that
  path prefix alone. Its specimen is `autowriterCommitAnUnregisteredPath` and its smoke row is
  `autowriter-commit-an-unregistered-path`.

### The writer's commit, file by file

Read from the three pipeline commits in this repository's history (`20fca6a`, `d716823`, `e8874d4`), each file with
whether two runs in flight can collide on it.

| file                                                                       | what the run does to it                | two runs collide?                                   |
| -------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------- |
| `audits/routes.json`                                                       | regenerated, one line a route          | yes, the same insertion point                       |
| `audits/phase-4.7/dispositions/routes.json`                                | restated: digest and reason of rows    | yes, whole rows                                     |
| `audits/spend-report.md`                                                   | regenerated, totals and stamps         | yes, every line moves                               |
| `docs/SEMANTIC-CORE.md`                                                    | one passage line, the generated block  | yes                                                 |
| `site/content-facts.json`                                                  | one target-query row                   | yes, the tail of the object                         |
| `audits/phase-4.7/dispositions/*.json` of other entries                    | restated when their text moved         | yes, when both restate the same one                 |
| `site/src/data/post/<slug>.md`                                             | new                                    | no                                                  |
| `audits/autowriter/claims/YYYY/MM/<slug>.json`                             | status                                 | no                                                  |
| `audits/autowriter/YYYY/MM/<slug>.json`, `generations/YYYY/MM/<slug>.json` | new                                    | no                                                  |
| `audits/phase-4.7/dispositions/YYYY/MM/generated-<slug>.json`              | new, digests stamped on the built page | no, until `main` changes the page                   |
| `site/tests/__screenshots__/linux/*.png`                                   | `e8874d4` only, 20 files               | retired: the visual gate stopped reading the corpus |

The row for the entry's own disposition says "until `main` changes the page": its digest is of the built route text, so
a catch-up re-stamps it.

### Mechanisms weighed

| mechanism                                                                           | the writer branch carries derived files | what main holds between the merge and the next run | verdict |
| ----------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------- | ------- |
| 1. The writer commits no derived file; a job on `main` regenerates and commits them | no                                      | a red tree until that job's commit lands           | lost    |
| 2. The watcher catches the branch up on `main` and regenerates (chosen)             | yes                                     | the tree the pull request's own checks judged      | chosen  |
| 3. Give the files a form that merges: one row a line, sorted, a union driver        | yes                                     | rows merged, digests and totals wrong              | lost    |

1 lost because the gates that judge a pull request read the committed files: `gate:routes`, the editorial digests,
`semantic-core --check` and the spend check of `gate:autowriter`. A pull request without them is either red or judged by
a gate that read nothing, which is a fake green. `AGENTS.md` keeps `audits/` evidence in the repository on purpose, and a
bot commit to `main` after each merge would leave `main` red between the two commits, push a second writer to `main`, and
need its own loop guard.

3 lost because most of what collides is not a row. A digest is the hash of the text as it stood, a total and a count are a
function of the whole corpus, and the spend report restamps every line. Rows alone would still collide at the same tail
line (`content-facts.json` ends its object without a trailing comma, so the last row changes when a row is added after
it), and the result of a union merge would still be wrong until something regenerates it, which is option 2 again.

2 won because the repository already owns every generator, because the catch-up reuses the writer's own sequence
(`regenerate`) and not a second copy of it, and because the remedy a person used by hand on pull request #94 was exactly
this ordered sequence: merge, take `main`'s side of the derived files, keep the article, build before the generators,
regenerate, verify. The cost is one merge commit of the bot on a branch that `main` moved under.

## Behaviour changes

1. A green pull request that `main` moved a derived file under is not merged at once. Its look ends in a repair job that
   adds one merge commit, then the chain continues and the next look judges the new head. CI runs again on it.
2. The squash merge into `main` is unchanged: the merge commit never reaches `main`, only its tree.
3. A branch is caught up at most three times. The fourth overtaking is an escalation, one issue and one Slack message.
4. The result equals what a writer run on top of the current `main` would have committed, because it is made by the same
   functions: a later run restates the same disposition rows with its own reason, as consecutive runs already do.
5. `gate:autowriter` refuses a pipeline commit that touches a path outside the registry.

## Why the watcher cannot loop

The catch-up writes only to the pull request branch. It never moves `main`, so nothing it does can make `main` move
again. `watch-pr.yml` is dispatched only from `main`, by the chain itself, and a push of the bot token starts the
branch's own CI. The cap counts the bot's catch-up merge commits in the pull request's own commit list, so it survives a
restarted chain and needs no stored counter. Two pull requests queue on the `watch-pr-<number>` concurrency group of
their own workflow runs, and a catch-up of one never waits for the other.

## Cost

One short repair job when a branch is overtaken: install, build, generators and the checks, a few minutes of a runner and
no model call. No spend against the monthly ceiling.

## Limits of what was done

- The reproduction runs over a fixture corpus. Git, the replay functions, the route ledger generator
  (`routes-gate.mjs`), the spend report generator and the merge logic are real. The build, the semantic core
  generator, the registers generator, the stale-disposition listing and the editorial gate are the stubs of
  `site/scripts/fixtures/route-repo.mjs`. No run of the catch-up through the real `npm run build` has been made; the Calibration Gate
  below is where that is measured.
- No GitHub Actions run has executed the new `catchup` step. The workflow tests pin the keys, the permissions and the
  absence of any secret in the step, and run its shell against stubs.
- The compare API's file page size, 300, is taken from the code that already reads commit files
  (`readCommitFiles`) [INFERENCE: not read from GitHub's documentation in this session]. Past it the watcher
  assumes a derived file moved.
- The generation record's `tree.parent` and `tree.fingerprint` still name the base the writer started from. No rule reads
  them after the commit.
- The catch-up and the spend report take their stamp from the later of the two reports. A regeneration a person runs
  later stamps its own clock, which is the existing behaviour.
- Only the first slot of the day pays attention to this: with one pull request in flight a day, `main` is never moved
  under it and the catch-up never runs.

## Not in scope

The search index and the llms files, which the writer's commit does not touch. No change to what a run writes or to the
quarantine, no stored flag, and no change to the repair of a red pull request.

## Calibration Gate

The built-byte surface changes (`site/scripts`), so the tasks carry a Calibration Gate group. The procedure is
`docs/plan/reference/calibration-gate.md`, which has no waiver path, and the owner runs the measurement below.

### Constants and what they were chosen from

| constant             | value | chosen from                                                                                                                                                                                                                           |
| -------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CATCH_UP_CAP`       | 3     | A bound, not a measurement. The shipped write times give two articles a day, so a branch is overtaken by at most the other run of its day, plus a retry after a push that failed. Three leaves room for both and ends a loop at once. |
| `COMPARE_FILES_PAGE` | 300   | The page size already used for commit files; past it the watcher catches up without reading the list.                                                                                                                                 |

### Pre-registered acceptance bar

Fixed before the measurement, to be read after 14 live UTC days with the writer configured and funded, two writer pull
requests a day, 28 in all:

1. Every writer pull request of the window merges with no commit by a person and no escalation of the kinds `hard-stop`
   and `no-convergence` that a catch-up raised.
2. On the tip of `main` at the end of the window, building and running the generators changes no byte of the five
   derived files.
3. The number of catch-ups each pull request needed is reported with its denominator, 28, and the cap was never reached.
   If no pull request was caught up, the mechanism is untested, not proven.

### The measurements the owner runs

From the repository root, after 14 days:

```sh
gh pr list --state merged --search 'head:autowriter/' --limit 100 --json number,mergedAt,headRefName
```

For every number listed:

```sh
gh api repos/meshin-co/website/pulls/<number>/commits --paginate \
  --jq '[.[] | select(.commit.message | startswith("chore(autowriter): catch up "))] | length'
gh api repos/meshin-co/website/pulls/<number>/commits --paginate \
  --jq '[.[] | select(.commit.author.email != "autowriter-bot@meshin.co")] | length'
```

The first number is the catch-ups of that pull request and the second the commits by anyone but the bot. The second must
be 0 for every pull request.

```sh
cd site && npm run build && npm run assets:routes && node scripts/semantic-core.mjs && node scripts/generate-registers.mjs \
  && node scripts/spend-report.mjs && git status --short -- ../audits ../docs content-facts.json
```

No line of output.

### Pending, owed by the owner before this change is archived

None of these has been run on this tree. Each is an unticked task.

- `npm run test:smoke`, including the new row `autowriter-commit-an-unregistered-path`. It needs a full build and three
  browsers.
- Lighthouse and the visual suite are not owed: no route changes. The Calibration Gate step list still applies, so the
  owner records that.
- The first live day with two writer pull requests in flight, read with the commands above.
- The Calibration Gate report for this change, which the owner commits under `audits/` once the gate has run (the file
  does not exist before then).
