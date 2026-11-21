import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { newLedger, readLedger, writeLedger } from './autowriter-ledger.mjs';
import { SENDERS } from './escalate-channels.mjs';
import { escalate } from './escalate.mjs';

const ENV = { GITHUB_TOKEN: 'token', GITHUB_REPOSITORY: 'meshin-co/website' };
const API = 'https://api.github.com/repos/meshin-co/website/issues';
const TITLE = 'Autowriter pull request #196: the repair job failed before it could finish';
const SLUG = 'link-rot-2026-11-20';

const raised = (id, issue, title = TITLE) => ({
  id,
  kind: 'hard-stop',
  title,
  detail: 'The repair job failed.',
  raisedAt: '2026-11-21T01:44:00.000Z',
  receipts:
    issue === null
      ? []
      : [
          {
            channel: 'issue',
            attemptedAt: '2026-11-21T01:44:01.000Z',
            delivered: true,
            status: 201,
            issue,
            error: null,
          },
        ],
});

const reply = (status, body) => new Response(JSON.stringify(body), { status });
const pageOf = (number) => `https://github.test/issues/${number}`;

function githubWith(states, { lookup } = {}) {
  const requests = [];
  const fetch = async (url, init) => {
    requests.push({ url, method: init.method });
    if (init.method === 'POST')
      return reply(201, { number: 300 + requests.length, html_url: pageOf(300 + requests.length) });
    if (lookup !== undefined) return lookup();
    const number = Number(url.split('/').at(-1));
    return states[number] === undefined
      ? reply(404, { message: 'Not Found' })
      : reply(200, { number, state: states[number], html_url: pageOf(number) });
  };
  return { fetch, requests };
}

const contextOf = (fetch, earlier) => ({
  env: ENV,
  fetch,
  escalation: raised('esc-2', null),
  ledger: { slug: SLUG, pullRequest: 196, escalations: earlier },
  ledgerPath: `audits/autowriter/2026/11/${SLUG}.json`,
  clean: (text) => String(text),
  issue: null,
  pullRequest: 196,
});

const methodsOf = ({ requests }) => requests.map(({ method }) => method);

test('an open issue of an earlier escalation with the same title is reused: one lookup and no new issue', async () => {
  const github = githubWith({ 200: 'open' });
  const outcome = await SENDERS.issue(contextOf(github.fetch, [raised('esc-1', 200)]));
  assert.deepEqual(outcome, { status: 200, issue: { number: 200, url: pageOf(200) } });
  assert.deepEqual(github.requests, [{ url: `${API}/200`, method: 'GET' }]);
});

test('a closed issue is not reused, so the problem that came back is raised again', async () => {
  const github = githubWith({ 200: 'closed' });
  const outcome = await SENDERS.issue(contextOf(github.fetch, [raised('esc-1', 200)]));
  assert.equal(outcome.status, 201);
  assert.deepEqual(methodsOf(github), ['GET', 'POST']);
});

test('an open issue under another title is not reused and costs no lookup', async () => {
  const github = githubWith({ 200: 'open' });
  const outcome = await SENDERS.issue(contextOf(github.fetch, [raised('esc-1', 200, 'Another problem')]));
  assert.equal(outcome.status, 201);
  assert.deepEqual(methodsOf(github), ['POST']);
});

test('a first raise makes one request, as it always did', async () => {
  const github = githubWith({});
  const outcome = await SENDERS.issue(contextOf(github.fetch, []));
  assert.equal(outcome.status, 201);
  assert.deepEqual(methodsOf(github), ['POST']);
});

test('a lookup that GitHub refuses never swallows the problem: the issue is opened', async () => {
  const github = githubWith({});
  const outcome = await SENDERS.issue(contextOf(github.fetch, [raised('esc-1', 200)]));
  assert.equal(outcome.status, 201);
  assert.deepEqual(methodsOf(github), ['GET', 'POST']);
});

test('a lookup that fails on the network never swallows the problem either', async () => {
  const github = githubWith({}, { lookup: () => Promise.reject(new TypeError('fetch failed')) });
  const outcome = await SENDERS.issue(contextOf(github.fetch, [raised('esc-1', 200)]));
  assert.equal(outcome.status, 201);
  assert.deepEqual(methodsOf(github), ['GET', 'POST']);
});

test('raising the same escalation twice leaves one open issue, and the ledger records both raises', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'escalate-open-'));
  try {
    const ledgerPath = join(dir, `${SLUG}.json`);
    writeLedger(ledgerPath, newLedger({ slug: SLUG, runId: '1', pullRequest: 196 }));
    const github = githubWith({ 301: 'open' });
    const raise = () =>
      escalate({
        ledgerPath,
        kind: 'hard-stop',
        title: TITLE,
        detail: 'The repair job failed.',
        env: ENV,
        fetch: github.fetch,
        pullRequest: 196,
      });
    await raise();
    await raise();
    const receipts = readLedger(ledgerPath).escalations.map((entry) =>
      entry.receipts.map(({ channel, status, issue }) => [channel, status, issue])
    );
    assert.deepEqual(receipts, [[['issue', 201, 301]], [['issue', 200, 301]]]);
    assert.deepEqual(methodsOf(github), ['POST', 'GET']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
