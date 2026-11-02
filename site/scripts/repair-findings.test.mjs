import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ledgerWithAttempt, newLedger, validateLedger } from './autowriter-ledger.mjs';
import { apiAnswering, json } from './fixtures/github-fake.mjs';
import { buildZip } from './fixtures/zip-writer.mjs';
import {
  attemptFailure,
  earlierAttemptWithSameFailure,
  failureKey,
  failuresOf,
  findingsArtifactName,
  readFindings,
} from './repair-findings.mjs';

const RUN = { id: 9001, attempt: 2 };
const LIST_PATH = 'actions/runs/9001/artifacts?per_page=100';
const ZIP_PATH = 'actions/artifacts/77/zip';

const finding = (rule, subjects, extra = {}) => ({ rule, subjects, detail: 'd', excerpt: 'e', ...extra });
const document = (gate, findings) => ({ schema: 1, gate, findings });
const file = (name, body) => ({ name, data: typeof body === 'string' ? body : JSON.stringify(body) });
const artifact = (name, extra = {}) => ({ id: 77, name, expired: false, ...extra });
const listing = (artifacts, total = artifacts.length) => json({ total_count: total, artifacts });

const CONTENT = document('gate:content', [
  finding('banned-phrase', ['site/src/data/post/a.md', 'site/src/data/post/b.md']),
]);
const LINKS = document('gate:links', [finding('dead-link', ['/blog/a'])]);

function serve({ artifacts = [artifact('gate-findings-2')], total, zip, download } = {}) {
  return apiAnswering(({ path }) => {
    if (path === LIST_PATH) return listing(artifacts, total);
    if (path === ZIP_PATH) return download ? download() : new Response(zip);
    throw new Error(`unexpected request ${path}`);
  });
}

const stopOf = async (promise) => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  return assert.fail('expected a RepairStop');
};
const refused = async (promise, outcome, pattern) => {
  const error = await stopOf(promise);
  assert.equal(error.name, 'RepairStop');
  assert.equal(error.outcome, outcome);
  assert.match(error.message, pattern);
  return error;
};

test('the artifact of an attempt is named for the attempt', () => {
  assert.equal(findingsArtifactName(2), 'gate-findings-2');
});

test('two gate files are read, parsed and sorted by gate, and only the list and the download are requested', async () => {
  const zip = buildZip([
    file('gate-links.json', LINKS),
    file('notes.txt', 'not json at all'),
    file('gate-content.json', CONTENT),
  ]);
  const { api, calls } = serve({ zip });
  const documents = await readFindings({ api, run: RUN });
  assert.deepEqual(documents, [
    { gate: 'gate:content', findings: CONTENT.findings },
    { gate: 'gate:links', findings: LINKS.findings },
  ]);
  assert.deepEqual(
    calls.map(({ path }) => path),
    [LIST_PATH, ZIP_PATH]
  );
});

test('a file in a folder of the archive is read by its base name, and a document with no findings is skipped', async () => {
  const zip = buildZip([file('out/gate-links.json', LINKS), file('out/gate-a11y.json', document('gate:a11y', []))]);
  const documents = await readFindings({ api: serve({ zip }).api, run: RUN });
  assert.deepEqual(documents, [{ gate: 'gate:links', findings: LINKS.findings }]);
});

test('the artifact of another attempt is not picked', async () => {
  const zip = buildZip([file('gate-links.json', LINKS)]);
  const artifacts = [artifact('gate-findings-1', { id: 5 }), artifact('gate-findings-2')];
  const { api, calls } = serve({ zip, artifacts });
  await readFindings({ api, run: RUN });
  assert.equal(calls[1].path, ZIP_PATH);
});

test('an expired artifact is refused as unrepairable', async () => {
  const { api, calls } = serve({ artifacts: [artifact('gate-findings-2', { expired: true })] });
  await refused(readFindings({ api, run: RUN }), 'unrepairable', /gate-findings-2/);
  assert.equal(calls.length, 1);
});

test('a run with no artifact of that name is unrepairable', async () => {
  const { api } = serve({ artifacts: [artifact('gate-findings-1')] });
  await refused(readFindings({ api, run: RUN }), 'unrepairable', /gate-findings-2/);
  await refused(readFindings({ api: serve({ artifacts: [] }).api, run: RUN }), 'unrepairable', /gate-findings-2/);
});

test('an archive with no gate file, or only empty ones, is unrepairable', async () => {
  const none = buildZip([file('readme.txt', 'x')]);
  await refused(readFindings({ api: serve({ zip: none }).api, run: RUN }), 'unrepairable', /gate-findings-2/);
  const empty = buildZip([file('gate-links.json', document('gate:links', []))]);
  await refused(readFindings({ api: serve({ zip: empty }).api, run: RUN }), 'unrepairable', /no findings/);
});

test('bytes that are not a zip are a failure, and the message does not quote them', async () => {
  const error = await refused(
    readFindings({ api: serve({ zip: 'SECRET-BYTES-XYZ-0123456789' }).api, run: RUN }),
    'failed',
    /gate-findings-2/
  );
  assert.doesNotMatch(error.message, /SECRET-BYTES/);
});

test('a document with a bad shape is a failure that names the file and never quotes its text', async () => {
  const bad = buildZip([file('gate-links.json', 'SECRET-TEXT {{{')]);
  const error = await refused(readFindings({ api: serve({ zip: bad }).api, run: RUN }), 'failed', /gate-links\.json/);
  assert.doesNotMatch(error.message, /SECRET-TEXT/);
  const shape = buildZip([file('gate-links.json', { schema: 1, gate: 'gate:links' })]);
  await refused(readFindings({ api: serve({ zip: shape }).api, run: RUN }), 'failed', /gate-links\.json/);
});

