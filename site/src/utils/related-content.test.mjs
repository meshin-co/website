import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  distinctByKeyword,
  firstMention,
  lastSignificantWord,
  textMentionsKeyword,
  resolveByIds,
} from './related-content.mjs';

test('lastSignificantWord takes the final word, lowercased and trimmed', () => {
  assert.equal(lastSignificantWord({ name: 'Fractional CAIO Retainer' }), 'retainer');
  assert.equal(lastSignificantWord({ name: '  AI Governance Starter Kit  ' }), 'kit');
  assert.equal(lastSignificantWord({ name: 'Scorecard' }), 'scorecard');
});

test('distinctByKeyword keeps only entities whose keyword is unique in the set', () => {
  const entities = [
    { id: 'starter-kit', name: 'AI Governance Starter Kit' },
    { id: 'build-vs-buy', name: 'Build vs Buy AI Kit' },
    { id: 'retainer', name: 'Fractional CAIO Retainer' },
  ];
  const result = distinctByKeyword(entities);
  assert.deepEqual(
    result.map((entity) => entity.id),
    ['retainer']
  );
  assert.equal(result[0].keyword, 'retainer');
});

test('distinctByKeyword drops keywords two characters or shorter', () => {
  const entities = [{ id: 'x', name: 'Something AI' }];
  assert.deepEqual(distinctByKeyword(entities), []);
});

test('textMentionsKeyword matches whole words only, case-insensitively', () => {
  assert.equal(textMentionsKeyword('Under the Retainer, I review every entry.', 'retainer'), true);
  assert.equal(textMentionsKeyword('a sprinting pace is not the same', 'sprint'), false);
  assert.equal(textMentionsKeyword('', 'sprint'), false);
  assert.equal(textMentionsKeyword('the sprint', ''), false);
});

test('firstMention returns the earliest candidate match in reading order, not array order', () => {
  const text = 'The Sprint ends when the Assessment already produced its findings.';
  const candidates = [
    { name: 'assessment', href: '/services/ai-readiness-and-risk-assessment' },
    { name: 'sprint', href: '/services/90-day-production-sprint' },
  ];
  const result = firstMention(text, candidates);
  assert.equal(result.href, '/services/90-day-production-sprint');
  assert.equal(result.matched, 'Sprint');
  assert.equal(result.before, 'The ');
  assert.equal(result.after, ' ends when the Assessment already produced its findings.');
});

test('firstMention preserves the source casing of the matched text', () => {
  const result = firstMention('Ask about ISO/IEC 42001 certification.', [
    { name: 'ISO/IEC 42001', href: '/glossary/iso-iec-42001' },
  ]);
  assert.equal(result.matched, 'ISO/IEC 42001');
});

test('firstMention returns null when nothing matches or inputs are empty', () => {
  assert.equal(firstMention('no mentions here', []), null);
  assert.equal(firstMention('', [{ name: 'sprint', href: '/x' }]), null);
  assert.equal(firstMention('no relevant terms in this sentence', [{ name: 'sprint', href: '/x' }]), null);
});

test('resolving ids keeps order and silently drops an id with no entry', () => {
  const entries = [{ id: 'a' }, { id: 'b' }];
  assert.deepEqual(resolveByIds(['b', 'missing', 'a'], entries), [{ id: 'b' }, { id: 'a' }]);
});

test('resolving an empty id list returns nothing', () => {
  assert.deepEqual(resolveByIds([], [{ id: 'a' }]), []);
});
