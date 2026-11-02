import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import test from 'node:test';

import { judgeFindings } from './repair-kinds.mjs';

const ENTRY = {
  slug: 'the-entry',
  format: 'article',
  route: '/blog/the-entry',
  paths: [
    'site/src/data/post/the-entry.md',
    'audits/autowriter/the-entry.json',
    'audits/autowriter/generations/the-entry.json',
    'audits/phase-4.7/dispositions/generated-the-entry.json',
    'docs/SEMANTIC-CORE.md',
  ],
};
const FILE = 'site/src/data/post/the-entry.md';
const FOREIGN = '/blog/another-post';

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

test('a document of mixed findings is split by what the table says, in the order it came', () => {
  const result = judged([
    document(
      'gate:content',
      finding('banned-phrase', [ENTRY.route]),
      finding('inbound-links', [ENTRY.route]),
      finding('sentence-length', [ENTRY.route])
    ),
    document('gate:editorial', finding('stale-disposition', [FILE])),
    document('gate:human', finding('reading-grade', [ENTRY.route]), finding('no-pages', [])),
  ]);
  assert.deepEqual(
    result.rewrite.map(({ gate, rule }) => `${gate} ${rule}`),
    ['gate:content banned-phrase', 'gate:content sentence-length', 'gate:human reading-grade']
  );
  assert.deepEqual(
    result.restate.map(({ gate, rule }) => `${gate} ${rule}`),
    ['gate:editorial stale-disposition']
  );
  assert.deepEqual(
    result.refused.map(({ gate, rule, reason }) => [gate, rule, reason]),
    [
      ['gate:content', 'inbound-links', 'not-prose'],
      ['gate:human', 'no-pages', 'not-prose'],
    ]
  );
});

test('an accepted item holds the gate, the rule, the subjects, the detail and the excerpt, and nothing else', () => {
  const found = { ...finding('banned-phrase', [ENTRY.route], 'a detail', 'an excerpt'), unexpected: 'field' };
  const [item] = only('gate:content', found).rewrite;
  assert.deepEqual(item, {
    gate: 'gate:content',
    rule: 'banned-phrase',
    subjects: ['/blog/the-entry'],
    detail: 'a detail',
    excerpt: 'an excerpt',
  });
});

test('a refused item holds the finding, its reason and one plain sentence', () => {
  const result = only('gate:content', finding('doc-drift', ['docs/SEMANTIC-CORE.md'], 'drifted', 'a row'));
  assert.deepEqual(result.refused, [
    {
      gate: 'gate:content',
      rule: 'doc-drift',
      subjects: ['docs/SEMANTIC-CORE.md'],
      detail: 'drifted',
      excerpt: 'a row',
      reason: 'not-prose',
      why: refusedFor(result, 'doc-drift').why,
    },
  ]);
  assert.match(result.refused[0].why, /regeneration/);
});

test('a rule the table does not know is refused before anything else, even with no subject', () => {
  const result = only('gate:content', finding('h1-colour', []));
  assert.equal(refusedFor(result, 'h1-colour').reason, 'unclassified-rule');
  assert.match(refusedFor(result, 'h1-colour').why, /no row/);
});

test('the table refuses a generated document even when the subject is a path the entry owns', () => {
  const result = only('gate:content', finding('doc-drift', ['docs/SEMANTIC-CORE.md']));
  assert.ok(ENTRY.paths.includes('docs/SEMANTIC-CORE.md'));
  assert.equal(refusedFor(result, 'doc-drift').reason, 'not-prose');
});

test('a whole-site finding with no subject is refused as not prose, not as unattributed', () => {
  assert.equal(refusedFor(only('gate:human', finding('no-pages', [])), 'no-pages').reason, 'not-prose');
});

test('a repairable rule with no subject is refused as unattributed', () => {
  const result = only('gate:content', finding('banned-phrase', []));
  assert.equal(refusedFor(result, 'banned-phrase').reason, 'unattributed');
  assert.match(refusedFor(result, 'banned-phrase').why, /whose fault/);
});

test('a finding that names the entry and another route is outside the entry, and the reason names that route', () => {
  const result = only('gate:content', finding('banned-phrase', [ENTRY.route, FOREIGN]));
  assert.equal(refusedFor(result, 'banned-phrase').reason, 'outside-entry');
  assert.match(refusedFor(result, 'banned-phrase').why, /another-post/);
  assert.doesNotMatch(refusedFor(result, 'banned-phrase').why, /the-entry/);
});

test('a finding that names a file the entry does not own is outside the entry', () => {
  const result = only('gate:content', finding('banned-phrase', ['site/src/data/post/another-post.md']));
  assert.equal(refusedFor(result, 'banned-phrase').reason, 'outside-entry');
});

test('an entry owns its file, its ledger, its record, its disposition file and the semantic core', () => {
  for (const path of ENTRY.paths) {
    const result = only('gate:content', finding('banned-phrase', [path]));
    assert.equal(result.rewrite.length, 1, path);
  }
});

test('a finding that names the entry by its file is repairable as it is by its route', () => {
  const result = only('gate:editorial', finding('stale-disposition', [FILE, ENTRY.route]));
  assert.equal(result.restate.length, 1);
});

