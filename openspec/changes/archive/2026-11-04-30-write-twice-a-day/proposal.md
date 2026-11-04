# Write twice a day, and never skip a slot

## Why

The owner wants more than one article a day, and he wants the schedule to be configuration rather
than a cron line typed into a workflow. Today the writer runs once a day at a time that only the
workflow file knows, no gate reads it, and a run that finds no fresh topic ends with no entry.

The second part matters more than the first. The site is new, so almost no Search Console traffic
exists yet and an empty demand report is the normal case for months. A writer that writes nothing
until traffic exists never creates the traffic. The owner chose, from the options put to him, that
a slot with no fresh topic writes anyway: first on a weaker measured query, and when the report
holds nothing, on a category taken from a configured list. He accepted the cost, said once and
recorded here: the corpus fills with topics nobody has searched for yet, and the average quality of
an entry drifts down. Because a decision nobody can measure is a decision nobody can revisit, every
entry now records where its topic came from.

## What changes

**The schedule is configuration.** `site/engine.config.json` gains `loop.writeTimesUtc`, a list of UTC
clock times, shipped as `03:17` and `15:17`. `npm run assets:schedule` generates the `schedule:` block
of `.github/workflows/write-daily.yml` from it, and `npm run gate:schedule` fails when the committed
workflow differs from a regeneration. An empty list, a malformed time and a repeated time are refused
at load. An empty list is refused because the alternative, a cron block that disappears with nothing
telling anyone, is worse than a refusal that says how to pause the writer.

**Nothing assumes the run started on time.** GitHub starts a scheduled run late, by minutes and
sometimes by much more. No script reads the configured times except the schedule modules (the generator, the gate
and what they share) and the configuration check, and a test pins that.

**Two runs cannot take one topic.** The workflow's concurrency group serialises overlapping runs and
never cancels a running one. The write job now checks out the current tip of `main`, so a run that
queued behind another sees the first run's claim. A test with a real bare repository proves three
things: a second run from a stale tree that picks the same topic is refused at the claim commit and
pushes nothing, a run from the current tip picks a different topic, and a claim made in one month
still blocks the same slug in the next.

**The picker descends a ladder.** An unproven buyer prompt, as today. Then the best measured query
that no buyer prompt names and no page answers, ordered by impressions. Then a category from
`loop.categoryRotation`. The run ends with no entry, through the existing no-entry path and its Slack
message, only when no rung yields a topic: the category list is empty and the report holds nothing,
or every proposal for every category was refused.

**A category becomes a specific article in the picker.** One model call per attempt, role `topic`,
returns one target query. The title and slug derive from it by the same code that derives them for a
demand topic, and the proposal then meets the same refusals as any topic: the concept register
(one definition per concept), the claim store, and a new repeat guard. The model sees the titles of
the existing articles and the concepts the register assigns elsewhere, and a refused proposal is
retried once with the reason. Categories are tried in rotation order until one proposal survives.

**The rotation has no counter.** The next category is the configured one with the fewest published
entries and unexpired category claims, ties broken by the oldest newest entry, then by the order of
the configuration. A deleted entry, an abandoned branch or a failed run changes the counts and so
the order, with no state to repair.

**The repeat guard.** The claim store prevents a duplicate slug, not two articles that say the same
thing in different words. The guard compares the word stems of a proposal's title and query with
those of every published and claimed article and refuses at 0.5 containment. Measured on the real
corpus, distinct published articles reach 0.20 at most and hand-reworded titles reach 0.60 to 1.00.
It does not catch a paraphrase that shares no topical stem. The concept register and the model's
sight of the existing titles are the other two layers, and the first article of each category will
show whether the three together are enough. That is what the Calibration Gate measures.

**Provenance.** Every claim and generation record carries `origin`: `demand`, `weak-demand` or
`category`. A weak entry also records why it is weak, computed from its report row. A category entry
records its category. Neither carries a buyer prompt, so neither registers a passage in the buyer
prompts section of the semantic core. A claim written before this change has no origin and reads as
`demand`. `npm run measure:origins` counts the entries by origin with their cost and, for category
entries, by category, so the owner can find the entries written blind when traffic arrives and
decide which to rewrite.

**A proposal is spent like a draft.** The call is recorded in the generation record with the role
`topic`, together with every refused proposal of the same run, and counts toward the monthly ceiling
and the spend report. The proposal runs in the pick step, which therefore receives the writer's
variables, and a credential, configuration, model or price failure there escalates the way a failed
write does.

## Not in scope

- The press, the watcher, the layout of any Slack payload, the link job and the visual gate.
- Changing a published entry. A weak or blind entry is rewritten by a person when traffic arrives.
- Spend of a run whose every proposal is refused: no entry has a slug, so no ledger exists. The run
  prints the figure in its step summary. The most it can be is two calls per configured category,
  eight with the shipped list, under three cents at the shipped rates.

## Impact

- Changed: `site/engine.config.json`, `site/scripts/engine-config.schema.json`,
  `.github/workflows/write-daily.yml`, `.github/workflows/ci.yml`, the picker and the writer's prompt
  files under `site/scripts`, the claim and generation record schemas.
- New: `site/scripts/schedule-workflow.mjs`, `generate-schedule.mjs`, `schedule-gate.mjs`,
  `schedule-specimens.mjs`, `topic-repeat.mjs`, `topic-categories.mjs`, `topic-proposal.mjs`, `measure-origins.mjs`.
- Specs: `content/generated-articles`, `governance/unattended-publishing`,
  `governance/spend-reporting`.
- Documents: the skills that describe the writer's loop, `docs/plan/reference/locked-decisions.md`
  (the row that fixes how the next article is chosen) and `docs/plan/reference/new-site-interview.md`.
