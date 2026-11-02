import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SENDERS, variable } from './escalate-channels.mjs';

const escalation = { kind: 'credential', title: 'Token expired', detail: 'The token was refused.' };
const base = (env, issue = null) => ({
  env,
  escalation,
  ledger: { slug: 'post-one', pullRequest: null },
  ledgerPath: 'audits/autowriter/post-one.json',
  clean: (text) => String(text),
  issue,
  fetch: async () => assert.fail('no request expected'),
});

test('variable trims a set value and reads a missing or blank one as an empty string', () => {
  assert.equal(variable({ A: '  x\n' }, 'A'), 'x');
  assert.equal(variable({ A: '   ' }, 'A'), '');
  assert.equal(variable({}, 'A'), '');
  assert.equal(variable({ A: 5 }, 'A'), '');
});

test('a missing variable yields an error naming it and makes no request', async () => {
  const issue = await SENDERS.issue(base({ GITHUB_TOKEN: 'secret-token' }));
  assert.match(issue.error, /^GITHUB_REPOSITORY is not set; pass owner\/name/);
  const slack = await SENDERS.slack(base({ SLACK_WEBHOOK_URL: '  ' }));
  assert.match(slack.error, /^SLACK_WEBHOOK_URL is not set; create the repository secret/);
});

test('the Slack text falls back to the default server when the issue answer carried no URL', async () => {
  const sent = [];
  const fetch = async (url, init) => {
    sent.push(JSON.parse(init.body).text);
    return new Response('ok', { status: 200 });
  };
  const env = { SLACK_WEBHOOK_URL: 'https://hooks.example.test/x', GITHUB_REPOSITORY: 'meshin-co/website' };
  const outcome = await SENDERS.slack({ ...base(env, { number: 4, url: null }), fetch });
  assert.deepEqual(outcome, { status: 200 });
  assert.ok(sent[0].endsWith('\nIssue: https://github.com/meshin-co/website/issues/4'));
});

test('every request carries a live abort signal, so a hung endpoint cannot hold the workflow open', async () => {
  const signals = [];
  const fetch = async (url, init) => {
    signals.push(init.signal);
    return new Response(JSON.stringify({ number: 4, html_url: 'https://github.test/issues/4' }), { status: 201 });
  };
  const env = {
    GITHUB_TOKEN: 'token',
    GITHUB_REPOSITORY: 'meshin-co/website',
    SLACK_WEBHOOK_URL: 'https://hooks.test/x',
  };
  await SENDERS.issue({ ...base(env), fetch });
  await SENDERS.slack({ ...base(env), fetch });
  assert.equal(signals.length, 2);
  for (const signal of signals) {
    assert.ok(signal instanceof AbortSignal, 'a request was sent with no abort signal');
    assert.equal(signal.aborted, false);
  }
});

test('a request that times out is reported as a failed request naming the timeout, with no status', async () => {
  const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  const fetch = async () => {
    throw timeout;
  };
  const env = {
    GITHUB_TOKEN: 'token',
    GITHUB_REPOSITORY: 'meshin-co/website',
    SLACK_WEBHOOK_URL: 'https://hooks.test/x',
  };
  for (const sender of [SENDERS.issue, SENDERS.slack]) {
    const outcome = await sender({ ...base(env), fetch });
    assert.deepEqual(outcome, { error: 'request failed: The operation was aborted due to timeout' });
  }
});
