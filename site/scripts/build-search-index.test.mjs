import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createSearch } from '../public/search/index-model.mjs';
import { writeSearchIndex } from './build-search-index.mjs';

const SCRIPT = fileURLToPath(new URL('./build-search-index.mjs', import.meta.url));
const ENTRIES_FILE = 'search-entries.json';
const SITE_CONFIG = 'site:\n  name: example.test\n';

const entry = (href, title, description, text, kind) => ({ href, title, description, kind, text });

const SECURITY_DESCRIPTION = 'How this site is built and served.';

const SECURITY_PAGE = `<!doctype html><html><head>
<title>Security</title>
<meta name="description" content="${SECURITY_DESCRIPTION}">
</head><body>
<header><nav><a href="/">Home</a></nav></header>
<main><h1>Security</h1><p>Full-disk encryption on the machine I work from.</p></main>
<footer><p>Book a call today with the team</p></footer>
</body></html>`;

const HAND_WRITTEN = [
  entry('/blog/rollbacks', 'Rollback rehearsals', 'A pilot needs a plan', 'We watched the rehearsal.', 'Writing'),
  entry('/glossary/prompt-injection', 'Prompt injection', 'Text that steers a model', 'Hidden orders.', 'Glossary'),
  entry('/security', 'Security', SECURITY_DESCRIPTION, '', 'Page'),
];

const bulk = (count) =>
  Array.from({ length: count }, (_, index) => {
    const href = `/blog/post-${String(index).padStart(3, '0')}`;
    const text = Array.from({ length: 60 }, (_, word) => `term${index}n${word}`).join(' ');
    return entry(href, `Post ${index}`, `About post ${index}`, text, 'Writing');
  });

const CORPUS = [...HAND_WRITTEN, ...bulk(40)];

async function withDist({ entries, routes = {} }, run) {
  const root = mkdtempSync(join(tmpdir(), 'build-search-index-'));
  const dist = join(root, 'dist');
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'config.yaml'), SITE_CONFIG);
  mkdirSync(dist);
  if (entries) writeFileSync(join(dist, ENTRIES_FILE), JSON.stringify(entries));
  for (const [route, html] of Object.entries(routes)) writeFileSync(join(dist, `${route}.html`), html);

  try {
    return await run({ root, dist });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const manifestOf = (dist) => JSON.parse(readFileSync(join(dist, 'search-index', 'manifest.json'), 'utf8'));

const indexFiles = (dist) =>
  readdirSync(join(dist, 'search-index'), { recursive: true })
    .filter((name) => name.endsWith('.json'))
    .map((name) => `search-index/${name}`)
    .sort();

const pathsNamedBy = ({ version, lastKeys, documents, pageSize }) => {
  const root = `search-index/${version}`;
  const chunks = lastKeys.map((_, chunk) => `${root}/t/${chunk}.json`);
  const pages = Array.from({ length: Math.ceil(documents / pageSize) }, (_, page) => `${root}/d/${page}.json`);
  return ['search-index/manifest.json', ...chunks, ...pages].sort();
};

const cli = (root, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: 'utf8' });

test('the manifest, every term chunk and every document page land at the paths the manifest names, and no other file does', async () => {
  await withDist({ entries: CORPUS, routes: { security: SECURITY_PAGE } }, async ({ dist }) => {
    const result = await writeSearchIndex(dist);
    const manifest = manifestOf(dist);

    assert.ok(manifest.lastKeys.length > 1, 'the corpus must span several term chunks');
    assert.ok(manifest.documents > manifest.pageSize, 'the corpus must span several document pages');
    assert.deepEqual(indexFiles(dist), pathsNamedBy(manifest));
    assert.deepEqual(result, {
      documents: CORPUS.length,
      files: pathsNamedBy(manifest).length,
      version: manifest.version,
    });
  });
});

