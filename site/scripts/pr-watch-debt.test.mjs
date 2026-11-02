import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { QUARANTINE_HOURS, validateLedger } from './autowriter-ledger.mjs';
import { CLEAR_COMMAND } from './measurement-debt.mjs';
import { recordPath } from './record-layout.mjs';
import { LEDGER_FILINGS, LEDGER_PATH } from './fixtures/github-fake.mjs';
import { hoursAfterOpening } from './fixtures/pr-watch.mjs';
import {
  DEFAULT_TOKEN,
  MERGED_SHA,
  PAT,
  TREE_FINGERPRINT,
  callOf,
  green,
  harness,
  ledgerRecord,
  queued,
  spentAttempts,
  written,
  writtenNames,
} from './fixtures/pr-watch-harness.mjs';

const DEBT_IDENTITY = { name: 'autowriter-bot', email: 'autowriter-bot@meshin.co' };

const merged = async (options = {}) => {
  const bundle = options.bundle ?? green();
  const scene = await harness({ bundle, ...options });
  const { action } = await scene.run();
  const [, token, push] = callOf(scene.calls, 'putLedger');
  return { ...scene, bundle, action, token, push, ledger: JSON.parse(push.text) };
};

test('a merge writes exactly one ledger commit, to the base branch of the pull request, as the bot', async () => {
  const { action, calls, token, push, bundle } = await merged();

  assert.equal(action, 'merged');
  assert.deepEqual(writtenNames(calls), ['merge', 'putLedger']);
  assert.equal(token, PAT);
  assert.equal(push.path, LEDGER_PATH);
  assert.equal(push.branch, bundle.pullRequest.base.ref);
  assert.equal(push.branch, 'main');
  assert.equal(push.message, 'chore(autowriter): record the measurement debt of a-slug');
  assert.deepEqual(push.identity, DEBT_IDENTITY);
});

test('the ledger it writes is valid, merged at the instant of the write, and holds the debt of the merged tree', async () => {
  const { ledger, bundle } = await merged();
  const at = hoursAfterOpening(bundle, QUARANTINE_HOURS + 1).toISOString();

  assert.deepEqual(validateLedger(ledger), []);
  assert.deepEqual(ledger.verdict, { state: 'merged', reason: null, decidedAt: at });
  assert.deepEqual(ledger.measurementDebt, {
    mergedCommit: MERGED_SHA,
    fingerprint: TREE_FINGERPRINT,
    recordedAt: at,
    clear: CLEAR_COMMAND,
  });
});

test('the file is written as the ledger writer writes it, so a later read by that writer changes no byte', async () => {
  const { push, ledger } = await merged();

  assert.equal(push.text, `${JSON.stringify(ledger, null, 2)}\n`);
});

test('the update is made against the blob the ledger had at the merge commit', async () => {
  const { push } = await merged({ mergedLedger: { ...ledgerRecord(), blobSha: '7'.repeat(40) } });

  assert.equal(push.blobSha, '7'.repeat(40));
});

test('the tree and the ledger are read at the merge commit with the read token, between the merge and the write', async () => {
  const { calls } = await merged();

  assert.deepEqual(
    calls.map(([name]) => name),
    ['readSnapshot', 'merge', 'readTree', 'readLedgerAt', 'putLedger']
  );
  assert.deepEqual(callOf(calls, 'readTree'), ['readTree', DEFAULT_TOKEN, MERGED_SHA]);
  assert.deepEqual(callOf(calls, 'readLedgerAt'), ['readLedgerAt', DEFAULT_TOKEN, { slug: 'a-slug', ref: MERGED_SHA }]);
});

test('the base branch is whichever one the pull request names', async () => {
  const bundle = green();
  const base = { ...bundle.pullRequest.base, ref: 'trunk' };
  const { push } = await merged({ bundle, pullRequestPatch: { base } });

  assert.equal(push.branch, 'trunk');
});

test('what the ledger already recorded is kept beside the debt', async () => {
  const attempts = spentAttempts.slice(0, 2);
  const { ledger } = await merged({ mergedLedger: ledgerRecord({ attempts }) });

  assert.deepEqual(ledger.attempts, attempts);
  assert.equal(ledger.pullRequest, 72);
  assert.equal(ledger.runId, '41');
});

for (const [place, path] of Object.entries(LEDGER_FILINGS)) {
  test(`a ledger filed ${place} at the merge commit is updated where it is found`, async () => {
    const { push } = await merged({ mergedLedger: { ...ledgerRecord(), path } });

    assert.equal(push.path, path);
    assert.equal(push.blobSha, 'b'.repeat(40));
  });
}

test('a ledger absent at the merge commit is started for the pull request and created without a blob sha', async () => {
  const { push, ledger } = await merged({ mergedLedger: null });

  assert.equal(push.blobSha, null);
  assert.equal(ledger.slug, 'a-slug');
  assert.equal(ledger.pullRequest, 72);
  assert.equal(ledger.runId, '555');
  assert.deepEqual(validateLedger(ledger), []);
  assert.equal(ledger.measurementDebt.mergedCommit, MERGED_SHA);
});

test('a ledger absent at the merge commit is filed under the month of the merge, not the month the pull request opened in', async () => {
  const { push, now, bundle } = await merged({ mergedLedger: null, hours: 24 * 30 });

  assert.equal(push.path, recordPath('ledger', 'a-slug', now()));
  assert.notEqual(push.path, recordPath('ledger', 'a-slug', hoursAfterOpening(bundle, 0)));
});

test('a merge records no escalation, opens no issue and sends nothing to Slack', async () => {
  const { requests, ledger } = await merged();

  assert.deepEqual(requests, []);
  assert.deepEqual(ledger.escalations, []);
});

test('the step summary still names the merge', async () => {
  const { summary } = await merged();

  assert.match(readFileSync(summary, 'utf8'), /\| Action \| `merged` \|/);
});

test('only a merge that happened records a debt', async () => {
  const stale = { merged: false, reason: 'head-moved', message: 'Head branch was modified' };
  const refused = { merged: false, reason: 'refused', message: 'Pull Request is not mergeable' };
  const cases = [
    { bundle: green(), merge: stale },
    { bundle: green(), merge: refused },
    { bundle: green(), hours: 1 },
    { bundle: queued(green()) },
    { bundle: green(), pullRequestPatch: { merged: true, state: 'closed' } },
  ];
  for (const options of cases) {
    const { run, calls } = await harness(options);
    await run();

    assert.equal(
      calls.some(([name]) => ['readTree', 'readLedgerAt'].includes(name)),
      false
    );
    assert.equal(
      written(calls).some(([name, , args]) => name === 'putLedger' && args.branch === 'main'),
      false
    );
  }
});
