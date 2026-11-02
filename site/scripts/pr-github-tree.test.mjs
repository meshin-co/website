import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LedgerError } from './autowriter-ledger.mjs';
import { GitHubError, readLedgerAt, readTree } from './pr-github.mjs';
import { HEAD, aLedger, apiAnswering, json, ledgerBody, notFound } from './fixtures/github-fake.mjs';

const ENTRIES = [
  { path: 'site', mode: '040000', type: 'tree', sha: 'a'.repeat(40) },
  { path: 'site/package.json', mode: '100644', type: 'blob', sha: 'b'.repeat(40), size: 12 },
];

const answer = (patch = {}) => json({ sha: 'c'.repeat(40), tree: ENTRIES, truncated: false, ...patch });

test('a tree is read recursively by the sha asked for, and the answer is the list of its entries', async () => {
  const { api, calls } = apiAnswering(() => answer());

  assert.deepEqual(await readTree(api, HEAD), ENTRIES);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].path, `git/trees/${HEAD}?recursive=1`);
});

test('a tree GitHub cut short is refused, naming the commit, because a fingerprint of part of a tree is wrong', async () => {
  const { api } = apiAnswering(() => answer({ truncated: true }));

  await assert.rejects(readTree(api, HEAD), (error) => {
    assert.match(error.message, /incomplete/);
    assert.ok(error.message.includes(HEAD), error.message);
    return true;
  });
});

test('a tree request GitHub refuses throws the GitHub error, so the caller sees the status', async () => {
  const { api } = apiAnswering(() => json({ message: 'Not Found' }, 404));

  await assert.rejects(
    readTree(api, HEAD),
    (error) => error instanceof GitHubError && error.status === 404 && error.path.startsWith('git/trees/')
  );
});

test('a ledger is read at the ref asked for, with its blob sha and path', async () => {
  const ledger = aLedger();
  const { api, calls } = apiAnswering(() => ledgerBody(ledger, 'blob-9'));

  assert.deepEqual(await readLedgerAt(api, { slug: 'a-slug', ref: HEAD }), {
    value: ledger,
    blobSha: 'blob-9',
    path: 'audits/autowriter/a-slug.json',
  });
  assert.equal(calls[0].path, `contents/audits/autowriter/a-slug.json?ref=${HEAD}`);
});

test('a ledger absent at the ref is null, which the caller decides what to do with', async () => {
  const { api } = apiAnswering(notFound);

  assert.equal(await readLedgerAt(api, { slug: 'a-slug', ref: HEAD }), null);
});

test('a ledger at the ref that breaks the schema fails loudly, as one read with a snapshot does', async () => {
  const broken = { ...aLedger(), attempts: 'none' };
  const { api } = apiAnswering(() => ledgerBody(broken));

  await assert.rejects(readLedgerAt(api, { slug: 'a-slug', ref: HEAD }), LedgerError);
});

test('a ledger whose slug differs from its file name fails loudly at the ref too', async () => {
  const { api } = apiAnswering(() => ledgerBody(aLedger('another-slug')));

  await assert.rejects(readLedgerAt(api, { slug: 'a-slug', ref: HEAD }), /does not match the file name/);
});
