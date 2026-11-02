import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { editorialRecords, isPending } from './editorial-findings.mjs';
import { knownRule } from './repair-kinds.mjs';

const GATE = 'gate:editorial';
const CONDITIONAL_FILE = 'audits/phase-4.7/conditional-copy.json';
const RULES = [
  'unreviewed-copy',
  'untraceable-copy',
  'dead-copy',
  'stale-disposition',
  'stale-conditional-declaration',
  'invalid-conditional-declaration',
  'disposition-target-missing',
];

const row = (overrides = {}) => ({
  location: 'frontmatter.title',
  text: 'A title that is still waiting for review',
  status: 'unreviewed',
  usedIn: ['src/data/glossary/x.md', '/glossary/x'],
  ...overrides,
});

const planted = {
  rows: [row()],
  untraceable: [{ route: '/blog/y', text: 'This paragraph ships and no source row holds it.' }],
  dead: [{ location: 'text', text: 'Copy that no page ships', usedIn: ['src/components/Box.astro'] }],
  stale: [
    {
      target: 'src/data/glossary/x.md',
      location: 'frontmatter.title',
      status: 'verified',
      reason: 'read it',
      digest: 'abc123abc123',
      why: 'the text changed since it was dispositioned',
    },
  ],
  conditional: {
    stale: [{ text: 'Declared but shipped', reason: 'only in one state' }],
    invalid: [{ text: 'Declared without a reason', usedIn: ['src/pages/a.astro'] }],
  },
  missingTarget: [{ target: 'src/data/glossary/gone.md', status: 'verified' }],
};

const recordFor = (rule, input = planted) => editorialRecords(input).find((record) => record.rule === rule);

test('one planted case per kind yields exactly the seven rule ids', () => {
  assert.deepEqual(
    editorialRecords(planted).map((record) => record.rule),
    RULES
  );
});

test('every rule id the gate emits is a kind the repair table knows', () => {
  for (const rule of RULES) assert.equal(knownRule({ gate: GATE, rule }), true, rule);
});

test('a pending row is any status outside rewritten, verified and owner-blocked, or owner-blocked with no reason', () => {
  assert.equal(isPending(row()), true);
  assert.equal(isPending(row({ status: 'something-else' })), true);
  assert.equal(isPending(row({ status: 'owner-blocked' })), true);
  assert.equal(isPending(row({ status: 'owner-blocked', reason: 'needs the owner' })), false);
  assert.equal(isPending(row({ status: 'rewritten' })), false);
  assert.equal(isPending(row({ status: 'verified' })), false);
});

test('unreviewed-copy names the source files of the row under site/, its location and status, and the text', () => {
  const usedIn = ['src/pages/a.astro', '/about', 'src/x.mjs'];
  const record = recordFor('unreviewed-copy', { rows: [row({ usedIn })] });
  assert.deepEqual(record, {
    rule: 'unreviewed-copy',
    subjects: ['site/src/pages/a.astro', 'site/src/x.mjs'],
    detail: 'frontmatter.title: unreviewed',
    excerpt: 'A title that is still waiting for review',
  });
});

test('unreviewed-copy falls back to the routes when the row has no source file', () => {
  const record = recordFor('unreviewed-copy', { rows: [row({ usedIn: ['/about', '/blog/x'] })] });
  assert.deepEqual(record?.subjects, ['/about', '/blog/x']);
});

test('unreviewed-copy keeps a path that already starts with site/ and lists reviewed rows nowhere', () => {
  const records = editorialRecords({
    rows: [row({ usedIn: ['site/src/a.astro'] }), row({ text: 'done', status: 'verified' })],
  });
  assert.equal(records.length, 1);
  assert.deepEqual(records[0].subjects, ['site/src/a.astro']);
});

test('untraceable-copy names the route and carries the shipped text', () => {
  assert.deepEqual(recordFor('untraceable-copy'), {
    rule: 'untraceable-copy',
    subjects: ['/blog/y'],
    detail: 'ships but traces to no source row',
    excerpt: 'This paragraph ships and no source row holds it.',
  });
});

test('dead-copy names the source files of the unshipped copy', () => {
  assert.deepEqual(recordFor('dead-copy'), {
    rule: 'dead-copy',
    subjects: ['site/src/components/Box.astro'],
    detail: 'source copy no page ships',
    excerpt: 'Copy that no page ships',
  });
});

test('stale-disposition prefixes a bare source path with site/ and gives its why and location', () => {
  assert.deepEqual(recordFor('stale-disposition'), {
    rule: 'stale-disposition',
    subjects: ['site/src/data/glossary/x.md'],
    detail: 'the text changed since it was dispositioned',
    excerpt: 'frontmatter.title',
  });
});

test('a stale disposition with no location has an empty excerpt', () => {
  const [{ location, ...withoutLocation }] = planted.stale;
  assert.equal(location, 'frontmatter.title');
  assert.equal(recordFor('stale-disposition', { rows: [], stale: [withoutLocation] })?.excerpt, '');
});

test('a disposition target is normalised: a route stays, site/ stays, ./ is dropped, anything else gains site/', () => {
  const subjectOf = (target) => editorialRecords({ rows: [], stale: [{ target, why: 'w' }] })[0]?.subjects;
  assert.deepEqual(subjectOf('/blog/x'), ['/blog/x']);
  assert.deepEqual(subjectOf('/'), ['/']);
  assert.deepEqual(subjectOf('site/src/data/post/x.md'), ['site/src/data/post/x.md']);
  assert.deepEqual(subjectOf('src/data/glossary/x.md'), ['site/src/data/glossary/x.md']);
  assert.deepEqual(subjectOf('public/search/box.mjs'), ['site/public/search/box.mjs']);
  assert.deepEqual(subjectOf('./src/data/glossary/x.md'), ['site/src/data/glossary/x.md']);
  assert.deepEqual(subjectOf('./site/src/data/glossary/x.md'), ['site/src/data/glossary/x.md']);
});

test('stale-conditional-declaration points at the declaration file and carries the text', () => {
  assert.deepEqual(recordFor('stale-conditional-declaration'), {
    rule: 'stale-conditional-declaration',
    subjects: [CONDITIONAL_FILE],
    detail: 'declared conditional but the build ships it',
    excerpt: 'Declared but shipped',
  });
});

test('invalid-conditional-declaration points at the declaration file and carries the text', () => {
  assert.deepEqual(recordFor('invalid-conditional-declaration'), {
    rule: 'invalid-conditional-declaration',
    subjects: [CONDITIONAL_FILE],
    detail: 'conditional declaration carries no reason',
    excerpt: 'Declared without a reason',
  });
});

test('disposition-target-missing normalises the missing target', () => {
  assert.deepEqual(recordFor('disposition-target-missing'), {
    rule: 'disposition-target-missing',
    subjects: ['site/src/data/glossary/gone.md'],
    detail: 'disposition names a file that does not exist',
    excerpt: '',
  });
});

test('missing optional parts produce no record', () => {
  assert.deepEqual(editorialRecords({ rows: [] }), []);
  assert.deepEqual(editorialRecords({ rows: [], conditional: { stale: [], invalid: [] } }), []);
});
