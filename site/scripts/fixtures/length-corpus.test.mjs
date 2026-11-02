import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { bodyProfile } from '../entry-length.mjs';
import { parseEntrySource } from '../entry-prose.mjs';
import { DATA, STEADY, entryFile, repoWith, words } from './length-corpus.mjs';

test('words makes exactly the count asked, the last one closing a sentence', () => {
  for (const count of [1, 2, 40]) {
    const text = words(count);
    assert.equal(text.split(' ').length, count);
    assert.ok(text.endsWith('end.'));
  }
});

test('an entry file is a front matter block and one question section per count', () => {
  const { frontmatter, body } = parseEntrySource(entryFile([30, 50]));
  assert.equal(frontmatter.title, 'An entry');
  assert.deepEqual(
    bodyProfile({ collection: 'post', body }).sections.map(({ heading, words }) => [heading, words]),
    [
      ['Question 1?', 30],
      ['Question 2?', 50],
    ]
  );
});

test('the steady corpus holds three articles and two terms under the data directory', () => {
  const paths = Object.keys(STEADY);
  assert.equal(paths.filter((path) => path.startsWith(DATA + '/post/')).length, 3);
  assert.equal(paths.filter((path) => path.startsWith(DATA + '/glossary/')).length, 2);
});

test('a repository is written under a temporary directory that is removed after the test', async (t) => {
  let root;
  await t.test('inner', (inner) => {
    root = repoWith(inner, { 'a/b.txt': 'text' });
    assert.equal(readFileSync(join(root, 'a/b.txt'), 'utf8'), 'text');
  });
  assert.equal(existsSync(root), false);
});
