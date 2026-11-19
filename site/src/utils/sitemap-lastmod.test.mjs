import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, before, after } from 'node:test';

import {
  collectionLastmods,
  hubLastmods,
  seriesLastmods,
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

const specFile = ({ name = 'evals-baseline', version, publishDate, updatedDate = publishDate, extra = '' }) =>
  `---\ntitle: ${name} specification ${version}\nname: ${name}\nversion: '${version}'\npublishDate: ${publishDate}\nupdatedDate: ${updatedDate}\n${extra}---\n\nBody.\n`;

async function withSpecs(files, run) {
  const dir = await mkdtemp(join(tmpdir(), 'sitemap-lastmod-spec-'));
  await mkdir(join(dir, 'spec'));
  try {
    for (const [file, text] of Object.entries(files)) await writeFile(join(dir, 'spec', file), text);
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const TWO_VERSIONS = {
  'evals-baseline-1.0.md': specFile({ version: '1.0', publishDate: '2026-11-12', updatedDate: '2026-11-14' }),
  'evals-baseline-1.1.md': specFile({ version: '1.1', publishDate: '2026-12-01', updatedDate: '2026-12-02' }),
};

test('collectionLastmods dates a specification version at its name and version, not at its file name', async () => {
  await withSpecs(TWO_VERSIONS, async (dir) => {
    assert.deepEqual(await collectionLastmods(dir), {
      '/spec/evals-baseline/1.0': '2026-11-14T00:00:00.000Z',
      '/spec/evals-baseline/1.1': '2026-12-02T00:00:00.000Z',
    });
  });
});

test('seriesLastmods dates a series at its newest live version, past a draft and a noindex version that are newer still', async () => {
  await withSpecs(
    {
      ...TWO_VERSIONS,
      'evals-baseline-1.2.md': specFile({ version: '1.2', publishDate: '2027-01-01', extra: 'draft: true\n' }),
      'evals-baseline-2.0.md': specFile({ version: '2.0', publishDate: '2027-02-01', extra: 'noindex: true\n' }),
      'other-1.0.md': specFile({ name: 'other', version: '1.0', publishDate: '2026-10-01' }),
    },
    async (dir) => {
      assert.deepEqual(await seriesLastmods(dir), {
        '/spec/evals-baseline': '2026-12-02T00:00:00.000Z',
        '/spec/other': '2026-10-01T00:00:00.000Z',
      });
    }
  );
});

test('seriesLastmods gives a name with no live version no route, and a data directory with no specification folder none at all', async () => {
  await withSpecs(
    { 'evals-baseline-1.0.md': specFile({ version: '1.0', publishDate: '2026-11-12', extra: 'draft: true\n' }) },
    async (dir) => assert.deepEqual(await seriesLastmods(dir), {})
  );
  assert.deepEqual(await seriesLastmods(join(root, 'does-not-exist')), {});
});

test('a specification series has no hub: hubLastmods and noindexHubRoutes name none for it, with or without a live version', async () => {
  await withSpecs(TWO_VERSIONS, async (dir) => {
    assert.equal('/spec' in (await hubLastmods(dir)), false);
    assert.equal((await noindexHubRoutes(dir)).includes('/spec'), false);
  });
  await withSpecs({}, async (dir) => assert.equal((await noindexHubRoutes(dir)).includes('/spec'), false));
});

test('noindexEntryRoutes names a noindex specification version by its address and never a draft one', async () => {
  await withSpecs(
    {
      'evals-baseline-1.0.md': specFile({ version: '1.0', publishDate: '2026-11-12' }),
      'evals-baseline-1.1.md': specFile({ version: '1.1', publishDate: '2026-12-01', extra: 'noindex: true\n' }),
      'evals-baseline-1.2.md': specFile({
        version: '1.2',
        publishDate: '2027-01-01',
        extra: 'draft: true\nnoindex: true\n',
      }),
    },
    async (dir) => assert.deepEqual(await noindexEntryRoutes(dir), ['/spec/evals-baseline/1.1'])
  );
});

test('siteLastmods dates the version pages and the series page of a specification, and no spec hub', async () => {
  await withSpecs(TWO_VERSIONS, async (dir) => {
    assert.deepEqual(await siteLastmods({ dataDir: dir, staticPages: [] }), {
      '/spec/evals-baseline/1.0': '2026-11-14T00:00:00.000Z',
      '/spec/evals-baseline/1.1': '2026-12-02T00:00:00.000Z',
      '/spec/evals-baseline': '2026-12-02T00:00:00.000Z',
    });
  });
});

const PUBLISHED_FILE = 'spec/evals-baseline-1.0.md';

const publishedEntry = { 'evals-baseline-1.0.md': specFile({ version: '1.0', publishDate: '2026-11-12' }) };

const twinText = (extra = '') => specFile({ version: '1.0', publishDate: '2026-11-13', extra });

const TOML_TWIN =
  '+++\ntitle = "twin"\nname = "evals-baseline"\nversion = "1.0"\npublishDate = 2026-11-13\n+++\n\nBody.\n';

const TWINS = {
  plain: { 'twin.md': twinText() },
  CRLF: { 'twin.md': twinText().replace(/\n/g, '\r\n') },
  'leading BOM': { 'twin.md': `\uFEFF${twinText()}` },
  'blank line before the opening fence': { 'twin.md': `\n${twinText()}` },
  'trailing space after the opening fence': { 'twin.md': twinText().replace('---\n', '--- \n') },
  'TOML fence': { 'twin.md': TOML_TWIN },
  '.mdx': { 'twin.mdx': twinText() },
  draft: { 'twin.md': twinText('draft: true\n') },
  noindex: { 'twin.md': twinText('noindex: true\n') },
  'three-way': { 'twin.md': twinText(), 'twin-again.md': twinText() },
};

for (const [label, twins] of Object.entries(TWINS)) {
  test(`seriesLastmods refuses a ${label} twin of a published specification, naming the address and every holder`, async () => {
    await withSpecs({ ...publishedEntry, ...twins }, (dir) =>
      assert.rejects(seriesLastmods(dir), (error) => {
        const message = error.message;
        assert.match(message, /evals-baseline\/1\.0/);
        for (const file of [PUBLISHED_FILE, ...Object.keys(twins).map((name) => `spec/${name}`)]) {
          assert.ok(message.includes(file), `${file} is not named in: ${message}`);
        }
        return true;
      })
    );
  });
}

const refusesByFile = (file) => (error) => {
  assert.ok(error instanceof Error && !(error instanceof TypeError), `refused by a ${error.constructor.name}`);
  assert.ok(error.message.includes(file), `${file} is not named in: ${error.message}`);
  return true;
};

const UNADDRESSABLE = {
  'a comment-only frontmatter block': '---\n# note\n---\n\nBody.\n',
  'no frontmatter': 'Body only.\n',
  'a YAML syntax error': '---\ntitle: [unclosed\n---\n\nBody.\n',
  'a TOML syntax error': '+++\ntitle =\n+++\n\nBody.\n',
  'an unquoted numeric version': '---\nname: evals-baseline\nversion: 1.0\npublishDate: 2026-11-12\n---\n\nBody.\n',
  'a name that is not text': '---\nname: 7\nversion: "1.0"\npublishDate: 2026-11-12\n---\n\nBody.\n',
  'an empty name': '---\nname: ""\nversion: "1.0"\npublishDate: 2026-11-12\n---\n\nBody.\n',
  'no version': '---\nname: evals-baseline\npublishDate: 2026-11-12\n---\n\nBody.\n',
};

for (const [label, text] of Object.entries(UNADDRESSABLE)) {
  test(`seriesLastmods refuses a specification with ${label} by file name, never by a loader error`, async () => {
    await withSpecs({ ...publishedEntry, 'broken.md': text }, (dir) =>
      assert.rejects(seriesLastmods(dir), refusesByFile('spec/broken.md'))
    );
  });
}

test('seriesLastmods still builds a series from two versions of one name, and one from two names at one version', async () => {
  await withSpecs(TWO_VERSIONS, async (dir) => {
    assert.deepEqual(Object.keys(await seriesLastmods(dir)), ['/spec/evals-baseline']);
  });
  await withSpecs(
    {
      ...publishedEntry,
      'other-1.0.md': specFile({ name: 'other', version: '1.0', publishDate: '2026-10-01' }),
    },
    async (dir) => {
      assert.deepEqual(Object.keys(await seriesLastmods(dir)).sort(), ['/spec/evals-baseline', '/spec/other']);
    }
  );
});

test('an entry with no frontmatter names no route, no taxonomy and no noindex page in any other collection', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sitemap-lastmod-bare-'));
  try {
    await mkdir(join(dir, 'post'));
    await writeFile(join(dir, 'post', 'bare.md'), 'Body only.\n');
    await writeFile(join(dir, 'post', 'comment.md'), '---\n# note\n---\n\nBody.\n');
    assert.deepEqual(await collectionLastmods(dir), {});
    assert.deepEqual(await hubLastmods(dir), {});
    assert.deepEqual(await taxonomyLastmods(dir), {});
    assert.deepEqual(await noindexEntryRoutes(dir), []);
    assert.deepEqual(await noindexCategoryRoutes(dir, ['governance']), ['/blog/category/governance']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
