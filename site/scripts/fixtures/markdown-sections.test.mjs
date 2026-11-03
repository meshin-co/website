import assert from 'node:assert/strict';
import { test } from 'node:test';

import { headingsOf, itemsOf, proseOf, sectionOf, tablesOf } from './markdown-sections.mjs';

const SAMPLE = [
  '# Title',
  '',
  'Intro.',
  '',
  '## First',
  '',
  'Some words.',
  'More words.',
  '',
  '| A   | B   |',
  '| --- | --- |',
  '| 1   | 2   |',
  '| 3   | 4   |',
  '',
  'Between.',
  '',
  '| C   |',
  '| --- |',
  '| 5   |',
  '',
  '## Second',
  '',
  '- one',
  '- two',
  '',
].join('\n');

test('headings are the second-level ones, in order', () => {
  assert.deepEqual(headingsOf(SAMPLE), ['First', 'Second']);
});

test('a section runs to the next second-level heading, and a missing one is an error', () => {
  const first = sectionOf(SAMPLE, 'First');
  assert.ok(first.includes('Between.'));
  assert.ok(!first.includes('- one') && !first.includes('## Second'));
  assert.deepEqual(sectionOf(SAMPLE, 'Second'), ['', '- one', '- two', '']);
  assert.throws(() => sectionOf(SAMPLE, 'Third'), /no section "Third"/);
});

test('each table of a section comes back on its own, with its header and its rows and without the rule line', () => {
  assert.deepEqual(tablesOf(SAMPLE, 'First'), [
    {
      header: ['A', 'B'],
      rows: [
        ['1', '2'],
        ['3', '4'],
      ],
    },
    { header: ['C'], rows: [['5']] },
  ]);
  assert.deepEqual(tablesOf(SAMPLE, 'Second'), []);
});

test('prose is every line that is not blank, a table row or a list item, joined by one space', () => {
  assert.equal(proseOf(SAMPLE, 'First'), 'Some words. More words. Between.');
  assert.equal(proseOf(SAMPLE, 'Second'), '');
});

test('items are the list lines of a section', () => {
  assert.deepEqual(itemsOf(SAMPLE, 'Second'), ['- one', '- two']);
  assert.deepEqual(itemsOf(SAMPLE, 'First'), []);
});
