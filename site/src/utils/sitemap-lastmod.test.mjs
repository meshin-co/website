import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, before, after } from 'node:test';

import {
  collectionLastmods,
  hubLastmods,
  taxonomyLastmods,
  staticPageLastmods,
  siteLastmods,
  noindexEntryRoutes,
  noindexCategoryRoutes,
  noindexHubRoutes,
} from './sitemap-lastmod.mjs';
import { publicIndexableStaticPages } from './machine-text.mjs';

let root;

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'sitemap-lastmod-'));
  await Promise.all([mkdir(join(root, 'post')), mkdir(join(root, 'faq')), mkdir(join(root, 'glossary'))]);
  await writeFile(
    join(root, 'post', 'dated.md'),
    '---\ntitle: Dated\npublishDate: 2026-05-01\nupdatedDate: 2026-06-01\ncategory: governance\ntags: [ai-governance]\n---\n\nBody.\n'
  );
  await writeFile(join(root, 'post', 'undated.md'), '---\ntitle: Undated\n---\n\nBody.\n');
  await writeFile(join(root, 'post', 'sidecar.txt'), '---\npublishDate: 2026-05-01\n---\n');
  await writeFile(
    join(root, 'post', 'second.md'),
    '---\ntitle: Second\npublishDate: 2026-07-01\nupdatedDate: 2026-07-15\ncategory: executive\ntags: [ai-governance, shadow-ai]\n---\n\nBody.\n'
  );
  await writeFile(
    join(root, 'post', 'draft.md'),
    '---\ntitle: Draft\npublishDate: 2026-08-01\nupdatedDate: 2026-08-01\ndraft: true\ncategory: executive\ntags: [shadow-ai]\n---\n\nBody.\n'
  );
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
    '/blog/second': '2026-07-15T00:00:00.000Z',
    '/blog/draft': '2026-08-01T00:00:00.000Z',
    '/faq/a-question': '2026-09-12T00:00:00.000Z',
    '/glossary/term': '2026-03-15T00:00:00.000Z',
  });
});

test('collectionLastmods returns an empty map when a data directory is missing entirely', async () => {
  const lastmods = await collectionLastmods(join(root, 'does-not-exist'));

  assert.deepEqual(lastmods, {});
});

test('hubLastmods maps each collection hub to its newest live entry, ignoring a draft that is newer still', async () => {
  const hubs = await hubLastmods(root);

  assert.deepEqual(hubs, {
    '/blog': '2026-07-15T00:00:00.000Z',
    '/faq': '2026-09-12T00:00:00.000Z',
    '/glossary': '2026-03-15T00:00:00.000Z',
  });
});

test('taxonomyLastmods maps every live category and tag to its newest post, dropping a draft post entirely', async () => {
  const taxonomies = await taxonomyLastmods(root);

  assert.deepEqual(taxonomies, {
    '/blog/category/governance': '2026-06-01T00:00:00.000Z',
    '/blog/category/executive': '2026-07-15T00:00:00.000Z',
    '/blog/tag/ai-governance': '2026-07-15T00:00:00.000Z',
    '/blog/tag/shadow-ai': '2026-07-15T00:00:00.000Z',
    '/blog/tags': '2026-07-15T00:00:00.000Z',
  });
});

