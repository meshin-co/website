import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SENDERS, postSlackMessage, variable } from './escalate-channels.mjs';

const escalation = {
  id: 'esc-1',
  kind: 'credential',
  title: 'Token expired',
  detail: 'The token was refused.',
  raisedAt: '2026-11-03T08:00:00.000Z',
};
const LEDGER_PATH = 'audits/autowriter/post-one.json';
const WEBHOOK = 'https://hooks.example.test/x';
const NO_SERVER = { SLACK_WEBHOOK_URL: WEBHOOK, GITHUB_REPOSITORY: 'meshin-co/website' };
const WITH_SERVER = { ...NO_SERVER, GITHUB_SERVER_URL: 'https://git.example.org' };
const MESSAGE = { text: 'one\ntwo', blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'one\ntwo' } }] };
const header = (text) => ({ type: 'header', text: { type: 'plain_text', text } });
const prose = (text) => ({ type: 'section', text: { type: 'mrkdwn', text } });
const small = (...texts) => ({ type: 'context', elements: texts.map((text) => ({ type: 'mrkdwn', text })) });
const base = (env, issue = null) => ({
  env,
  escalation,
  ledger: { slug: 'post-one', pullRequest: null },
  ledgerPath: LEDGER_PATH,
  clean: (text) => String(text),
  issue,
  pullRequest: null,
  fetch: async () => assert.fail('no request expected'),
});

async function postedBy(context) {
  const posted = [];
  const fetch = async (url, init) => {
    posted.push(JSON.parse(init.body));
    return new Response('ok', { status: 200 });
  };
  const outcome = await SENDERS.slack({ ...context, fetch });
  assert.deepEqual(outcome, { status: 200 });
  assert.equal(posted.length, 1);
  assert.ok(Array.isArray(posted[0].blocks), 'the Slack body carries no blocks');
  return posted[0];
}

const columnsOf = ({ blocks }) => blocks.flatMap((block) => block.fields ?? []).map(({ text }) => text);

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

test('the Slack sender posts one JSON body of fallback text and blocks to the webhook', async () => {
  const requests = [];
  const fetch = async (url, init) => {
    requests.push({ url, method: init.method, body: JSON.parse(init.body) });
    return new Response('ok', { status: 200 });
  };
  const outcome = await SENDERS.slack({ ...base(NO_SERVER), fetch });
  assert.deepEqual(outcome, { status: 200 });
  const [{ url, method, body }] = requests;
  assert.deepEqual([url, method, Object.keys(body).toSorted()], [WEBHOOK, 'POST', ['blocks', 'text']]);
});

test('the Slack message is built from the escalation and the ledger path of the context', async () => {
  const { text, blocks } = await postedBy(base(NO_SERVER));
  const footer = small('Escalation esc-1 (credential), raised 2026-11-03T08:00:00.000Z', `Ledger \`${LEDGER_PATH}\``);
  assert.equal(text.split('\n')[0], 'Autowriter escalation (credential): Token expired');
  assert.equal(text.split('\n').at(-1), `Ledger: ${LEDGER_PATH}`);
  assert.deepEqual(blocks[0], header('Autowriter escalation: credential'));
  assert.deepEqual(blocks[1], prose('*Token expired*'));
  assert.deepEqual(blocks.at(-1), footer);
});

test('an issue the API answered with an address is linked at that address, whatever server the environment names', async () => {
  const issue = { number: 4, url: 'https://issues.example.org/meshin-co/website/4' };
  const body = await postedBy(base(WITH_SERVER, issue));
  assert.deepEqual(columnsOf(body), ['*Issue*\n<https://issues.example.org/meshin-co/website/4|#4>']);
});

test('an issue the API answered without an address is linked on the server and repository the environment names', async () => {
  const body = await postedBy(base(WITH_SERVER, { number: 4, url: null }));
  assert.deepEqual(columnsOf(body), ['*Issue*\n<https://git.example.org/meshin-co/website/issues/4|#4>']);
});

test('with no server named, an issue the API answered without an address is its number alone and no host is guessed', async () => {
  const body = await postedBy(base(NO_SERVER, { number: 4, url: null }));
  assert.deepEqual(columnsOf(body), ['*Issue*\n#4']);
  assert.equal(/https?:/.test(JSON.stringify(body)), false);
});

test('a pull request the caller names is linked ahead of the one the ledger holds', async () => {
  const context = { ...base(WITH_SERVER), pullRequest: 84, ledger: { slug: 'post-one', pullRequest: 12 } };
  const body = await postedBy(context);
  assert.deepEqual(columnsOf(body), ['*Pull request*\n<https://git.example.org/meshin-co/website/pull/84|#84>']);
});

test('with no pull request named by the caller, the one the ledger holds is linked', async () => {
  const body = await postedBy({ ...base(WITH_SERVER), ledger: { slug: 'post-one', pullRequest: 12 } });
  assert.deepEqual(columnsOf(body), ['*Pull request*\n<https://git.example.org/meshin-co/website/pull/12|#12>']);
});

test('a pull request that neither the caller nor the ledger names is not mentioned', async () => {
  const body = await postedBy(base(WITH_SERVER));
  assert.deepEqual(columnsOf(body), []);
  assert.equal(body.text.includes('Pull request'), false);
});

test('a run the environment names is a link in the message', async () => {
  const body = await postedBy(base({ ...WITH_SERVER, GITHUB_RUN_ID: '777' }));
  const field = '*Workflow run*\n<https://git.example.org/meshin-co/website/actions/runs/777|run 777>';
  assert.deepEqual(columnsOf(body), [field]);
});

test('with no run named no run is linked, and no run id is made up', async () => {
  const body = await postedBy(base({ ...WITH_SERVER, GITHUB_RUN_ID: '  ' }, { number: 4, url: null }));
  assert.deepEqual(columnsOf(body), ['*Issue*\n<https://git.example.org/meshin-co/website/issues/4|#4>']);
  assert.equal(body.text.includes('actions/runs'), false);
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

test('a Slack message is posted as given to the webhook, with no escalation around it', async () => {
  const requests = [];
  const fetch = async (url, init) => {
    requests.push({ url, method: init.method, body: JSON.parse(init.body) });
    return new Response('ok', { status: 200 });
  };
  const env = { SLACK_WEBHOOK_URL: ' https://hooks.test/x\n' };
  const outcome = await postSlackMessage({ env, fetch, clean: String, message: MESSAGE });
  assert.deepEqual(outcome, { status: 200 });
  assert.deepEqual(requests, [{ url: 'https://hooks.test/x', method: 'POST', body: MESSAGE }]);
});

test('a Slack message with no webhook set makes no request and names the missing variable', async () => {
  const fetch = async () => assert.fail('no request expected');
  const outcome = await postSlackMessage({ env: {}, fetch, clean: String, message: MESSAGE });
  assert.match(outcome.error, /^SLACK_WEBHOOK_URL is not set; create the repository secret/);
});

test('a refused Slack message reports the status and a cleaned excerpt, and a failed request reports its message', async () => {
  const env = { SLACK_WEBHOOK_URL: 'https://hooks.test/x' };
  const refusing = async () => new Response('no_service', { status: 404 });
  const refused = await postSlackMessage({ env, fetch: refusing, clean: (text) => `[${text}]`, message: MESSAGE });
  assert.deepEqual(refused, { status: 404, error: 'Slack answered HTTP 404: [no_service]' });
  const closing = async () => {
    throw new Error('socket closed');
  };
  const failed = await postSlackMessage({ env, fetch: closing, clean: String, message: MESSAGE });
  assert.deepEqual(failed, { error: 'request failed: socket closed' });
});
