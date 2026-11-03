import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LedgerError } from './autowriter-ledger.mjs';
import { GitHubError, readLedgerAt, readTree } from './pr-github.mjs';
import {
  HEAD,
  LEDGER_FILINGS,
  LEDGER_PATH,
  NOT_THE_LEDGER,
  aLedger,
  apiAnswering,
  json,
  ledgerAt,
  ledgerBody,
  notFound,
  treeListing,
  withTree,
} from './fixtures/github-fake.mjs';
import { filedAt } from './fixtures/record-depths.mjs';

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

test('a ledger is found in the tree at the ref and read there, with its blob sha and the path found', async () => {
  const ledger = aLedger();
  const { api, calls } = apiAnswering(withTree([LEDGER_PATH], ledgerAt(LEDGER_PATH, ledger)));

  assert.deepEqual(await readLedgerAt(api, { slug: 'a-slug', ref: HEAD }), {
    value: ledger,
    blobSha: 'blob-9',
    path: LEDGER_PATH,
  });
  assert.deepEqual(
    calls.map(({ path }) => path),
    [`git/trees/${HEAD}?recursive=1`, `contents/${LEDGER_PATH}?ref=${HEAD}`]
  );
});

for (const [place, path] of Object.entries(LEDGER_FILINGS)) {
  test(`a ledger filed ${place} is found by its slug at the ref, among files that are not it`, async () => {
    const ledger = aLedger();
    const { api, calls } = apiAnswering(withTree([...NOT_THE_LEDGER, path], ledgerAt(path, ledger)));

    assert.deepEqual(await readLedgerAt(api, { slug: 'a-slug', ref: HEAD }), {
      value: ledger,
      blobSha: 'blob-9',
      path,
    });
    assert.deepEqual(
      calls.map((call) => call.path).filter((asked) => asked.startsWith('contents/')),
      [`contents/${path}?ref=${HEAD}`]
    );
  });
}

test('three ledgers filed flat, in the month directory and below it are each found by their own slug in one tree, three of three', async () => {
  const at = filedAt('2026-11-01T00:00:00.000Z');
  const filings = {
    'alpha-post': at.flat('ledger', 'alpha-post'),
    'beta-post': at.month('ledger', 'beta-post'),
    'gamma-post': at.deeper('ledger', 'gamma-post'),
  };
  const contents = (path) => {
    const slug = Object.keys(filings).find((name) => path.startsWith(`contents/${filings[name]}?`));
    return slug === undefined ? notFound() : ledgerBody(aLedger(slug), `blob-${slug}`);
  };
  const { api } = apiAnswering(withTree([...NOT_THE_LEDGER, ...Object.values(filings)], contents));

  const found = [];
  for (const slug of Object.keys(filings)) found.push(await readLedgerAt(api, { slug, ref: HEAD }));

  assert.equal(found.filter((ledger) => ledger !== null).length, 3);
  assert.deepEqual(
    found.map(({ path }) => path),
    Object.values(filings)
  );
  assert.deepEqual(
    found.map(({ value, blobSha }) => [value.slug, blobSha]),
    Object.keys(filings).map((slug) => [slug, `blob-${slug}`])
  );
});

test('a ledger absent from the tree at the ref is null, which the caller decides what to do with', async () => {
  const { api, calls } = apiAnswering(withTree(NOT_THE_LEDGER));

  assert.equal(await readLedgerAt(api, { slug: 'a-slug', ref: HEAD }), null);
  assert.deepEqual(
    calls.map(({ path }) => path),
    [`git/trees/${HEAD}?recursive=1`]
  );
});

test('a ledger that the tree lists but the contents no longer find is null too', async () => {
  const { api } = apiAnswering(withTree([LEDGER_PATH], notFound));

  assert.equal(await readLedgerAt(api, { slug: 'a-slug', ref: HEAD }), null);
});

test('a ledger filed twice at the ref fails loudly, naming both files', async () => {
  const { api } = apiAnswering(withTree([LEDGER_PATH, LEDGER_FILINGS.flat]));

  await assert.rejects(readLedgerAt(api, { slug: 'a-slug', ref: HEAD }), (error) => {
    assert.match(error.message, /ledger a-slug is filed more than once/);
    assert.ok(error.message.includes(LEDGER_PATH) && error.message.includes(LEDGER_FILINGS.flat), error.message);
    return true;
  });
});

test('a tree GitHub cut short fails the read of a ledger, and is never read as a ledger that is absent', async () => {
  const { api } = apiAnswering(() => treeListing([LEDGER_PATH], { truncated: true }));

  await assert.rejects(readLedgerAt(api, { slug: 'a-slug', ref: HEAD }), /incomplete/);
});

test('a ledger at the ref that breaks the schema fails loudly, as one read with a snapshot does', async () => {
  const broken = { ...aLedger(), attempts: 'none' };
  const { api } = apiAnswering(withTree([LEDGER_PATH], () => ledgerBody(broken)));

  await assert.rejects(readLedgerAt(api, { slug: 'a-slug', ref: HEAD }), LedgerError);
});

test('a ledger whose slug differs from its file name fails loudly at the ref too', async () => {
  const { api } = apiAnswering(withTree([LEDGER_PATH], () => ledgerBody(aLedger('another-slug'))));

  await assert.rejects(readLedgerAt(api, { slug: 'a-slug', ref: HEAD }), /does not match the file name/);
});
