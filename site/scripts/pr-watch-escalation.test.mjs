import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GitHubError } from './pr-github.mjs';
import { recordPath } from './record-layout.mjs';
import { LEDGER_FILINGS } from './fixtures/github-fake.mjs';
import { siteBrand } from './site-brand.mjs';
import { scenario } from './fixtures/pr-watch.mjs';
import { blockKitProblems } from './fixtures/block-kit.mjs';
import {
  DEFAULT_TOKEN,
  PAT,
  WEBHOOK,
  green,
  harness,
  callOf,
  ledgerRecord,
  readJson,
  slackMessageOf,
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
  assert.match(body, /https:\/\/github\.test\/meshin-co\/website\/pull\/72/);
});

test('with no server named the finding names the pull request by its number and makes up no address', async () => {
  const { run, env, requests, ledgerPath } = await harness({ bundle: scenario('cancel-storm') });
  delete env.GITHUB_SERVER_URL;
  await run();
  const { detail } = readJson(ledgerPath).escalations[0];

  assert.ok(detail.endsWith('\nPull request: #72'), detail);
  assert.doesNotMatch(requests[0].body.body, /https?:\/\//);
});

test('the Slack message of an escalation shows the pull request the finding names as a link', async () => {
  const ledger = ledgerRecord({ attempts: spentAttempts });
  const { run, requests } = await harness({ bundle: scenario('content-gate-failure'), ledger });
  await run();
  const { text, blocks } = slackMessageOf(requests);
  const line = 'Pull request: <https://github.test/meshin-co/website/pull/72|#72>';

  assert.ok(blocks[2].text.text.endsWith(`\n${line}`), blocks[2].text.text);
  assert.ok(text.includes(`\n${line}\n`), text);
});

test('the Slack message of a watcher escalation is a payload Slack accepts', async () => {
  const ledger = ledgerRecord({ attempts: spentAttempts });
  const { run, requests } = await harness({ bundle: scenario('content-gate-failure'), ledger });
  await run();

  assert.deepEqual(blockKitProblems(slackMessageOf(requests)), []);
});

test('a watcher escalation whose blocks Slack refuses is delivered as plain text, passes the job, and the ledger on the branch says so', async () => {
  const ledger = ledgerRecord({ attempts: spentAttempts });
  const { run, calls, requests, ledgerPath } = await harness({
    bundle: scenario('content-gate-failure'),
    ledger,
    slackStatuses: [400, 200],
  });
  const { action } = await run();

  const posted = requests.filter(({ url }) => url === WEBHOOK);
  assert.equal(action, 'escalated');
  assert.equal(posted.length, 2);
  assert.deepEqual(Object.keys(posted[1].body), ['text']);
  const [, slack] = readJson(ledgerPath).escalations[0].receipts;
  assert.equal(slack.delivered, true);
  assert.equal(slack.error, 'the formatted message was refused: Slack answered HTTP 400: invalid_blocks');
  assert.deepEqual(writtenNames(calls), ['putLedger']);
});

test('a pull request the ledger on the branch does not name is a link in the Slack message all the same', async () => {
  const error = refusal(401, 'Bad credentials');
  const ledger = ledgerRecord({ pullRequest: null });
  const { run, requests } = await harness({ bundle: green(), ledger, failWith: { during: 'merge', error } });
  await assert.rejects(run(), (thrown) => thrown === error);
  const { blocks } = slackMessageOf(requests);
  const columns = blocks.flatMap((block) => block.fields ?? []).map(({ text }) => text);

  assert.ok(columns.includes('*Pull request*\n<https://github.test/meshin-co/website/pull/72|#72>'), columns.join('|'));
});

test('no Slack message the watcher posts holds the webhook URL, its path or a token, in any kind of escalation', async () => {
  const error = refusal(401, 'Bad credentials');
  const ledger = ledgerRecord({ attempts: spentAttempts });
  const stalled = await harness({ bundle: scenario('content-gate-failure'), ledger });
  const refused = await harness({ bundle: green(), failWith: { during: 'merge', error } });
  await stalled.run();
  await assert.rejects(refused.run(), (thrown) => thrown === error);
  const messages = JSON.stringify([slackMessageOf(stalled.requests), slackMessageOf(refused.requests)]);

  for (const secret of [WEBHOOK, new URL(WEBHOOK).pathname, PAT, DEFAULT_TOKEN])
    assert.equal(messages.includes(secret), false, secret);
});

test('an escalation with no ledger on the branch creates one for the pull request and pushes it as the bot', async () => {
  const { run, calls, ledgerPath, now } = await harness({ bundle: scenario('cancel-storm') });
  await run();
  const ledger = readJson(ledgerPath);
  const [, token, push] = callOf(calls, 'putLedger');

  assert.equal(ledger.slug, 'a-slug');
  assert.equal(ledger.pullRequest, 72);
  assert.equal(ledger.runId, '555');
  assert.equal(token, 'pat-secret-value');
  assert.equal(push.path, recordPath('ledger', 'a-slug', now()));
  assert.equal(push.branch, 'autowriter/a-slug');
  assert.equal(push.blobSha, null);
  assert.deepEqual(push.identity, { name: 'autowriter-bot', email: `autowriter-bot@${siteBrand().name}` });
  assert.deepEqual(JSON.parse(push.text), ledger);
});

test('a ledger the escalation starts is filed under the month of the instant it is started', async () => {
  const before = await harness({ bundle: scenario('cancel-storm'), hours: 13 });
  const after = await harness({ bundle: scenario('cancel-storm'), hours: 14 });
  await before.run();
  await after.run();

  assert.equal(callOf(before.calls, 'putLedger')[2].path, 'audits/autowriter/2026/10/a-slug.json');
  assert.equal(callOf(after.calls, 'putLedger')[2].path, 'audits/autowriter/2026/11/a-slug.json');
});

test('an escalation with a ledger on the branch keeps what it recorded and updates the file in place', async () => {
  const stored = ledgerRecord();
  const { run, calls, ledgerPath } = await harness({ bundle: scenario('dependency-failure'), ledger: stored });
  await run();
  const [, , push] = callOf(calls, 'putLedger');

  assert.equal(push.path, stored.path);
  assert.equal(push.blobSha, stored.blobSha);
  assert.equal(readJson(ledgerPath).runId, '41');
  assert.equal(readJson(ledgerPath).verdict.state, 'escalated');
});

for (const [place, path] of Object.entries(LEDGER_FILINGS)) {
  test(`an escalation pushes a ledger filed ${place} back to the path it was found at`, async () => {
    const stored = { ...ledgerRecord(), path };
    const { run, calls, ledgerPath } = await harness({ bundle: scenario('dependency-failure'), ledger: stored });
    await run();

    assert.equal(callOf(calls, 'putLedger')[2].path, path);
    assert.equal(readJson(ledgerPath).verdict.state, 'escalated');
  });
}

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
