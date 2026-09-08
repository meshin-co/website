import assert from 'node:assert/strict';
import { test } from 'node:test';

import { countWords, isWithinWordRange, isNotBeforePublish } from './content-rules.mjs';

test('word counting ignores punctuation, dashes and repeated whitespace', () => {
  assert.equal(countWords('  One  two—three, four.  '), 4);
  assert.equal(countWords(''), 0);
});

test('a word range is inclusive at both ends', () => {
  assert.equal(isWithinWordRange('a b c', 3, 5), true);
  assert.equal(isWithinWordRange('a b c d e', 3, 5), true);
  assert.equal(isWithinWordRange('a b', 3, 5), false);
  assert.equal(isWithinWordRange('a b c d e f', 3, 5), false);
});

test('an update on the publish day is allowed, a day earlier is not', () => {
  const publish = new Date('2026-09-01T00:00:00Z');
  assert.equal(isNotBeforePublish(publish, new Date('2026-09-01T00:00:00Z')), true);
  assert.equal(isNotBeforePublish(publish, new Date('2026-09-02T00:00:00Z')), true);
  assert.equal(isNotBeforePublish(publish, new Date('2026-08-31T23:59:59Z')), false);
});