test('the manifest version is a ten-character hash and the name of the one folder that holds the chunks and pages', async () => {
  await withDist({ entries: CORPUS, routes: { security: SECURITY_PAGE } }, async ({ dist }) => {
    const { version } = await writeSearchIndex(dist);

    assert.match(version, /^[0-9a-f]{10}$/);
    assert.equal(manifestOf(dist).version, version);
    assert.deepEqual(readdirSync(join(dist, 'search-index')).sort(), ['manifest.json', version].sort());
    assert.deepEqual(readdirSync(join(dist, 'search-index', version)).sort(), ['d', 't']);
  });
});

test('search-entries.json is removed once the index is written, and the only other change to dist is the search-index folder', async () => {
  await withDist({ entries: HAND_WRITTEN, routes: { security: SECURITY_PAGE } }, async ({ dist }) => {
    assert.deepEqual(readdirSync(dist).sort(), [ENTRIES_FILE, 'security.html']);

    await writeSearchIndex(dist);

    assert.deepEqual(readdirSync(dist).sort(), ['search-index', 'security.html']);
  });
});

test('a dist with no search-entries.json fails naming the file and astro build, and writes nothing', async () => {
  await withDist({}, async ({ dist }) => {
    await assert.rejects(() => writeSearchIndex(dist), /search-entries\.json.*astro build/);

    assert.deepEqual(readdirSync(dist), []);
  });
});

test('a page entry with empty text and no built page fails loudly, writes nothing and keeps the entries for the next run', async () => {
  const entries = [...HAND_WRITTEN, entry('/ghost', 'Ghost', 'Never built.', '', 'Page')];

  await withDist({ entries, routes: { security: SECURITY_PAGE } }, async ({ dist }) => {
    await assert.rejects(() => writeSearchIndex(dist), /no built page for search entry "\/ghost"/);

    assert.deepEqual(readdirSync(dist).sort(), [ENTRIES_FILE, 'security.html']);
  });
});

test('the written index answers a query through the runtime reading the files back from disk, finding a word only the built page carries', async () => {
  await withDist({ entries: CORPUS, routes: { security: SECURITY_PAGE } }, async ({ dist }) => {
    await writeSearchIndex(dist);
    const search = createSearch(async (path) => JSON.parse(await readFile(join(dist, path.slice(1)), 'utf8')));
    const injection = await search('prompt injection');
    const late = await search('term39n59');

    assert.deepEqual(await search('encryption'), {
      kinds: ['Page'],
      rows: [{ href: '/security', title: 'Security', description: SECURITY_DESCRIPTION, kind: 'Page' }],
    });
    assert.deepEqual(injection.kinds, ['Glossary']);
    assert.deepEqual(
      injection.rows.map(({ href }) => href),
      ['/glossary/prompt-injection']
    );
    assert.deepEqual(
      late.rows.map(({ href }) => href),
      ['/blog/post-039']
    );
    assert.deepEqual(await search('kubernetes'), { kinds: [], rows: [] });
  });
});

test('the CLI prints one line with the documents and files it wrote and the version of the index', async () => {
  await withDist({ entries: CORPUS, routes: { security: SECURITY_PAGE } }, ({ root, dist }) => {
    const { status, stdout, stderr } = cli(root, dist);
    const { version } = manifestOf(dist);
    const files = indexFiles(dist).length;

    assert.equal(status, 0, stderr);
    assert.equal(stdout, `search-index: ${CORPUS.length} documents, ${files} files, version ${version}\n`);
  });
});

test('the CLI works on the dist folder of the working directory when it is given no folder', async () => {
  await withDist({ entries: HAND_WRITTEN, routes: { security: SECURITY_PAGE } }, ({ root, dist }) => {
    const { status, stderr } = cli(root);

    assert.equal(status, 0, stderr);
    assert.ok(existsSync(join(dist, 'search-index', 'manifest.json')));
    assert.equal(existsSync(join(dist, ENTRIES_FILE)), false);
  });
});

test('the CLI exits non-zero and names the missing file and astro build on stderr', async () => {
  await withDist({}, ({ root, dist }) => {
    const { status, stderr } = cli(root, dist);

    assert.notEqual(status, 0);
    assert.match(stderr, /search-entries\.json/);
    assert.match(stderr, /astro build/);
  });
});