test('a file whose name disagrees with its gate is a failure', async () => {
  const zip = buildZip([file('gate-links.json', CONTENT)]);
  await refused(readFindings({ api: serve({ zip }).api, run: RUN }), 'failed', /gate-links\.json.*gate-content\.json/);
});

test('two files for one gate are a failure', async () => {
  const zip = buildZip([file('a/gate-links.json', LINKS), file('b/gate-links.json', LINKS)]);
  await refused(readFindings({ api: serve({ zip }).api, run: RUN }), 'failed', /gate:links/);
});

test('a truncated artifact list is a failure', async () => {
  const { api, calls } = serve({ total: 101 });
  await refused(readFindings({ api, run: RUN }), 'failed', /artifact list/);
  assert.equal(calls.length, 1);
});

test('a GitHub error from the download, or from the list, is a failure', async () => {
  const download = () => json({ message: 'Gone' }, 410);
  await refused(readFindings({ api: serve({ download }).api, run: RUN }), 'failed', /gate-findings-2.*410/);
  const { api } = apiAnswering(() => json({ message: 'Server Error' }, 500));
  await refused(readFindings({ api, run: RUN }), 'failed', /gate-findings-2.*500/);
});

const pair = (rule, path) => ({ rule, path });

test('failuresOf expands subjects, dedupes across documents and sorts by rule then path', () => {
  const documents = [
    { gate: 'gate:links', findings: [finding('dead-link', ['/b', '/a', '/b']), finding('no-subject', [])] },
    { gate: 'gate:content', findings: [finding('banned-phrase', ['/z']), finding('dead-link', ['/a'])] },
  ];
  assert.deepEqual(failuresOf(documents), [
    pair('banned-phrase', '/z'),
    pair('dead-link', '/a'),
    pair('dead-link', '/b'),
  ]);
  assert.deepEqual(failuresOf([]), []);
});

test('failureKey ignores order and duplicates and tells different lists apart', () => {
  const one = [pair('a', '/x'), pair('b', '/y')];
  assert.equal(failureKey(one), failureKey([pair('b', '/y'), pair('a', '/x'), pair('a', '/x')]));
  assert.notEqual(failureKey(one), failureKey([pair('a', '/x')]));
  assert.notEqual(failureKey([pair('a', '/x')]), failureKey([pair('a', '/y')]));
  assert.notEqual(failureKey([pair('a', 'b')]), failureKey([pair('a/b', '')]));
});

const listed = (number, failures) => ({
  number,
  failingRule: failures[0].rule,
  failingPath: failures[0].path,
  failures,
});
const legacy = (number, failingRule, failingPath) => ({ number, failingRule, failingPath });
const SAME = [pair('dead-link', '/a'), pair('banned-phrase', '/z')];

test('an earlier attempt with a recorded failure list that is the same set is found, in any order', () => {
  const attempts = [
    listed(1, [pair('other', '/q')]),
    listed(2, [pair('banned-phrase', '/z'), pair('dead-link', '/a')]),
  ];
  assert.equal(earlierAttemptWithSameFailure({ attempts, failures: SAME }), attempts[1]);
});

test('a legacy attempt matches a failure of its single rule and path', () => {
  const attempts = [legacy(1, 'dead-link', '/a')];
  assert.equal(earlierAttemptWithSameFailure({ attempts, failures: [pair('dead-link', '/a')] }), attempts[0]);
  assert.equal(earlierAttemptWithSameFailure({ attempts, failures: SAME }), null);
});

test('a legacy attempt with a null rule or path never matches', () => {
  const attempts = [legacy(1, null, null), legacy(2, 'dead-link', null), legacy(3, null, '/a')];
  for (const failures of [SAME, [pair('dead-link', '/a')], [pair('null', 'null')]])
    assert.equal(earlierAttemptWithSameFailure({ attempts, failures }), null);
});

test('an empty failure list matches nothing', () => {
  const attempts = [
    { number: 1, failingRule: null, failingPath: null },
    { ...listed(2, SAME), failures: [] },
  ];
  assert.equal(earlierAttemptWithSameFailure({ attempts, failures: [] }), null);
});

test('the first of several matching attempts is returned', () => {
  const attempts = [listed(1, SAME), legacy(2, 'dead-link', '/a'), listed(3, SAME)];
  assert.equal(earlierAttemptWithSameFailure({ attempts, failures: SAME }), attempts[0]);
});

test('no attempts means no earlier attempt', () => {
  assert.equal(earlierAttemptWithSameFailure({ attempts: [], failures: SAME }), null);
});

test('attemptFailure of an empty list is two nulls and no failures member', () => {
  const recorded = attemptFailure([]);
  assert.deepEqual(recorded, { failingRule: null, failingPath: null });
  assert.equal('failures' in recorded, false);
});

test('attemptFailure of a list is its first pair and the whole list, and a ledger attempt holding it validates', () => {
  const failures = [pair('banned-phrase', '/z'), pair('dead-link', '/a')];
  const recorded = attemptFailure(failures);
  assert.deepEqual(recorded, { failingRule: 'banned-phrase', failingPath: '/z', failures });
  const ledger = newLedger({ slug: 'an-entry', runId: '9001', pullRequest: 7 });
  const base = {
    judgedCommit: 'a'.repeat(40),
    recordedAt: '2026-11-02T09:00:00.000Z',
    tokens: { input: 10, output: 5 },
    costUsd: 0.1,
  };
  assert.deepEqual(validateLedger(ledgerWithAttempt(ledger, { ...base, ...recorded })), []);
  const none = ledgerWithAttempt(ledger, { ...base, ...attemptFailure([]) });
  assert.deepEqual(validateLedger(none), []);
});
