import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { ATTEMPT_CAP } from './autowriter-ledger.mjs';
import { COMMIT, ENTRY, FAILURE, cleanup, ledgerAfter, reworded, world } from './fixtures/repair-world.mjs';
import { RepairStop } from './repair-outcome.mjs';
import { repairRun } from './repair-run.mjs';

after(cleanup);

const stops = (outcome, pattern) => (error) =>
  error instanceof RepairStop && error.outcome === outcome && pattern.test(error.message);

test('a repairable finding drives a rewrite through the build and into one commit', async () => {
  const rewritten = reworded();
  const { io, adapter, assembled, committed } = world({ drafts: [rewritten] });

  const result = await repairRun(io);

  assert.equal(result.outcome, 'repaired');
  assert.equal(result.commit, COMMIT);
  assert.equal(result.attempt, 1);
  assert.equal(adapter.requests.length, 1);
  assert.equal(assembled.length, 1);
  assert.deepEqual(assembled[0].draft, rewritten);
  assert.deepEqual(assembled[0].attempt, { number: 1, of: ATTEMPT_CAP });
  assert.equal(committed.length, 1);
});

test('the attempt cap stops the loop before the model is verified or asked', async () => {
  const { io, adapter, committed } = world({
    ledger: ledgerAfter(
      [{ rule: 'first-rule', path: ENTRY }],
      [{ rule: 'second-rule', path: ENTRY }],
      [{ rule: 'third-rule', path: ENTRY }]
    ),
  });

  await assert.rejects(repairRun(io), stops('no-convergence', /attempts/));

  assert.equal(adapter.requests.length, 0);
  assert.equal(adapter.state.verified, 0);
  assert.equal(committed.length, 0);
});

test('a failure identical to the one an earlier attempt answered escapes at once, without a model call', async () => {
  const { io, adapter, committed } = world({ ledger: ledgerAfter([FAILURE]) });

  await assert.rejects(repairRun(io), stops('no-convergence', /attempt 1/));

  assert.equal(adapter.requests.length, 0);
  assert.equal(adapter.state.verified, 0);
  assert.equal(committed.length, 0);
});

test('a failure that differs only in its path is not identical, so the repair goes ahead', async () => {
  const { io, adapter } = world({ ledger: ledgerAfter([{ rule: FAILURE.rule, path: '/blog/another' }]) });

  const result = await repairRun(io);

  assert.equal(result.outcome, 'repaired');
  assert.equal(adapter.requests.length, 1);
});

test('a finding the table refuses stops the loop before any model call, naming the reason', async () => {
  const kinds = {
    judgeFindings: () => ({
      rewrite: [],
      refused: [{ gate: 'gate:content', rule: 'inbound-links', subjects: [ENTRY], reason: 'outside-entry' }],
    }),
    allowancesOf: () => [],
  };
  const { io, adapter } = world({ kinds });

  await assert.rejects(repairRun(io), stops('unrepairable', /inbound-links.*outside-entry/));

  assert.equal(adapter.requests.length, 0);
});

test('a table that finds nothing to rewrite stops the loop before any model call', async () => {
  const kinds = { judgeFindings: () => ({ rewrite: [], refused: [] }), allowancesOf: () => [] };
  const { io, adapter } = world({ kinds });

  await assert.rejects(repairRun(io), stops('unrepairable', /no finding asks for a rewrite/));

  assert.equal(adapter.requests.length, 0);
});

test('a reached spend ceiling stops the repair before the model is verified or asked', async () => {
  const { io, adapter, counts } = world({ reached: true });

  await assert.rejects(repairRun(io), stops('spend-ceiling', /50/));

  assert.equal(counts.ceiling, 1);
  assert.equal(adapter.state.verified, 0);
  assert.equal(adapter.requests.length, 0);
});

test('a stale pull request stops the repair before anything is read or spent', async () => {
  const { io, adapter, counts } = world();
  io.open = async () => {
    throw new RepairStop('stale', 'the pull request head moved');
  };

  await assert.rejects(repairRun(io), stops('stale', /moved/));

  assert.equal(counts.ceiling, 0);
  assert.equal(adapter.requests.length, 0);
});
