import './no-network.mjs';

import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { WRITERS, branchOf, landOnRemote, mergeProbe, startDay } from './two-writers.mjs';

const days = [];
const day = async () => {
  const started = await startDay();
  days.push(started);
  return started;
};
after(() => days.forEach((started) => started.cleanup()));

const SHARED_FILES = [
  'audits/phase-4.7/dispositions/routes.json',
  'audits/routes.json',
  'audits/spend-report.md',
  'docs/SEMANTIC-CORE.md',
  'site/content-facts.json',
];

test('two writer runs branch from one base and each commits the whole derived set beside its own records', async () => {
  const { runs } = await day();

  assert.deepEqual(
    runs.map(({ branch }) => branch),
    WRITERS.map(branchOf)
  );
  for (const { files, claim } of runs) {
    for (const path of SHARED_FILES) assert.ok(files.includes(path), `${claim.slug} did not commit ${path}`);
    assert.ok(files.includes(`site/src/data/post/${claim.slug}.md`));
  }
});

test('the first pull request of the day lands, and then the second cannot merge: what collides is the derived set', async () => {
  const { remote, runs } = await day();
  const [first, second] = runs;

  assert.equal(mergeProbe(remote, 'main', first.branch).status, 0, 'the first pull request merges');
  assert.equal(landOnRemote(remote, first.branch, `feat(autowriter): write ${first.claim.slug} (#1)`).merged, true);

  const probe = mergeProbe(remote, 'main', second.branch);
  assert.equal(probe.status, 1, 'git merge-tree --write-tree exits 1 on the second pull request');
  assert.deepEqual(probe.conflicts, SHARED_FILES);
  assert.equal(landOnRemote(remote, second.branch, 'feat(autowriter): second (#2)').merged, false);
});
