import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import test from 'node:test';

import { judgeFindings } from './repair-kinds.mjs';

const ENTRY = {
  slug: 'the-entry',
  format: 'article',
  route: '/blog/the-entry',
  paths: ['site/src/data/post/the-entry.md', 'docs/SEMANTIC-CORE.md'],
};

const finding = (rule, subjects, detail = 'the detail', excerpt = 'the excerpt') => ({
  rule,
  subjects,
  detail,
  excerpt,
});
const document = (gate, ...findings) => ({ gate, findings });
const judged = (documents, entry = ENTRY) => judgeFindings({ documents, entry });
const only = (gate, ...findings) => judged([document(gate, ...findings)]);
const refusedFor = (result, rule) => {
  const item = result.refused.find((entry) => entry.rule === rule);
  assert.ok(item, `${rule} was not refused`);
  return item;
};

test('a malformed finding is refused, never thrown on', () => {
  const result = only(
    'gate:content',
    null,
    'a string',
    7,
    {},
    { rule: 7 },
    { rule: '' },
    { subjects: [ENTRY.route] },
    []
  );
  assert.equal(result.refused.length, 8);
  assert.ok(result.refused.every(({ reason }) => reason === 'unclassified-rule'));
  assert.deepEqual(result.rewrite, []);
  for (const item of result.refused) {
    assert.equal(item.gate, 'gate:content');
    assert.ok(Array.isArray(item.subjects));
    assert.equal(typeof item.why, 'string');
  }
});

test('subjects that are not a list are refused as unattributed, and a subject that is not text is outside the entry', () => {
  for (const subjects of [undefined, null, 'the-entry', {}, 7]) {
    const result = only('gate:content', { rule: 'banned-phrase', subjects, detail: '', excerpt: '' });
    assert.equal(refusedFor(result, 'banned-phrase').reason, 'unattributed');
  }
  for (const subject of [7, null, undefined, ['/blog/the-entry'], {}]) {
    const result = only('gate:content', {
      rule: 'banned-phrase',
      subjects: [ENTRY.route, subject],
      detail: '',
      excerpt: '',
    });
    assert.equal(refusedFor(result, 'banned-phrase').reason, 'outside-entry');
  }
});

test('a malformed document is refused as one item, and the documents after it are still judged', () => {
  const result = judged([
    null,
    { gate: 'gate:content' },
    { gate: 'gate:content', findings: 'x' },
    document('gate:content', finding('banned-phrase', [ENTRY.route])),
  ]);
  assert.equal(result.rewrite.length, 1);
  assert.equal(result.refused.length, 3);
  assert.ok(result.refused.every(({ reason }) => reason === 'unclassified-rule'));
  assert.match(result.refused[0].why, /document/);
});

test('no documents, or documents with no findings, judge to nothing', () => {
  assert.deepEqual(judged([]), { rewrite: [], restate: [], refused: [] });
  assert.deepEqual(judged([document('gate:content')]), { rewrite: [], restate: [], refused: [] });
});

test('input that is not a list of documents, or an entry without a route and paths, is a TypeError', () => {
  for (const documents of [undefined, null, {}, 'x']) assert.throws(() => judged(documents), TypeError);
  for (const entry of [
    undefined,
    null,
    {},
    { route: ENTRY.route },
    { paths: ENTRY.paths },
    { route: 7, paths: ENTRY.paths },
    { route: '', paths: ENTRY.paths },
    { route: ENTRY.route, paths: 'x' },
    { route: ENTRY.route, paths: [7] },
  ])
    assert.throws(() => judgeFindings({ documents: [], entry }), TypeError, JSON.stringify(entry));
});

test('the input is not changed and the output shares nothing with it', () => {
  const deepFreeze = (value) => {
    if (value !== null && typeof value === 'object') {
      Object.freeze(value);
      for (const inner of Object.values(value)) deepFreeze(inner);
    }
    return value;
  };
  const documents = deepFreeze([document('gate:content', finding('banned-phrase', [ENTRY.route]))]);
  const entry = deepFreeze(structuredClone(ENTRY));
  const result = judged(documents, entry);
  assert.equal(result.rewrite.length, 1);
  result.rewrite[0].subjects.push('/changed');
  result.rewrite.push({});
  assert.deepEqual(documents[0].findings[0].subjects, [ENTRY.route]);
  assert.deepEqual(judged(documents, entry).rewrite[0].subjects, [ENTRY.route]);
});

test('an entry whose route is another route owns that route, not the first one', () => {
  const other = { ...ENTRY, route: '/glossary/the-term', paths: ['site/src/data/glossary/the-term.md'] };
  assert.equal(
    judged([document('gate:content', finding('banned-phrase', ['/glossary/the-term']))], other).rewrite.length,
    1
  );
  const result = judged([document('gate:content', finding('banned-phrase', [ENTRY.route]))], other);
  assert.equal(refusedFor(result, 'banned-phrase').reason, 'outside-entry');
});