test('noindexEntryRoutes lists a live entry marked noindex, never a draft one even if it is also noindex', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sitemap-lastmod-noindex-'));
  await Promise.all([mkdir(join(dir, 'post')), mkdir(join(dir, 'faq'))]);
  await writeFile(
    join(dir, 'post', 'hidden.md'),
    '---\ntitle: Hidden\npublishDate: 2026-01-01\nupdatedDate: 2026-01-01\nnoindex: true\ncategory: governance\ntags: []\n---\n\nBody.\n'
  );
  await writeFile(
    join(dir, 'post', 'visible.md'),
    '---\ntitle: Visible\npublishDate: 2026-01-01\nupdatedDate: 2026-01-01\ncategory: governance\ntags: []\n---\n\nBody.\n'
  );
  await writeFile(
    join(dir, 'post', 'draft-and-noindex.md'),
    '---\ntitle: DraftHidden\npublishDate: 2026-01-01\nupdatedDate: 2026-01-01\ndraft: true\nnoindex: true\ncategory: governance\ntags: []\n---\n\nBody.\n'
  );
  await writeFile(
    join(dir, 'faq', 'hidden-question.md'),
    '---\nquestion: Q?\nanswer: A.\npublishDate: 2026-01-01\nupdatedDate: 2026-01-01\nnoindex: true\n---\n'
  );
  try {
    const routes = await noindexEntryRoutes(dir);
    assert.deepEqual(routes.sort(), ['/blog/hidden', '/faq/hidden-question']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('noindexCategoryRoutes lists a category with zero live posts, treating a draft-only category as empty', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sitemap-lastmod-category-'));
  await mkdir(join(dir, 'post'));
  await writeFile(
    join(dir, 'post', 'a.md'),
    '---\ntitle: A\npublishDate: 2026-01-01\nupdatedDate: 2026-01-01\ncategory: governance\ntags: []\n---\n\nBody.\n'
  );
  await writeFile(
    join(dir, 'post', 'draft.md'),
    '---\ntitle: Draft\npublishDate: 2026-01-01\nupdatedDate: 2026-01-01\ndraft: true\ncategory: executive\ntags: []\n---\n\nBody.\n'
  );
  try {
    const routes = await noindexCategoryRoutes(dir, ['governance', 'executive', 'operating-model']);
    assert.deepEqual(routes.sort(), ['/blog/category/executive', '/blog/category/operating-model']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('noindexHubRoutes lists the hub of every collection with no live entry, counting a draft or a noindex entry as none', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sitemap-lastmod-hubs-'));
  await Promise.all(['post', 'service', 'resource', 'glossary', 'case', 'faq'].map((kind) => mkdir(join(dir, kind))));
  const entry = (extra) => `---\ntitle: T\npublishDate: 2026-01-01\nupdatedDate: 2026-01-01\n${extra}---\n\nBody.\n`;
  await writeFile(join(dir, 'post', 'live.md'), entry(''));
  await writeFile(join(dir, 'faq', 'live.md'), entry(''));
  await writeFile(join(dir, 'glossary', 'live.mdx'), entry(''));
  await writeFile(join(dir, 'service', 'draft.md'), entry('draft: true\n'));
  await writeFile(join(dir, 'case', 'private.md'), entry('noindex: true\n'));
  try {
    assert.deepEqual((await noindexHubRoutes(dir)).sort(), ['/case-studies', '/resources', '/services']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('noindexHubRoutes keeps a hub the moment one live entry exists, with no other edit', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sitemap-lastmod-first-case-'));
  await mkdir(join(dir, 'case'));
  try {
    assert.ok((await noindexHubRoutes(dir)).includes('/case-studies'));
    await writeFile(
      join(dir, 'case', 'first.md'),
      '---\ntitle: First\npublishDate: 2026-10-20\nupdatedDate: 2026-10-20\n---\n'
    );
    assert.equal((await noindexHubRoutes(dir)).includes('/case-studies'), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('staticPageLastmods dates a page by its editorial day, as the instant a collection entry date becomes', () => {
  const lastmods = staticPageLastmods([{ path: '/about', updatedDate: '2026-04-10' }]);

  assert.deepEqual(lastmods, { '/about': '2026-04-10T00:00:00.000Z' });
});

test('staticPageLastmods refuses a page with no editorial date instead of omitting it or guessing one', () => {
  assert.throws(() => staticPageLastmods([{ path: '/never-dated' }]), /\/never-dated carries no updatedDate/);
});

test('siteLastmods lets a collection hub date win over the editorial date of a page that is both', async () => {
  const lastmods = await siteLastmods({
    dataDir: root,
    staticPages: [
      { path: '/faq', updatedDate: '2026-03-01' },
      { path: '/about', updatedDate: '2026-04-10' },
    ],
  });

  assert.equal(lastmods['/faq'], '2026-09-12T00:00:00.000Z');
  assert.equal(lastmods['/about'], '2026-04-10T00:00:00.000Z');
  assert.equal(lastmods['/blog'], '2026-07-15T00:00:00.000Z');
  assert.equal(lastmods['/blog/tags'], '2026-07-15T00:00:00.000Z');
});

test('siteLastmods refuses a static page that neither a collection nor the catalog dates', async () => {
  await assert.rejects(
    siteLastmods({ dataDir: root, staticPages: [{ path: '/never-dated' }] }),
    /\/never-dated carries no updatedDate/
  );
});

test('siteLastmods gives an empty collection hub no date', async () => {
  const lastmods = await siteLastmods({ dataDir: root, staticPages: [] });

  assert.equal('/case-studies' in lastmods, false);
  assert.equal('/services' in lastmods, false);
});

test('siteLastmods leaves a page its collection owns undated while that collection is empty, and still dates the rest', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sitemap-lastmod-empty-owner-'));
  try {
    const lastmods = await siteLastmods({
      dataDir: dir,
      staticPages: [{ path: '/faq' }, { path: '/blog/tags' }, { path: '/about', updatedDate: '2026-04-10' }],
    });

    assert.deepEqual(lastmods, { '/about': '2026-04-10T00:00:00.000Z' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the real site dates every public static page, from a collection or from the catalog', async () => {
  const staticPages = publicIndexableStaticPages();
  const lastmods = await siteLastmods({ dataDir: fileURLToPath(new URL('../data', import.meta.url)), staticPages });

  for (const { path } of staticPages) assert.ok(lastmods[path], `${path} has no lastmod`);
});
