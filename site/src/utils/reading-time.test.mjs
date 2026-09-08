import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readingTime } from './reading-time.mjs';

test('reading time rounds up to whole minutes and never reads as zero', () => {
  assert.equal(readingTime('word '.repeat(10)), '1 min read');
  assert.equal(readingTime('word '.repeat(440)), '2 min read');
  assert.equal(readingTime(''), '1 min read');
});

test('markdown syntax is not counted as words', () => {
  const plain = readingTime('word '.repeat(200));
  const decorated = readingTime('## Heading\n\n' + '`code` '.repeat(0) + 'word '.repeat(200));
  assert.equal(decorated, plain);
});
