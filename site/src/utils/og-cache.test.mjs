import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { findOgCacheDir, ogCacheKey, readOgImage, writeOgImage } from './og-cache.mjs';

test('the og cache key is stable for identical inputs', () => {
  const entry = { collection: 'post', id: 'a-post', title: 'A post', updatedDate: new Date('2026-09-05T00:00:00Z') };
  assert.equal(ogCacheKey(entry), ogCacheKey({ ...entry }));
  assert.equal(ogCacheKey(entry), ogCacheKey({ ...entry, updatedDate: new Date('2026-09-05T00:00:00.000Z') }));
  assert.equal(ogCacheKey(entry), ogCacheKey(entry));
});

test('the key changes when the collection, id, title or update date changes', () => {
  const base = { collection: 'post', id: 'a', title: 'T', updatedDate: new Date('2026-09-05T00:00:00Z') };
  const key = ogCacheKey(base);
  assert.notEqual(key, ogCacheKey({ ...base, title: 'T2' }));
  assert.notEqual(key, ogCacheKey({ ...base, id: 'b' }));
  assert.notEqual(key, ogCacheKey({ ...base, collection: 'glossary' }));
  assert.notEqual(key, ogCacheKey({ ...base, updatedDate: new Date('2026-09-06T00:00:00Z') }));
});

test('a key containing the separator character cannot collide with another entry', () => {
  const colliding = { collection: 'post', id: 'a\nb', title: 'c', updatedDate: undefined };
  const other = { collection: 'post', id: 'a', title: 'b\nc', updatedDate: undefined };
  assert.notEqual(ogCacheKey(colliding), ogCacheKey(other));
});

test('an undated entry keys deterministically', () => {
  assert.equal(
    ogCacheKey({ collection: 'service', id: 'assessment', title: 'Assessment' }),
    ogCacheKey({ collection: 'service', id: 'assessment', title: 'Assessment', updatedDate: undefined })
  );
});

test('a written image is read back by slug and key, and misses when either changes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'og-cache-'));
  try {
    writeOgImage(dir, 'post/a', 'key1', Buffer.from('png-bytes'));
    assert.equal(readOgImage(dir, 'post/a', 'key1')?.toString(), 'png-bytes');
    assert.equal(readOgImage(dir, 'post/a', 'key2'), null);
    assert.equal(readOgImage(dir, 'post/b', 'key1'), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a missing manifest, a deleted file and a corrupt manifest all miss gracefully', () => {
  const dir = mkdtempSync(join(tmpdir(), 'og-cache-'));
  try {
    assert.equal(readOgImage(dir, 'post/a', 'key1'), null);
    writeOgImage(dir, 'post/a', 'key1', Buffer.from('x'));
    rmSync(join(dir, 'key1.png'));
    assert.equal(readOgImage(dir, 'post/a', 'key1'), null);
    writeFileSync(join(dir, 'manifest.json'), '{not json');
    assert.equal(readOgImage(dir, 'post/a', 'key1'), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writing a second slug keeps the first readable', () => {
  const dir = mkdtempSync(join(tmpdir(), 'og-cache-'));
  try {
    writeOgImage(dir, 'post/a', 'key1', Buffer.from('one'));
    writeOgImage(dir, 'glossary/term', 'key2', Buffer.from('two'));
    assert.equal(readOgImage(dir, 'post/a', 'key1')?.toString(), 'one');
    assert.equal(readOgImage(dir, 'glossary/term', 'key2')?.toString(), 'two');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('re-rendering a slug under a new key retires the old manifest entry', () => {
  const dir = mkdtempSync(join(tmpdir(), 'og-cache-'));
  try {
    writeOgImage(dir, 'post/a', 'key1', Buffer.from('old'));
    writeOgImage(dir, 'post/a', 'key2', Buffer.from('new'));
    assert.equal(readOgImage(dir, 'post/a', 'key1'), null);
    assert.equal(readOgImage(dir, 'post/a', 'key2')?.toString(), 'new');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the cache directory resolves to .og-cache at the git root above the start directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'og-gitroot-'));
  try {
    mkdirSync(join(root, '.git'), { recursive: true });
    const deep = join(root, 'site', 'src', 'pages');
    mkdirSync(deep, { recursive: true });
    assert.equal(findOgCacheDir(deep), join(root, '.og-cache'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
