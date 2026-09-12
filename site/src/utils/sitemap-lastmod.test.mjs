import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, before, after } from 'node:test';

import { collectionLastmods } from './sitemap-lastmod.mjs';

let root;

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'sitemap-lastmod-'));
  await Promise.all([mkdir(join(root, 'post')), mkdir(join(root, 'faq')), mkdir(join(root, 'glossary'))]);
  await writeFile(
    join(root, 'post', 'dated.md'),
    '---\ntitle: Dated\npublishDate: 2026-05-01\nupdatedDate: 2026-06-01\n---\n\nBody.\n'
  );
  await writeFile(join(root, 'post', 'undated.md'), '---\ntitle: Undated\n---\n\nBody.\n');
  await writeFile(join(root, 'post', 'sidecar.txt'), '---\npublishDate: 2026-05-01\n---\n');
  await writeFile(
    join(root, 'faq', 'a-question.md'),
    '---\nquestion: Q?\nanswer: A.\npublishDate: 2026-09-12\nupdatedDate: 2026-09-12\n---\n'
  );
  await writeFile(
    join(root, 'glossary', 'term.mdx'),
    '---\ntitle: Term\npublishDate: 2026-02-01\nupdatedDate: 2026-03-15\n---\n'
  );
});

after(async () => {
  await rm(root, { recursive: true, force: true });
});

test('collectionLastmods maps every dated entry onto its route by collection base and newest date', async () => {
  const lastmods = await collectionLastmods(root);

  assert.deepEqual(lastmods, {
    '/blog/dated': '2026-06-01T00:00:00.000Z',
    '/faq/a-question': '2026-09-12T00:00:00.000Z',
    '/glossary/term': '2026-03-15T00:00:00.000Z',
  });
});

test('collectionLastmods returns an empty map when a data directory is missing entirely', async () => {
  const lastmods = await collectionLastmods(join(root, 'does-not-exist'));

  assert.deepEqual(lastmods, {});
});
