import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { QUARANTINE_HOURS } from './autowriter-ledger.mjs';
import { CATCH_UP_SUBJECT } from './derived-files.mjs';
import { CATCH_UP_CAP, VERDICTS } from './pr-classify.mjs';
import { readDrift } from './pr-github.mjs';
import { repairOutputs } from './pr-watch-repair.mjs';
import { ESCALATION_KIND, OUTCOMES } from './repair-outcome.mjs';
import { apiAnswering, json, snapshotOf } from './fixtures/github-fake.mjs';
import { at, classify, green } from './fixtures/pr-classify-helpers.mjs';
import { asInput } from './fixtures/pr-watch.mjs';

const HEAD = 'f'.repeat(40);
const MOVED = { behindBy: 2, paths: ['audits/routes.json', 'site/src/data/post/another.md'] };
const settled = (bundle) => at(bundle, QUARANTINE_HOURS + 1);

function withCatchUps(bundle, count) {
  const owned = asInput(bundle);
  const tip = owned.commits.at(-1);
  const caughtUp = (number) => ({
    ...tip,
    sha: String(number).repeat(40),
    parents: [{ sha: 'a'.repeat(40) }, { sha: 'b'.repeat(40) }],
    commit: { ...tip.commit, message: `${CATCH_UP_SUBJECT}a-slug on abc123${number}` },
  });
  return [...owned.commits.slice(0, -1), ...Array.from({ length: count }, (_, at) => caughtUp(at + 1)), tip];
}

test('a green pull request past quarantine that main moved under in a derived file is caught up, not merged', () => {
  const bundle = green();
  const outcome = classify(bundle, { ...settled(bundle), drift: MOVED });

  assert.equal(outcome.verdict, 'catch-up');
  assert.equal(outcome.reason, 'main-moved');
  assert.equal(outcome.evidence.head, bundle.pullRequest.head.sha);
  assert.ok(VERDICTS.includes('catch-up'));
});

test('main moving files that are not derived leaves the pull request to merge', () => {
  const bundle = green();
  const drift = { behindBy: 3, paths: ['site/src/pages/index.astro'] };

  assert.equal(classify(bundle, { ...settled(bundle), drift }).verdict, 'merge');
});

test('a branch main has not moved is merged as before', () => {
  const bundle = green();

  assert.equal(classify(bundle, { ...settled(bundle), drift: { behindBy: 0, paths: [] } }).verdict, 'merge');
  assert.equal(classify(bundle, settled(bundle)).verdict, 'merge');
});

test('a file list that GitHub cut short counts as moved, because a derived file may be in the cut part', () => {
  const bundle = green();

  assert.equal(classify(bundle, { ...settled(bundle), drift: { behindBy: 1, paths: null } }).verdict, 'catch-up');
});

test('the catch-up waits out the quarantine like the merge it comes before', () => {
  const bundle = green();
  const outcome = classify(bundle, { ...at(bundle, 1), drift: MOVED });

  assert.equal(outcome.verdict, 'unsettled');
  assert.equal(outcome.reason, 'quarantine');
});

test('the cap counts only the merge commits the bot made to catch up, and the last one under it still catches up', () => {
  const bundle = green();
  const under = classify(bundle, { ...settled(bundle), commits: withCatchUps(bundle, CATCH_UP_CAP - 1), drift: MOVED });
  const spent = classify(bundle, { ...settled(bundle), commits: withCatchUps(bundle, CATCH_UP_CAP), drift: MOVED });

  assert.equal(under.verdict, 'catch-up');
  assert.equal(spent.verdict, 'escalate');
  assert.equal(spent.reason, 'catch-up-cap');
  assert.equal(spent.kind, 'no-convergence');
});

test('the drift is read from the compare of the head with the base branch, and a long file list is unknown', async () => {
  const files = [{ filename: 'audits/routes.json' }, { filename: 'new.md', previous_filename: 'old.md' }];
  const short = apiAnswering(() => json({ ahead_by: 2, behind_by: 1, files }));
  const long = apiAnswering(() =>
    json({ ahead_by: 1, behind_by: 0, files: Array.from({ length: 300 }, () => files[0]) })
  );

  assert.deepEqual(await readDrift(short.api, { head: HEAD, base: 'main' }), {
    behindBy: 2,
    paths: ['audits/routes.json', 'new.md', 'old.md'],
  });
  assert.equal(short.calls[0].path, `compare/${HEAD}...main`);
  assert.deepEqual(await readDrift(long.api, { head: HEAD, base: 'main' }), { behindBy: 1, paths: null });
});

test('the snapshot of a pull request carries the drift of its head', async () => {
  const bundle = green();
  const { snapshot, paths } = await snapshotOf(bundle, {
    compare: { ahead_by: 1, behind_by: 0, files: [{ filename: 'audits/routes.json' }] },
  });

  assert.deepEqual(snapshot.drift, { behindBy: 1, paths: ['audits/routes.json'] });
  assert.ok(paths.some((path) => path.startsWith(`compare/${bundle.pullRequest.head.sha}...`)));
});

test('a catch-up says so to the job that runs it, and an entry repair says entry', () => {
  const snapshot = { pullRequest: { head: { ref: 'autowriter/a-slug' } } };
  const asked = (verdict) =>
    repairOutputs({ action: 'repair', result: { verdict, evidence: { head: HEAD } }, snapshot });

  assert.deepEqual(asked('catch-up'), { repair: 'true', head: HEAD, branch: 'autowriter/a-slug', kind: 'catch-up' });
  assert.equal(asked('repairable').kind, 'entry');
});

test('a catch-up that meets a conflict is a hard stop, and one that does not converge is no convergence', () => {
  assert.ok(OUTCOMES.includes('conflict'));
  assert.ok(OUTCOMES.includes('unconverged'));
  assert.equal(ESCALATION_KIND.conflict, 'hard-stop');
  assert.equal(ESCALATION_KIND.unconverged, 'no-convergence');
});
