import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { MANIFEST_PATH, VISUAL_MODE, collectionPattern, freezeCorpus } from './visual-corpus.mjs';

function siteWith({ entries = {}, manifest } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'visual-corpus-'));
  mkdirSync(join(root, 'src/data'), { recursive: true });
  for (const [collection, names] of Object.entries(entries)) {
    mkdirSync(join(root, 'src/data', collection), { recursive: true });
    for (const name of names) writeFileSync(join(root, 'src/data', collection, name), '---\ntitle: x\n---\n');
  }
  if (manifest !== undefined) writeFileSync(join(root, MANIFEST_PATH), JSON.stringify(manifest));
  return root;
}

test('the live build keeps reading every entry, and needs no manifest to do it', () => {
  const root = siteWith({ entries: { post: ['a.md'] } });

  assert.deepEqual(collectionPattern('post', { mode: 'production', root }), ['*.md', '*.mdx']);
  assert.deepEqual(collectionPattern('post', { root }), ['*.md', '*.mdx']);
});

test('the visual build reads the entries the manifest pins and no others', () => {
  const root = siteWith({
    entries: { post: ['a.md', 'b.md', 'c.mdx'] },
    manifest: { post: ['a.md', 'c.mdx'] },
  });

  assert.deepEqual(collectionPattern('post', { mode: VISUAL_MODE, root }), ['a.md', 'c.mdx']);
});

test('an entry added after the freeze is on disk and still invisible to the visual build', () => {
  const root = siteWith({
    entries: { post: ['old.md', 'written-last-night.md'], glossary: ['term.md', 'a-new-term.md'] },
    manifest: { post: ['old.md'], glossary: ['term.md'] },
  });

  assert.deepEqual(collectionPattern('post', { mode: VISUAL_MODE, root }), ['old.md']);
  assert.deepEqual(collectionPattern('glossary', { mode: VISUAL_MODE, root }), ['term.md']);
});

test('a collection with entries on disk that the manifest does not list fails the visual build, never renders empty', () => {
  const root = siteWith({ entries: { post: ['a.md'], faq: ['q.md', 'r.md'] }, manifest: { post: ['a.md'] } });

  assert.throws(
    () => collectionPattern('faq', { mode: VISUAL_MODE, root }),
    /faq has 2 entries in src\/data\/faq and the manifest does not list the collection; run npm run assets:visual-corpus/
  );
});

test('a collection with no entries on disk and none in the manifest reads nothing', () => {
  const root = siteWith({ entries: { post: ['a.md'], faq: [] }, manifest: { post: ['a.md'] } });

  assert.deepEqual(collectionPattern('faq', { mode: VISUAL_MODE, root }), []);
  assert.deepEqual(collectionPattern('case', { mode: VISUAL_MODE, root }), []);
});

test('a collection the manifest lists as empty stays empty after entries arrive', () => {
  const root = siteWith({ entries: { case: ['first-case.md'] }, manifest: { case: [] } });

  assert.deepEqual(collectionPattern('case', { mode: VISUAL_MODE, root }), []);
});

test('a pinned entry that left the data folder fails the visual build, naming the entry and the fix', () => {
  const root = siteWith({ entries: { post: ['a.md'] }, manifest: { post: ['a.md', 'removed.md', 'renamed.md'] } });

  assert.throws(
    () => collectionPattern('post', { mode: VISUAL_MODE, root }),
    /post pins removed\.md, renamed\.md, which are no longer in src\/data\/post; run npm run assets:visual-corpus/
  );
});

test('a pinned entry is matched by its file name, so another extension of the same name is not read', () => {
  const root = siteWith({ entries: { post: ['a.md', 'a.mdx'] }, manifest: { post: ['a.md'] } });

  assert.deepEqual(collectionPattern('post', { mode: VISUAL_MODE, root }), ['a.md']);
});

test('a missing manifest fails the visual build, naming the file and the command that writes it', () => {
  const root = siteWith({ entries: { post: ['a.md'] } });

  assert.throws(
    () => collectionPattern('post', { mode: VISUAL_MODE, root }),
    /src\/data\/visual-corpus\.json is missing; run npm run assets:visual-corpus/
  );
});

test('freezing pins every collection folder, entry files only, in a stable order', () => {
  const root = siteWith({ entries: { post: ['b.md', 'a.mdx', 'notes.txt'], faq: [], author: ['dmitri.md'] } });
  writeFileSync(join(root, 'src/data/tags.mjs'), 'export const tags = [];\n');

  const frozen = freezeCorpus(join(root, 'src/data'));

  assert.deepEqual(frozen, { author: ['dmitri.md'], faq: [], post: ['a.mdx', 'b.md'] });
  assert.deepEqual(Object.keys(frozen), ['author', 'faq', 'post']);
});

test('what freezing writes is what the visual build then reads, entry for entry', () => {
  const root = siteWith({ entries: { post: ['one.md', 'two.md'], glossary: ['term.md'] } });
  writeFileSync(join(root, MANIFEST_PATH), JSON.stringify(freezeCorpus(join(root, 'src/data'))));
  writeFileSync(join(root, 'src/data/post/later.md'), '---\ntitle: later\n---\n');

  assert.deepEqual(collectionPattern('post', { mode: VISUAL_MODE, root }), ['one.md', 'two.md']);
  assert.deepEqual(collectionPattern('glossary', { mode: VISUAL_MODE, root }), ['term.md']);
});
