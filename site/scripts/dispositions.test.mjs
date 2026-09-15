import assert from 'node:assert/strict';
import { test } from 'node:test';

import { digestFor, applyDispositions } from './dispositions.mjs';

const rows = [
  { location: 'frontmatter.title', text: 'A title', status: 'unreviewed', usedIn: ['src/data/faq/a.md'] },
  { location: 'body', text: 'Body prose here.', status: 'unreviewed', usedIn: ['src/data/faq/a.md'] },
  { location: 'head.title', text: 'A title · meshin.co', status: 'unreviewed', usedIn: ['/faq/a'] },
];

test('a digest covers every row of one target and changes when any of its text changes', () => {
  const before = digestFor(rows, 'src/data/faq/a.md');
  const after = digestFor(
    rows.map((row) => (row.location === 'body' ? { ...row, text: 'Edited prose.' } : row)),
    'src/data/faq/a.md'
  );
  assert.notEqual(before, after);
  assert.equal(before, digestFor(rows, 'src/data/faq/a.md'));
});

test('a disposition marks every row of its target', () => {
  const { rows: applied } = applyDispositions(rows, [
    {
      target: 'src/data/faq/a.md',
      status: 'rewritten',
      reason: 'tightened the answer',
      digest: digestFor(rows, 'src/data/faq/a.md'),
    },
  ]);
  assert.deepEqual(
    applied.filter((row) => row.usedIn.includes('src/data/faq/a.md')).map((row) => row.status),
    ['rewritten', 'rewritten']
  );
  assert.equal(applied.find((row) => row.usedIn.includes('/faq/a')).status, 'unreviewed');
});

test('a disposition can narrow to one location', () => {
  const { rows: applied } = applyDispositions(rows, [
    { target: 'src/data/faq/a.md', location: 'body', status: 'verified', digest: digestFor(rows, 'src/data/faq/a.md') },
  ]);
  assert.equal(applied.find((row) => row.location === 'body').status, 'verified');
  assert.equal(applied.find((row) => row.location === 'frontmatter.title').status, 'unreviewed');
});

test('a digest that no longer matches leaves the rows unreviewed and reports staleness', () => {
  const { rows: applied, stale } = applyDispositions(rows, [
    { target: 'src/data/faq/a.md', status: 'rewritten', digest: 'deadbeef' },
  ]);
  assert.equal(
    applied.every((row) => row.status === 'unreviewed'),
    true
  );
  assert.deepEqual(
    stale.map((entry) => entry.target),
    ['src/data/faq/a.md']
  );
});

test('a disposition naming a target with no rows is reported rather than silently ignored', () => {
  const { unmatched } = applyDispositions(rows, [{ target: 'src/data/faq/ghost.md', status: 'verified', digest: 'x' }]);
  assert.deepEqual(
    unmatched.map((entry) => entry.target),
    ['src/data/faq/ghost.md']
  );
});

test('owner-blocked without a reason never becomes a disposition', () => {
  const { rows: applied, stale } = applyDispositions(rows, [
    { target: 'src/data/faq/a.md', status: 'owner-blocked', digest: digestFor(rows, 'src/data/faq/a.md') },
  ]);
  assert.equal(
    applied.filter((row) => row.usedIn.includes('src/data/faq/a.md')).every((row) => row.status === 'unreviewed'),
    true
  );
  assert.equal(stale.length, 1);
});
