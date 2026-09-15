import assert from 'node:assert/strict';
import { test } from 'node:test';

import { digestFor, applyDispositions, inheritDerivedStatus, applyConditionalCopy } from './dispositions.mjs';

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

test('a target written with or without the site/ prefix matches the same rows', () => {
  for (const target of ['src/data/faq/a.md', 'site/src/data/faq/a.md', './src/data/faq/a.md']) {
    const {
      rows: applied,
      stale,
      unmatched,
    } = applyDispositions(rows, [{ target, status: 'verified', digest: digestFor(rows, 'src/data/faq/a.md') }]);
    assert.deepEqual(stale, [], target);
    assert.deepEqual(unmatched, [], target);
    assert.equal(applied.filter((row) => row.status === 'verified').length, 2, target);
  }
});

test('a rendered row inherits the disposition of the reviewed source text it renders', () => {
  const inherited = inheritDerivedStatus([
    {
      location: 'body',
      text: 'The body prose. And a second sentence.',
      status: 'rewritten',
      reason: 'tightened',
      usedIn: ['src/data/faq/a.md'],
    },
    { location: 'body.p', text: 'The body prose.', status: 'unreviewed', usedIn: ['/faq/a'] },
  ]);
  const rendered = inherited.find((row) => row.usedIn.includes('/faq/a'));
  assert.equal(rendered.status, 'rewritten');
  assert.equal(rendered.derivedFrom, 'src/data/faq/a.md');
});

test('a rendered row composed differently stays unreviewed, because nobody read those words', () => {
  const inherited = inheritDerivedStatus([
    { location: 'frontmatter.title', text: 'What a CAIO does', status: 'verified', usedIn: ['src/data/faq/a.md'] },
    {
      location: 'head.title',
      text: 'What a CAIO does — meshin.co, the practice',
      status: 'unreviewed',
      usedIn: ['/faq/a'],
    },
  ]);
  assert.equal(inherited.find((row) => row.location === 'head.title').status, 'unreviewed');
});

test('an unreviewed source row lends nothing', () => {
  const inherited = inheritDerivedStatus([
    { location: 'body', text: 'Some prose here now.', status: 'unreviewed', usedIn: ['src/data/a.md'] },
    { location: 'body.p', text: 'Some prose here now.', status: 'unreviewed', usedIn: ['/a'] },
  ]);
  assert.equal(
    inherited.every((row) => row.status === 'unreviewed'),
    true
  );
});

test('declared state-conditional copy clears the dead finding, and the declaration must carry a reason', () => {
  const dead = [
    { text: 'Nothing published yet.', usedIn: ['src/pages/blog/index.astro'] },
    { text: 'Undeclared leftover.', usedIn: ['src/pages/x.astro'] },
  ];
  const { remaining, invalid } = applyConditionalCopy(dead, [
    { text: 'Nothing published yet.', reason: 'renders only when the collection is empty' },
    { text: 'Undeclared leftover.' },
  ]);
  assert.deepEqual(
    remaining.map((entry) => entry.text),
    ['Undeclared leftover.']
  );
  assert.deepEqual(
    invalid.map((entry) => entry.text),
    ['Undeclared leftover.']
  );
});

test('a declaration for copy that now ships is stale, so the list cannot rot', () => {
  const { stale } = applyConditionalCopy([], [{ text: 'This ships again now.', reason: 'was conditional' }]);
  assert.deepEqual(
    stale.map((entry) => entry.text),
    ['This ships again now.']
  );
});
