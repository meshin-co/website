import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, before, after } from 'node:test';

import {
  collectionLastmods,
  hubLastmods,
  taxonomyLastmods,
  staticPageLastmods,
  siteLastmods,
} from './sitemap-lastmod.mjs';

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
