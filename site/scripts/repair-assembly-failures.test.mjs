import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';

import { ATTEMPT_CAP } from './autowriter-ledger.mjs';
import { claimOf } from './fixtures/entry-drafts.mjs';
import {
  buildFailure,
  FORMAT,
  keysOf,
  landedRepo,
  PRETTIER_ENTRY,
  removeRepos,
  removeTemplates,
  repair,
  repairRun,
  ROUTE,
  STALE_COMMAND,
  treeOf,
} from './fixtures/repair-repo.mjs';
import { WriterError } from './writer-error.mjs';

afterEach(removeRepos);
after(removeTemplates);

const STEPS = [
  PRETTIER_ENTRY,
  'npm run build',
  'node scripts/semantic-core.mjs',
  'node scripts/generate-registers.mjs',
  STALE_COMMAND,
  FORMAT,
];

for (const step of STEPS)
  test(`when "${step}" fails the run stops there and the tree is byte for byte what it was`, async () => {
    const root = await landedRepo();
    const before = treeOf(root);
    const run = repairRun(root, { fail: { [step]: { status: 2, stdout: 'something broke' } } });

    await assert.rejects(repair(root, run), buildFailure(step, 'something broke'));

    assert.equal(keysOf(run).at(-1), step);
    assert.deepEqual(treeOf(root), before);
  });

test('a red check after the restating names the entry its output mentions', async () => {
  const root = await landedRepo();
  const fail = { 'npm run gate:editorial': { status: 1, stdout: `FAIL ${ROUTE} is stale` } };

  await assert.rejects(repair(root, repairRun(root, { fail })), buildFailure(`entries named in the output: ${ROUTE}`));
});

test('a command that never finishes is a failure naming the command, and the tree is restored', async () => {
  const root = await landedRepo();
  const before = treeOf(root);
  const run = repairRun(root, { fail: { 'npm run build': { status: null, stderr: 'timed out' } } });

  await assert.rejects(repair(root, run), buildFailure('npm run build', 'did not finish'));
  assert.deepEqual(treeOf(root), before);
});

test('a command that throws leaves the tree restored and lets the error through', async () => {
  const root = await landedRepo();
  const before = treeOf(root);
  const inner = repairRun(root);
  const run = (command, args, options) => {
    if (args.includes('build')) throw new Error('spawn failed');
    return inner(command, args, options);
  };

  await assert.rejects(repair(root, run), /spawn failed/);
  assert.deepEqual(treeOf(root), before);
});

test('a failed run followed by a good one returns what a good run alone returns', async () => {
  const root = await landedRepo();
  const clean = await landedRepo();

  await assert.rejects(repair(root, repairRun(root, { fail: { 'npm run build': { status: 1 } } })), WriterError);
  const afterFailure = await repair(root, repairRun(root));

  assert.deepEqual(afterFailure, await repair(clean, repairRun(clean)));
});

const REFUSED = {
  'a format the writer does not write': { claim: { ...claimOf('article'), format: 'faq-answer' } },
  'a run date that is not a calendar day': { runDate: '2026-02-30' },
  'a missing claim': { claim: undefined },
  'a missing draft': { draft: undefined },
  'no attempt': { attempt: undefined },
  'an attempt past the cap': { attempt: { number: ATTEMPT_CAP + 1, of: ATTEMPT_CAP } },
};

for (const [name, overrides] of Object.entries(REFUSED))
  test(`${name} is refused before any file or command is touched`, async () => {
    const root = await landedRepo();
    const before = treeOf(root);
    const run = repairRun(root);

    await assert.rejects(repair(root, run, overrides), buildFailure());
    assert.deepEqual(run.calls, []);
    assert.deepEqual(treeOf(root), before);
  });

for (const claimedAt of [undefined, '', 'yesterday', '2026-02-30T00:00:00Z'])
  test(`a claim time of ${JSON.stringify(claimedAt)} leaves no month for the generation record the reason names and is refused before any file or command is touched`, async () => {
    const root = await landedRepo();
    const before = treeOf(root);
    const run = repairRun(root);

    await assert.rejects(repair(root, run, { claim: { ...claimOf('article'), claimedAt } }), /is not a UTC instant/);
    assert.deepEqual(run.calls, []);
    assert.deepEqual(treeOf(root), before);
  });
