import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { QUARANTINE_HOURS, validateLedger } from './autowriter-ledger.mjs';
import { CLEAR_COMMAND } from './measurement-debt.mjs';
import { watch } from './pr-watch.mjs';
import { recordPath } from './record-layout.mjs';
import {
  LEDGER_FILINGS,
  LEDGER_PATH,
  REPO,
  ROOT,
  json,
  ledgerBody,
  notFound,
  own,
  serving,
} from './fixtures/github-fake.mjs';
import { siteBrand } from './site-brand.mjs';
import { byBot, hoursAfterOpening } from './fixtures/pr-watch.mjs';
import {
  DEFAULT_TOKEN,
  MERGED_SHA,
  PAT,
  TREE,
  TREE_FINGERPRINT,
  green,
  ledgerRecord,
  treeFilingLedgerAt,
} from './fixtures/pr-watch-harness.mjs';

const STORED_BLOB = 'b'.repeat(40);

function github(bundle, options = {}) {
  const { writeStatus = 201, writeBody = { commit: { sha: 'e'.repeat(40) } } } = options;
  const { ledgerPath = LEDGER_PATH, tree = TREE } = options;
  const requests = [];
  const read = serving(bundle, {
    ledger: (path) =>
      path === `contents/${ledgerPath}?ref=${MERGED_SHA}` ? ledgerBody(ledgerRecord().value, STORED_BLOB) : notFound(),
  });
  const fetch = async (url, init = {}) => {
    const path = url.slice(ROOT.length);
    const method = init.method ?? 'GET';
    const token = init.headers?.Authorization?.replace('Bearer ', '');
    requests.push({ method, path, token, body: init.body === undefined ? undefined : JSON.parse(init.body) });
    if (method === 'PUT' && path === `pulls/${bundle.pullRequest.number}/merge`)
      return json({ sha: MERGED_SHA, merged: true });
    if (method === 'PUT' && path.startsWith('contents/')) return json(writeBody, writeStatus);
    if (method === 'POST' && path === 'issues')
      return json({ number: 9, html_url: 'https://github.test/issues/9' }, 201);
    if (path.startsWith('git/trees/')) return json({ sha: 'c'.repeat(40), tree, truncated: false });
    return read({ path });
  };
  return { fetch, requests };
}

async function mergeWith(options) {
  const bundle = byBot(own(green()));
  const scene = github(bundle, options);
  const env = { GITHUB_REPOSITORY: REPO, GITHUB_TOKEN: DEFAULT_TOKEN, AUTOWRITER_PAT: PAT, GITHUB_RUN_ID: '555' };
  const workdir = await mkdtemp(join(tmpdir(), 'merge-integration-'));
  const now = () => hoursAfterOpening(bundle, QUARANTINE_HOURS + 1);
  return { ...scene, bundle, run: () => watch({ number: 72, env, fetch: scene.fetch, workdir, now }), now };
}

const writes = (requests) => requests.filter(({ method }) => method !== 'GET');

test('over the real adapters a merge reads the merged tree and ledger with the read token, then commits the debt to main with the bot token', async () => {
  const { run, requests, bundle, now } = await mergeWith();
  const { action } = await run();
  const [merge, commit] = writes(requests);
  const reads = requests.filter(({ method }) => method === 'GET').map(({ path }) => path);

  assert.equal(action, 'merged');
  assert.equal(writes(requests).length, 2);
  assert.deepEqual(merge.body, { merge_method: 'squash', sha: bundle.pullRequest.head.sha });
  assert.equal(merge.token, PAT);
  assert.ok(reads.includes(`git/trees/${MERGED_SHA}?recursive=1`), reads.join('\n'));
  assert.ok(reads.includes(`contents/${LEDGER_PATH}?ref=${MERGED_SHA}`), reads.join('\n'));
  for (const request of requests.filter(({ method }) => method === 'GET')) assert.equal(request.token, DEFAULT_TOKEN);
  assert.equal(commit.path, `contents/${LEDGER_PATH}`);
  assert.equal(commit.token, PAT);
  assert.equal(commit.body.branch, 'main');
  assert.equal(commit.body.sha, STORED_BLOB);
  assert.equal(commit.body.message, 'chore(autowriter): record the measurement debt of a-slug');
  assert.deepEqual(commit.body.committer, { name: 'autowriter-bot', email: `autowriter-bot@${siteBrand().name}` });
  const written = JSON.parse(Buffer.from(commit.body.content, 'base64').toString('utf8'));
  assert.deepEqual(validateLedger(written), []);
  assert.equal(written.verdict.state, 'merged');
  assert.equal(written.verdict.decidedAt, now().toISOString());
  assert.equal(written.measurementDebt.mergedCommit, MERGED_SHA);
  assert.equal(written.measurementDebt.fingerprint, TREE_FINGERPRINT);
  assert.equal(written.measurementDebt.clear, CLEAR_COMMAND);
});

for (const [place, path] of Object.entries(LEDGER_FILINGS)) {
  test(`over the real adapters a ledger filed ${place} is found in the merged tree, and the debt goes to the path it was found at`, async () => {
    const { run, requests } = await mergeWith({ ledgerPath: path, tree: treeFilingLedgerAt(path) });
    const { action } = await run();
    const [, commit] = writes(requests);
    const reads = requests.filter(({ method }) => method === 'GET').map((request) => request.path);

    assert.equal(action, 'merged');
    assert.ok(reads.includes(`contents/${path}?ref=${MERGED_SHA}`), reads.join('\n'));
    assert.equal(commit.path, `contents/${path}`);
    assert.equal(commit.body.sha, STORED_BLOB);
  });
}

test('over the real adapters a merged tree that holds no ledger of the slug starts one, filed under the month of the merge', async () => {
  const tree = TREE.filter(({ path }) => path !== LEDGER_PATH);
  const { run, requests, now } = await mergeWith({ tree });
  const { action } = await run();
  const [, commit] = writes(requests);
  const reads = requests.filter(({ method }) => method === 'GET').map((request) => request.path);

  assert.equal(action, 'merged');
  assert.ok(!reads.some((path) => path.startsWith('contents/')), reads.join('\n'));
  assert.equal(commit.path, `contents/${recordPath('ledger', 'a-slug', now())}`);
  assert.equal(commit.body.sha, undefined);
});

test("over the real adapters a base branch that refuses the debt raises the hard stop issue and fails the run with GitHub's answer", async () => {
  const writeBody = { message: 'Repository rule violations found' };
  const { run, requests } = await mergeWith({ writeStatus: 409, writeBody });

  await assert.rejects(
    run(),
    (error) => error.status === 409 && /Repository rule violations found/.test(error.message)
  );
  const issues = requests.filter(({ path }) => path === 'issues');

  assert.equal(issues.length, 1);
  assert.match(issues[0].body.title, /measurement debt/);
  for (const named of [MERGED_SHA, TREE_FINGERPRINT, CLEAR_COMMAND, 'Repository rule violations found'])
    assert.ok(issues[0].body.body.includes(named), `the issue does not name ${named}`);
});
