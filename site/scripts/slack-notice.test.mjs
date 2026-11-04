import assert from 'node:assert/strict';
import { test } from 'node:test';

import { deliverNotice } from './slack-notice.mjs';

const WEBHOOK = 'https://hooks.slack.test/services/T0SECRET/B0SECRET/xoxSECRETpath';
const ENV = { SLACK_WEBHOOK_URL: WEBHOOK, GITHUB_TOKEN: 'ghs_secrettoken' };
const MESSAGE = { text: 'fallback', blocks: [{ type: 'divider' }] };
const INSTANT = new Date('2026-11-03T08:00:00.000Z');

const run = async ({ env = ENV, fetch }) => {
  const out = [];
  const err = [];
  const delivered = await deliverNotice({
    label: 'spend report',
    message: MESSAGE,
    env,
    fetch,
    instant: INSTANT,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  });
  return { out, err, delivered };
};

const answering = (status, text = '') => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    return { status, text: async () => text };
  };
  return { fetch, calls };
};

test('a delivered notice posts the whole message once and says so on stdout alone', async () => {
  const { fetch, calls } = answering(200, 'ok');
  const { out, err } = await run({ fetch });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, WEBHOOK);
  assert.deepEqual(JSON.parse(calls[0].init.body), MESSAGE);
  assert.deepEqual(out, ['spend report: slack delivered (HTTP 200)']);
  assert.deepEqual(err, []);
});

test('a notice Slack refuses is a warning annotation on stderr and never an error', async () => {
  const { fetch } = answering(500, 'no_service');
  const { out, err } = await run({ fetch });
  assert.deepEqual(out, []);
  assert.deepEqual(err, ['::warning::spend report: slack NOT delivered: Slack answered HTTP 500: no_service']);
});

test('a notice that Slack never receives is a warning annotation, and the reason is the network error', async () => {
  const { out, err } = await run({
    fetch: async () => {
      throw new Error('connect ECONNREFUSED');
    },
  });
  assert.deepEqual(out, []);
  assert.deepEqual(err, ['::warning::spend report: slack NOT delivered: request failed: connect ECONNREFUSED']);
});

test('a webhook that is not set is a warning that names the secret to create', async () => {
  const { fetch, calls } = answering(200);
  const { out, err } = await run({ env: {}, fetch });
  assert.equal(calls.length, 0);
  assert.deepEqual(out, []);
  assert.deepEqual(err, [
    '::warning::spend report: slack NOT delivered: SLACK_WEBHOOK_URL is not set; create the repository secret of that name',
  ]);
});

test('whatever Slack or the network echoes back, the webhook and its path appear in no line', async () => {
  const echoed = answering(404, `no such hook ${WEBHOOK} and ${new URL(WEBHOOK).pathname}`);
  const refused = {
    fetch: async () => {
      throw new Error(`getaddrinfo ENOTFOUND ${WEBHOOK}`);
    },
  };
  for (const { fetch } of [echoed, refused]) {
    const { out, err } = await run({ fetch });
    const shown = [...out, ...err].join('\n');
    assert.equal(shown.includes(WEBHOOK), false);
    assert.equal(shown.includes('xoxSECRETpath'), false);
    assert.match(shown, /\[SLACK_WEBHOOK_URL\]/);
  }
});

test('a delivered notice never prints the webhook either', async () => {
  const { fetch } = answering(200, WEBHOOK);
  const { out, err } = await run({ fetch });
  assert.equal([...out, ...err].join('\n').includes('xoxSECRETpath'), false);
});

test('a delivered notice returns true, so a caller may record the message as sent', async () => {
  const { delivered } = await run({ fetch: answering(200, 'ok').fetch });
  assert.equal(delivered, true);
});

test('a notice Slack refuses, one it never receives and one with no webhook all return false', async () => {
  const refused = await run({ fetch: answering(500, 'no_service').fetch });
  const unreachable = await run({
    fetch: async () => {
      throw new Error('connect ECONNREFUSED');
    },
  });
  const unset = await run({ env: {}, fetch: answering(200).fetch });
  assert.deepEqual([refused.delivered, unreachable.delivered, unset.delivered], [false, false, false]);
});

const sequence = (...answers) => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push(JSON.parse(init.body));
    return answers.shift();
  };
  return { fetch, calls };
};
const reply = (status, text) => new Response(text, { status });
const FALLBACK_LINE =
  '::warning::spend report: slack delivered as plain text (HTTP 200): the formatted message was refused: Slack answered HTTP 400: invalid_blocks';

test('a notice whose blocks Slack refuses is delivered as plain text, and the refusal is a warning annotation, not stdout', async () => {
  const { fetch, calls } = sequence(reply(400, 'invalid_blocks'), reply(200, 'ok'));
  const { out, err, delivered } = await run({ fetch });
  assert.equal(delivered, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(Object.keys(calls[1]), ['text']);
  assert.deepEqual(out, []);
  assert.deepEqual(err, [FALLBACK_LINE]);
});

test('a notice whose blocks and plain text Slack both refuse is a warning and returns false, never a throw', async () => {
  const { fetch } = sequence(reply(400, 'invalid_blocks'), reply(400, 'no_text'));
  const { out, err, delivered } = await run({ fetch });
  assert.equal(delivered, false);
  assert.deepEqual(out, []);
  assert.deepEqual(err, [
    '::warning::spend report: slack NOT delivered: Slack answered HTTP 400: invalid_blocks, then HTTP 400: no_text to the plain text sent after it',
  ]);
});

test('a refusal that echoes the webhook never puts it in the warning of a notice that was then delivered as plain text', async () => {
  const { fetch } = sequence(reply(400, `bad ${WEBHOOK}`), reply(200, 'ok'));
  const { out, err } = await run({ fetch });
  const shown = [...out, ...err].join('\n');
  assert.equal(shown.includes('xoxSECRETpath'), false);
  assert.match(shown, /\[SLACK_WEBHOOK_URL\]/);
});
