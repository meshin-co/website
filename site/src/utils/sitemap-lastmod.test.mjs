import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, before, after } from 'node:test';

import {
  collectionLastmods,
  hubLastmods,
  hubPagesWithoutDate,
  taxonomyLastmods,
  staticPageLastmods,
  siteLastmods,
  noindexEntryRoutes,
  noindexCategoryRoutes,
} from './sitemap-lastmod.mjs';
import { publicIndexableStaticPages } from './machine-text.mjs';

const execFileAsync = promisify(execFile);

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

async function gitFixture() {
  const repo = await mkdtemp(join(tmpdir(), 'sitemap-lastmod-git-'));
  await execFileAsync('git', ['init', '-q'], { cwd: repo });
  await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: repo });
  await writeFile(join(repo, 'about.astro'), 'placeholder');
  await execFileAsync('git', ['add', 'about.astro'], { cwd: repo });
  await execFileAsync('git', ['commit', '-q', '-m', 'add about'], {
    cwd: repo,
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: '2026-04-10T12:00:00Z',
      GIT_COMMITTER_DATE: '2026-04-10T12:00:00Z',
    },
  });
  return repo;
}

test('staticPageLastmods reads the git commit date of the page file, not the checkout wall clock', async () => {
  const repo = await gitFixture();
  try {
    const lastmods = await staticPageLastmods([{ path: '/about', file: 'about.astro' }], { cwd: repo });
    assert.equal(lastmods['/about'], '2026-04-10T12:00:00.000Z');
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test('staticPageLastmods omits a page whose file has no git history instead of guessing a date', async () => {
  const repo = await gitFixture();
  try {
    const lastmods = await staticPageLastmods([{ path: '/never-committed', file: 'never-committed.astro' }], {
      cwd: repo,
    });
    assert.deepEqual(lastmods, {});
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test('siteLastmods lets a collection hub date win over a static-file date for a page that is both', async () => {
  const repo = await gitFixture();
  try {
    const lastmods = await siteLastmods({
      dataDir: root,
      staticPages: [
        { path: '/faq', file: 'about.astro' },
        { path: '/about', file: 'about.astro' },
      ],
      cwd: repo,
    });

    assert.equal(lastmods['/faq'], '2026-09-12T00:00:00.000Z');
    assert.equal(lastmods['/about'], '2026-04-10T12:00:00.000Z');
    assert.equal(lastmods['/blog'], '2026-07-15T00:00:00.000Z');
    assert.equal(lastmods['/blog/tags'], '2026-07-15T00:00:00.000Z');
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

async function commitPage(repo, file, isoDate) {
  await mkdir(dirname(join(repo, file)), { recursive: true });
  await writeFile(join(repo, file), 'placeholder');
  await execFileAsync('git', ['add', file], { cwd: repo });
  await execFileAsync('git', ['commit', '-q', '-m', `add ${file}`], {
    cwd: repo,
    env: { ...process.env, GIT_AUTHOR_DATE: isoDate, GIT_COMMITTER_DATE: isoDate },
  });
}

test('hubPagesWithoutDate names each collection hub with no entry-derived date, apart from a page a static file dates', () => {
  const pages = hubPagesWithoutDate({ '/blog': '2026-07-15T00:00:00.000Z' }, [
    { path: '/faq', file: 'src/pages/faq.astro' },
  ]);

  assert.deepEqual(pages, [
    { path: '/services', file: 'src/pages/services/index.astro' },
    { path: '/resources', file: 'src/pages/resources/index.astro' },
    { path: '/glossary', file: 'src/pages/glossary/index.astro' },
    { path: '/case-studies', file: 'src/pages/case-studies/index.astro' },
  ]);
});

test('every collection hub no static page covers has its page file where the lastmod fallback looks', async () => {
  const pages = hubPagesWithoutDate({}, publicIndexableStaticPages());

  assert.ok(pages.length > 0);
  await Promise.all(pages.map((page) => access(page.file)));
});

test('siteLastmods dates an empty collection hub from its own page file in git, never from the build clock', async () => {
  const repo = await gitFixture();
  try {
    await commitPage(repo, 'src/pages/case-studies/index.astro', '2026-10-02T09:30:00Z');
    const lastmods = await siteLastmods({ dataDir: root, staticPages: [], cwd: repo });

    assert.equal(lastmods['/case-studies'], '2026-10-02T09:30:00.000Z');
    assert.equal(lastmods['/services'], undefined);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test('a populated hub keeps its newest entry date even when its page file is newer in git', async () => {
  const repo = await gitFixture();
  try {
    await commitPage(repo, 'src/pages/blog/index.astro', '2026-12-01T00:00:00Z');
    const lastmods = await siteLastmods({ dataDir: root, staticPages: [], cwd: repo });

    assert.equal(lastmods['/blog'], '2026-07-15T00:00:00.000Z');
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});