test('a subject is compared exactly: a trailing slash, a dot path, another case or a space is another subject', () => {
  for (const subject of [
    '/blog/the-entry/',
    './site/src/data/post/the-entry.md',
    '/Blog/the-entry',
    '/blog/the-entry ',
  ]) {
    const result = only('gate:content', finding('banned-phrase', [subject]));
    assert.equal(refusedFor(result, 'banned-phrase').reason, 'outside-entry', subject);
  }
});

test('a finding shared with other routes is repairable when the entry is among its subjects', () => {
  const shared = only('gate:content', finding('duplicate-sentence', [ENTRY.route, '/faq']));
  assert.equal(shared.rewrite.length, 1);
  assert.deepEqual(shared.refused, []);
  const three = only('gate:content', finding('duplicate-sentence', ['/faq', ENTRY.route, '/about']));
  assert.equal(three.rewrite.length, 1);
});

test('a finding shared between two routes the entry is not one of is outside the entry', () => {
  const result = only('gate:content', finding('duplicate-sentence', ['/faq', '/about']));
  assert.equal(refusedFor(result, 'duplicate-sentence').reason, 'outside-entry');
});

test('a shared finding that also names a file the entry does not own is outside the entry', () => {
  const result = only(
    'gate:content',
    finding('duplicate-sentence', [ENTRY.route, 'site/src/data/post/another-post.md'])
  );
  assert.equal(refusedFor(result, 'duplicate-sentence').reason, 'outside-entry');
});

test('a rule that is not shared gets no such allowance, however many routes it names', () => {
  for (const rule of ['banned-phrase', 'sentence-length', 'h1-query']) {
    const result = only('gate:content', finding(rule, [ENTRY.route, '/faq']));
    assert.equal(refusedFor(result, rule).reason, 'outside-entry', rule);
  }
});

test('unreviewed copy is restated only beside a stale disposition that names the same text', () => {
  const together = only('gate:editorial', finding('unreviewed-copy', [FILE]), finding('stale-disposition', [FILE]));
  assert.deepEqual(together.refused, []);
  assert.deepEqual(
    together.restate.map(({ rule }) => rule),
    ['unreviewed-copy', 'stale-disposition']
  );
});

test('unreviewed copy with no stale disposition is refused as not prose, because there is nothing to restate', () => {
  const alone = only('gate:editorial', finding('unreviewed-copy', [FILE]));
  assert.equal(refusedFor(alone, 'unreviewed-copy').reason, 'not-prose');
  assert.match(refusedFor(alone, 'unreviewed-copy').why, /stale-disposition/);
  assert.deepEqual(alone.restate, []);
});

test('a stale disposition for other text does not stand beside unreviewed copy', () => {
  const result = only(
    'gate:editorial',
    finding('unreviewed-copy', [FILE]),
    finding('stale-disposition', ['site/src/pages/blog/index.astro'])
  );
  assert.equal(refusedFor(result, 'unreviewed-copy').reason, 'not-prose');
  assert.equal(refusedFor(result, 'stale-disposition').reason, 'outside-entry');
  assert.deepEqual(result.restate, []);
});

test('a partner counts when it shares any one subject', () => {
  const result = only(
    'gate:editorial',
    finding('unreviewed-copy', [FILE, ENTRY.route]),
    finding('stale-disposition', [ENTRY.route])
  );
  assert.equal(result.restate.length, 2);
});

test('a partner in another document does not count, and a lookalike rule is not a partner', () => {
  const apart = judged([
    document('gate:editorial', finding('unreviewed-copy', [FILE])),
    document('gate:editorial', finding('stale-disposition', [FILE])),
  ]);
  assert.equal(refusedFor(apart, 'unreviewed-copy').reason, 'not-prose');
  const lookalike = only('gate:editorial', finding('unreviewed-copy', [FILE]), finding('stale-disposition-x', [FILE]));
  assert.equal(refusedFor(lookalike, 'unreviewed-copy').reason, 'not-prose');
  assert.equal(refusedFor(lookalike, 'stale-disposition-x').reason, 'unclassified-rule');
});

test('an unknown gate refuses every finding as unclassified, even one whose rule another gate knows', () => {
  const result = only('gate:nothing', finding('h1-count', [ENTRY.route]), finding('reading-grade', [ENTRY.route]));
  assert.deepEqual(result.rewrite, []);
  assert.deepEqual(
    result.refused.map(({ reason }) => reason),
    ['unclassified-rule', 'unclassified-rule']
  );
});

test('a rule filed under another gate is refused as unclassified', () => {
  const result = only('gate:human', finding('h1-count', [ENTRY.route]));
  assert.equal(refusedFor(result, 'h1-count').reason, 'unclassified-rule');
});

test('names that exist on every object are refused as unclassified', () => {
  for (const rule of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf']) {
    const result = only('gate:content', finding(rule, [ENTRY.route]));
    assert.equal(result.refused.length, 1, rule);
    assert.equal(result.refused[0].reason, 'unclassified-rule', rule);
    assert.deepEqual(result.rewrite, [], rule);
  }
  const gate = only('constructor', finding('h1-count', [ENTRY.route]));
  assert.equal(gate.refused[0].reason, 'unclassified-rule');
});
