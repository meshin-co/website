import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { LedgerError } from './autowriter-ledger.mjs';
import { CLEAR_COMMAND } from './measurement-debt.mjs';
import { GitHubError } from './pr-github.mjs';
import { MERGED_SHA, TREE_FINGERPRINT, green, harness, ledgerRecord, readJson } from './fixtures/pr-watch-harness.mjs';

const FINGERPRINT = /\b[0-9a-f]{64}\b/;

const refusal = (status, message) =>
  new GitHubError({ method: 'PUT', path: 'contents/audits/autowriter/a-slug.json', status, body: { message } });

const stopsAt = (during, error, options = {}) => harness({ bundle: green(), failWith: { during, error }, ...options });

const putCalls = (calls) => calls.filter(([name]) => name === 'putLedger');

test('a write the base branch refuses raises a hard stop naming the merged commit, the fingerprint, the cure and the error', async () => {
  const error = refusal(409, 'main is protected: changes must be made through a pull request');
  const { run, requests, ledgerPath } = await stopsAt('putLedger', error);

  await assert.rejects(run(), (thrown) => thrown === error);
  assert.equal(requests.length, 1);
  assert.ok(requests[0].url.endsWith('/issues'));
  const { title, body } = requests[0].body;
  assert.match(title, /#72/);
  assert.match(title, /measurement debt/);
  for (const named of [MERGED_SHA, TREE_FINGERPRINT, CLEAR_COMMAND, error.message])
    assert.ok(body.includes(named), `the issue does not name ${named}`);
  assert.equal(readJson(ledgerPath).escalations[0].kind, 'hard-stop');
});

test('the hard stop is only an issue, and is never pushed to the pull request branch, which the merge may have deleted', async () => {
  const { run, calls, requests } = await stopsAt('putLedger', refusal(422, 'Reference does not exist'));

  await assert.rejects(run(), GitHubError);
  assert.equal(putCalls(calls).length, 1);
  assert.equal(putCalls(calls)[0][2].branch, 'main');
  assert.equal(requests.length, 1);
});

test('a write the token is refused is still a hard stop with what GitHub answered, never a credential escalation', async () => {
  const error = refusal(403, 'Resource not accessible by personal access token');
  const { run, requests, ledgerPath } = await stopsAt('putLedger', error);

  await assert.rejects(run(), (thrown) => thrown === error);
  assert.equal(requests.length, 1);
  assert.equal(readJson(ledgerPath).escalations[0].kind, 'hard-stop');
  assert.ok(requests[0].body.body.includes('Resource not accessible by personal access token'));
});

test('a tree GitHub cut short stops before any fingerprint exists, so the hard stop names the commit and no fingerprint', async () => {
  const error = new Error(`the tree of ${MERGED_SHA} is incomplete`);
  const { run, calls, requests } = await stopsAt('readTree', error);

  await assert.rejects(run(), (thrown) => thrown === error);
  const { body } = requests[0].body;
  assert.ok(body.includes(MERGED_SHA));
  assert.ok(body.includes(CLEAR_COMMAND));
  assert.ok(body.includes(error.message));
  assert.doesNotMatch(body, FINGERPRINT);
  assert.deepEqual(
    calls.map(([name]) => name).filter((name) => ['readLedgerAt', 'putLedger'].includes(name)),
    []
  );
});

test('a ledger that cannot be read at the merge commit stops after the fingerprint, and the hard stop names it', async () => {
  const error = new LedgerError('audits/autowriter/a-slug.json', ['attempts must be an array']);
  const { run, calls, requests } = await stopsAt('readLedgerAt', error);

  await assert.rejects(run(), (thrown) => thrown === error);
  const { body } = requests[0].body;
  assert.ok(body.includes(TREE_FINGERPRINT));
  assert.ok(body.includes('attempts must be an array'));
  assert.equal(putCalls(calls).length, 0);
});

test('a ledger the validator refuses is never written, and the hard stop gives the problem', async () => {
  const mergedLedger = ledgerRecord({ spend: { tokens: { input: 5, output: 0 }, costUsd: 0 } });
  const { run, calls, requests } = await harness({ bundle: green(), mergedLedger });

  await assert.rejects(run(), (thrown) => thrown instanceof LedgerError && /spend\.tokens\.input/.test(thrown.message));
  assert.equal(putCalls(calls).length, 0);
  assert.match(requests[0].body.body, /spend\.tokens\.input/);
  assert.ok(requests[0].body.body.includes(TREE_FINGERPRINT));
});

test('the run still fails with the error that stopped the debt, the summary says failed, and no repair is asked for', async () => {
  const error = refusal(500, 'boom');
  const { run, summary, outputs } = await stopsAt('putLedger', error);

  await assert.rejects(run(), (thrown) => thrown === error);
  assert.match(readFileSync(summary, 'utf8'), /\| Action \| `failed` \|/);
  assert.equal(readFileSync(outputs, 'utf8'), 'repair=false\n');
});

test('when the hard stop cannot be delivered either, the run fails with both, so the debt is still in the log', async () => {
  const error = refusal(409, 'main is protected');
  const { run } = await stopsAt('putLedger', error, { issueStatus: 500 });

  await assert.rejects(run(), (thrown) => {
    assert.notEqual(thrown, error);
    assert.match(thrown.message, /was not delivered/);
    for (const named of [MERGED_SHA, TREE_FINGERPRINT, CLEAR_COMMAND, error.message])
      assert.ok(thrown.message.includes(named), `the failure does not name ${named}`);
    assert.equal(thrown.cause, error);
    return true;
  });
});

test('a merge that never happened raises no debt hard stop, whatever fails in the reads', async () => {
  const merge = { merged: false, reason: 'head-moved', message: 'Head branch was modified' };
  const { run, requests } = await stopsAt('readTree', new Error('never called'), { merge });
  const { action } = await run();

  assert.equal(action, 'successor');
  assert.deepEqual(requests, []);
});
