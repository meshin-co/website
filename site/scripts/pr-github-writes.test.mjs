import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dispatchSuccessor, mergePullRequest, putLedger, tickProblem } from './pr-github.mjs';
import { HEAD, json, apiAnswering, notFound } from './fixtures/github-fake.mjs';

test('a merge squashes onto the head and reports the merge commit', async () => {
  const { api, calls } = apiAnswering(() => json({ merged: true, sha: 'abc' }));

  const result = await mergePullRequest(api, { number: 5, head: HEAD });

  assert.deepEqual(result, { merged: true, sha: 'abc' });
  assert.equal(calls[0].method, 'PUT');
  assert.equal(calls[0].path, 'pulls/5/merge');
  assert.equal(calls[0].body, JSON.stringify({ merge_method: 'squash', sha: HEAD }));
});

test('a merge refused because the head moved is reported, not thrown', async () => {
  const { api } = apiAnswering(() => json({ message: 'Head branch was modified' }, 409));

  assert.deepEqual(await mergePullRequest(api, { number: 5, head: HEAD }), {
    merged: false,
    reason: 'head-moved',
    message: 'Head branch was modified',
  });
});

test('a merge the repository refuses is reported, not thrown', async () => {
  const { api } = apiAnswering(() => json({ message: 'Required status check is expected' }, 405));

  assert.deepEqual(await mergePullRequest(api, { number: 5, head: HEAD }), {
    merged: false,
    reason: 'refused',
    message: 'Required status check is expected',
  });
});

test('a merge that fails any other way throws', async () => {
  const { api } = apiAnswering(() => json({ message: 'boom' }, 500));

  await assert.rejects(mergePullRequest(api, { number: 5, head: HEAD }), (error) => error.status === 500);
});

test('a dispatch posts the ref and inputs and resolves undefined', async () => {
  const { api, calls } = apiAnswering(() => new Response(null, { status: 204 }));

  const result = await dispatchSuccessor(api, { workflow: 'pr-watch.yml', ref: 'main', inputs: { pull: '5' } });

  assert.equal(result, undefined);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].path, 'actions/workflows/pr-watch.yml/dispatches');
  assert.equal(calls[0].body, JSON.stringify({ ref: 'main', inputs: { pull: '5' } }));
});

test('a dispatch the api refuses throws', async () => {
  const { api } = apiAnswering(() => json({ message: 'Workflow does not have workflow_dispatch' }, 422));

  await assert.rejects(
    dispatchSuccessor(api, { workflow: 'w', ref: 'main', inputs: {} }),
    (error) => error.status === 422
  );
});

const identity = { name: 'autowriter-bot', email: 'autowriter-bot@meshin.co' };
const ledgerWrite = {
  path: 'audits/autowriter/a-slug.json',
  text: '{"a":1}\n',
  branch: 'autowriter/a-slug',
  message: 'ledger',
  identity,
};

test('a ledger update sends the blob sha, base64 content and the identity as author and committer', async () => {
  const { api, calls } = apiAnswering(() => json({ commit: { sha: 'c0ffee' } }));

  const result = await putLedger(api, { ...ledgerWrite, blobSha: 'blob-1' });

  assert.deepEqual(result, { commit: 'c0ffee' });
  assert.equal(calls[0].method, 'PUT');
  assert.equal(calls[0].path, 'contents/audits/autowriter/a-slug.json');
  assert.deepEqual(JSON.parse(calls[0].body), {
    message: 'ledger',
    content: Buffer.from('{"a":1}\n').toString('base64'),
    branch: 'autowriter/a-slug',
    author: identity,
    committer: identity,
    sha: 'blob-1',
  });
});

test('a new ledger file sends no blob sha', async () => {
  const { api, calls } = apiAnswering(() => json({ commit: { sha: 'c0ffee' } }));

  await putLedger(api, { ...ledgerWrite, blobSha: null });

  assert.equal('sha' in JSON.parse(calls[0].body), false);
});

const waitTimer = (minutes) => ({
  protection_rules: [{ type: 'required_reviewers' }, { type: 'wait_timer', wait_timer: minutes }],
});
const environmentFix = 'gh api -X PUT repos/meshin-co/website/environments/autowriter-tick -F wait_timer=5';
const tickOf = (respond) => tickProblem(apiAnswering(respond).api, { environment: 'autowriter-tick', minutes: 5 });

test('an environment that does not exist yet is a problem with the fixing command', async () => {
  const problem = await tickOf(notFound);

  assert.match(problem, /autowriter-tick/);
  assert.ok(problem.endsWith(environmentFix));
});

test('an environment without a wait timer rule is a problem with the fixing command', async () => {
  const problem = await tickOf(() => json({ protection_rules: [{ type: 'required_reviewers' }] }));

  assert.ok(problem.endsWith(environmentFix));
});

test('a wait timer shorter than the tick is a problem with the fixing command', async () => {
  const problem = await tickOf(() => json(waitTimer(4)));

  assert.ok(problem.endsWith(environmentFix));
});

test('a wait timer exactly as long as the tick is no problem', async () => {
  assert.equal(await tickOf(() => json(waitTimer(5))), null);
});

test('a wait timer longer than the tick is no problem', async () => {
  assert.equal(await tickOf(() => json(waitTimer(30))), null);
});

test('the environment name is encoded in the request path', async () => {
  const { api, calls } = apiAnswering(() => json(waitTimer(5)));

  await tickProblem(api, { environment: 'tick env', minutes: 5 });

  assert.equal(calls[0].path, 'environments/tick%20env');
});

test('an environment lookup that fails for another reason throws', async () => {
  await assert.rejects(
    tickOf(() => json({ message: 'Forbidden' }, 403)),
    (error) => error.status === 403
  );
});
