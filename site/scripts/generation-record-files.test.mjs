import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { ARTICLE_SLUG, CLAIMED_AT, recordInput } from './fixtures/generation-input.mjs';
import { RecordError, buildRecord, readRecord, writeRecord } from './generation-record.mjs';
import { recordPath } from './record-layout.mjs';

const base = buildRecord(recordInput());
const withTotal = (costUsd) => ({ ...base, totals: { ...base.totals, costUsd } });

const scratch = (t) => {
  const root = mkdtempSync(join(tmpdir(), 'generation-record-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
};

const filed = (slug) => recordPath('generation', slug, CLAIMED_AT);

const record = (t) => {
  const root = scratch(t);
  return { root, path: join(root, filed(ARTICLE_SLUG)) };
};

test('a record is written whole as two-space JSON with a final newline and read back unchanged', (t) => {
  const { path } = record(t);
  writeRecord(path, base);
  assert.equal(readFileSync(path, 'utf8'), `${JSON.stringify(base, null, 2)}\n`);
  assert.deepEqual(readRecord(path), base);
});

test('a write creates the year and month directories and leaves no staging file beside the record', (t) => {
  const { root, path } = record(t);
  writeRecord(path, base);
  assert.deepEqual(readdirSync(join(root, 'audits/autowriter/generations')), ['2026']);
  assert.deepEqual(readdirSync(join(root, 'audits/autowriter/generations/2026')), ['11']);
  assert.deepEqual(readdirSync(join(root, 'audits/autowriter/generations/2026/11')), [`${ARTICLE_SLUG}.json`]);
});

test('a second write replaces the first whole', (t) => {
  const { path } = record(t);
  writeRecord(path, base);
  const changed = { ...base, runId: '987654321' };
  writeRecord(path, changed);
  assert.deepEqual(readRecord(path), changed);
});

test('a record with a planted wrong total is refused with the problem named, and nothing is written', (t) => {
  const { root, path } = record(t);
  const message = `${path} does not match the generation record schema: totals.costUsd is 9 but its calls add up to 0.05`;
  assert.throws(
    () => writeRecord(path, withTotal(9)),
    (error) =>
      error instanceof RecordError &&
      error.message === message &&
      JSON.stringify(error.problems) === JSON.stringify(['totals.costUsd is 9 but its calls add up to 0.05'])
  );
  assert.equal(existsSync(join(root, 'audits')), false);
});

test('a record on disk with a planted wrong total is refused on read', (t) => {
  const { path } = record(t);
  writeRecord(path, base);
  writeFileSync(path, JSON.stringify(withTotal(9)));
  assert.throws(
    () => readRecord(path),
    (error) => error instanceof RecordError && error.problems.length === 1
  );
});

test('the message shows five problems and counts the rest', (t) => {
  const { path } = record(t);
  const broken = {
    ...base,
    totals: { tokens: { input: 1, output: 1 }, costUsd: 9 },
    calls: base.calls.map((call) => ({ ...call, costUsd: 5 })),
  };
  assert.throws(
    () => writeRecord(path, broken),
    (error) => error.problems.length === 5 && !error.message.includes('more')
  );
  const worse = { ...broken, published: { callIndex: 7 }, files: ['x.md'] };
  assert.throws(
    () => writeRecord(path, worse),
    (error) => error.problems.length === 7 && error.message.endsWith('(and 2 more)')
  );
});

test('a record named for another slug is refused on write and on read', (t) => {
  const { root, path } = record(t);
  const wrong = join(root, filed('another-slug'));
  const stem = `slug ${ARTICLE_SLUG} does not match the file name another-slug.json`;
  assert.throws(
    () => writeRecord(wrong, base),
    (error) => error instanceof RecordError && error.problems.includes(stem)
  );
  assert.equal(existsSync(join(root, 'audits')), false);
  writeRecord(path, base);
  writeFileSync(wrong, readFileSync(path));
  assert.throws(
    () => readRecord(wrong),
    (error) => error.problems.includes(stem)
  );
});

test('a file that is not JSON is refused with its path and the parser error as the cause', (t) => {
  const { root, path } = record(t);
  writeRecord(path, base);
  const broken = join(root, filed('broken'));
  writeFileSync(broken, '{ not json');
  assert.throws(
    () => readRecord(broken),
    (error) => error.message.startsWith(`${broken} is not readable JSON: `) && error.cause instanceof SyntaxError
  );
});

test('a file that is missing is refused with its path', (t) => {
  const { path } = record(t);
  assert.throws(
    () => readRecord(path),
    (error) => error.message.startsWith(`${path} is not readable JSON: `)
  );
});
