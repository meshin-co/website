import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import test from 'node:test';

import { HUMAN_KINDS } from './repair-kinds-human.mjs';

const DECIDED = {
  'reading-grade': ['rewrite', 'words-down'],
  'reading-ease': ['rewrite', 'words-down'],
  'sentence-average': ['rewrite', 'words-down'],
  'sentence-longest': ['rewrite'],
  'long-sentences': ['rewrite', 'words-down'],
  'long-word-share': ['rewrite', 'words-down'],
  'passive-voice': ['rewrite'],
  'sentence-variance': ['rewrite'],
  'paragraph-variance': ['rewrite'],
  'list-variety': ['rewrite'],
  'heading-variety': ['rewrite'],
  'antithesis-template': ['rewrite'],
  'bolded-lead': ['rewrite'],
  'emoji-bullet': ['rewrite'],
  'controlled-word': ['rewrite'],
  'no-pages': ['refuse'],
  'nothing-measured': ['refuse'],
};

const oneSentence = (why) => {
  assert.equal(typeof why, 'string');
  assert.match(why, /^[A-Z0-9][^\n]*[.]$/);
  assert.ok(why.length <= 240, `${why.length} characters`);
  assert.doesNotMatch(why, /[.!?]\s+[A-Z]/);
};

for (const [rule, [kind, ...may]] of Object.entries(DECIDED)) {
  test(`gate:human ${rule} is ${kind}${may.length > 0 ? `, may ${may.join(' and ')}` : ''}`, () => {
    const row = HUMAN_KINDS[rule];
    assert.ok(row, `the human table has no row for ${rule}`);
    assert.equal(row.repairable, kind !== 'refuse');
    assert.equal(row.how, kind === 'refuse' ? null : 'rewrite');
    assert.equal(row.shared, undefined);
    assert.equal(row.needs, undefined);
    assert.deepEqual([...row.may], may);
    oneSentence(row.why);
  });
}

test('the human table holds exactly the 17 rules of the human gate', () => {
  assert.deepEqual(Object.keys(HUMAN_KINDS).sort(), Object.keys(DECIDED).sort());
  assert.equal(Object.keys(HUMAN_KINDS).length, 17);
});

test('15 human rules are rewrites and 2 are refused', () => {
  const rows = Object.values(HUMAN_KINDS);
  assert.equal(rows.filter((row) => row.how === 'rewrite').length, 15);
  assert.equal(rows.filter((row) => !row.repairable).length, 2);
});

test('only the whole-entry statistics may lower the word count', () => {
  const lowering = Object.entries(HUMAN_KINDS)
    .filter(([, row]) => row.may.includes('words-down'))
    .map(([rule]) => rule);
  assert.deepEqual(lowering.sort(), [
    'long-sentences',
    'long-word-share',
    'reading-ease',
    'reading-grade',
    'sentence-average',
  ]);
});
