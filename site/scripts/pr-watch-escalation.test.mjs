import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GitHubError } from './pr-github.mjs';
import { siteBrand } from './site-brand.mjs';
import { scenario } from './fixtures/pr-watch.mjs';
import {
  green,
  harness,
  callOf,
  ledgerRecord,
  readJson,
  spentAttempts,
  writtenNames,
} from './fixtures/pr-watch-harness.mjs';

const refusal = (status, message, method = 'PUT', path = 'pulls/72/merge') =>
  new GitHubError({ method, path, status, body: { message } });

test('a failure no rewrite can repair is escalated as unrepairable and recorded on the branch', async () => {
  const { run, calls, ledgerPath, requests } = await harness({ bundle: scenario('dependency-failure') });
  const { action, result } = await run();
  const ledger = readJson(ledgerPath);

  assert.equal(result.verdict, 'escalate');
  assert.equal(result.reason, 'not-a-content-gate');
  assert.equal(action, 'escalated');
  assert.equal(ledger.escalations[0].kind, 'unrepairable');
  assert.equal(ledger.verdict.state, 'escalated');
  assert.equal(requests.length, 1);
  assert.deepEqual(writtenNames(calls), ['putLedger']);
});

test('the escalation names the failing job and gate and links the pull request', async () => {
  const { run, requests } = await harness({ bundle: scenario('cancel-storm') });
  await run();
  const { title, body } = requests[0].body;

  assert.match(title, /#72/);
  assert.match(body, /visual-and-axe \(1\) \(gate:visual\)/);
  assert.match(body, /https:\/\/github\.com\/meshin-co\/website\/pull\/72/);
});

test('an escalation with no ledger on the branch creates one for the pull request and pushes it as the bot', async () => {
  const { run, calls, ledgerPath } = await harness({ bundle: scenario('cancel-storm') });
  await run();
  const ledger = readJson(ledgerPath);
  const [, token, push] = callOf(calls, 'putLedger');

  assert.equal(ledger.slug, 'a-slug');
  assert.equal(ledger.pullRequest, 72);
  assert.equal(ledger.runId, '555');
  assert.equal(token, 'pat-secret-value');
  assert.equal(push.path, 'audits/autowriter/a-slug.json');
  assert.equal(push.branch, 'autowriter/a-slug');
  assert.equal(push.blobSha, null);
  assert.deepEqual(push.identity, { name: 'autowriter-bot', email: `autowriter-bot@${siteBrand().name}` });
  assert.deepEqual(JSON.parse(push.text), ledger);
});

test('an escalation with a ledger on the branch keeps what it recorded and updates the file in place', async () => {
  const stored = ledgerRecord();
  const { run, calls, ledgerPath } = await harness({ bundle: scenario('dependency-failure'), ledger: stored });
  await run();
  const [, , push] = callOf(calls, 'putLedger');

  assert.equal(push.blobSha, stored.blobSha);
  assert.equal(readJson(ledgerPath).runId, '41');
  assert.equal(readJson(ledgerPath).verdict.state, 'escalated');
});

test('an escalation that needs Slack without a webhook still records and pushes the ledger, then fails the job', async () => {
  const ledger = ledgerRecord({ attempts: spentAttempts });
  const { run, calls, ledgerPath } = await harness({ bundle: scenario('content-gate-failure'), ledger, slack: false });

  await assert.rejects(run(), /was not delivered/);
  assert.equal(readJson(ledgerPath).escalations[0].kind, 'no-convergence');
  assert.deepEqual(writtenNames(calls), ['putLedger']);
});

test('a pull request whose ledger already records a decision is not escalated twice', async () => {
  const decided = ledgerRecord({
    escalations: [],
    verdict: { state: 'stopped', reason: 'a person stopped it', decidedAt: '2026-11-02T00:00:00.000Z' },
  });
  const { run, calls, requests } = await harness({ bundle: scenario('cancel-storm'), ledger: decided });
  const { action, result } = await run();

  assert.equal(result.reason, 'ledger-decided');
  assert.equal(action, 'stopped');
  assert.deepEqual(writtenNames(calls), []);
  assert.deepEqual(requests, []);
});

test('a token GitHub rejects is a credential escalation naming the secret, never pushed, and fails the job', async () => {
  const error = refusal(401, 'Bad credentials');
  const { run, calls, requests, ledgerPath } = await harness({ bundle: green(), failWith: { during: 'merge', error } });

  await assert.rejects(run(), (thrown) => thrown === error);
  assert.equal(readJson(ledgerPath).escalations[0].kind, 'credential');
  assert.match(requests[0].body.title, /AUTOWRITER_PAT/);
  assert.equal(requests.length, 2);
  assert.equal(
    calls.some(([name]) => name === 'putLedger'),
    false
  );
});

test('a token that may not do what the watcher asks is a credential problem too', async () => {
  const error = refusal(403, 'Resource not accessible by personal access token', 'POST');
  const { run, requests } = await harness({ bundle: green(), hours: 1, failWith: { during: 'dispatch', error } });

  await assert.rejects(run(), (thrown) => thrown === error);
  assert.equal(requests.length, 2);
  assert.match(requests[0].body.body, /Resource not accessible by personal access token/);
});

test('a rate limit is not a credential problem and raises nothing', async () => {
  const error = refusal(403, 'API rate limit exceeded for user ID 1');
  const { run, requests, ledgerPath } = await harness({ bundle: green(), failWith: { during: 'merge', error } });

  await assert.rejects(run(), (thrown) => thrown === error);
  assert.deepEqual(requests, []);
  assert.throws(() => readJson(ledgerPath), /was not written/);
});

test('a failure that is not about the credential propagates without an escalation', async () => {
  const error = refusal(500, 'boom');
  const { run, requests, ledgerPath } = await harness({ bundle: green(), failWith: { during: 'merge', error } });

  await assert.rejects(run(), (thrown) => thrown === error);
  assert.deepEqual(requests, []);
  assert.throws(() => readJson(ledgerPath), /was not written/);
});
