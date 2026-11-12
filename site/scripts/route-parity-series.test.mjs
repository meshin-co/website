import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { KINDS } from '../public/search/shards.mjs';
import { readIndexDocuments } from '../src/utils/search-index.mjs';
import { buildWorld, replaceIndex } from './fixtures/parity-world.mjs';
import { deriveRouteKinds } from './route-kinds.mjs';
import { readWorld } from './route-parity-gate.mjs';
import { OWED, SURFACES, SURFACE_IDS, owedFor, parityLines, routeParity } from './route-parity.mjs';

const SERIES_PAGE = '/spec/evals-baseline';
const VERSION_PAGE = '/spec/evals-baseline/1.0';
const SERIES_SIDECAR = 'spec/evals-baseline.md';
const SERIES_CARD = 'og/spec/evals-baseline.png';
const NOINDEX = '<meta content="noindex, follow" name="robots">';
const MARKDOWN_LINK = /<link[^>]*text\/markdown[^>]*>/;

const seriesWorld = () => buildWorld({ entries: { spec: ['evals-baseline/1.0'] } });
const textsOf = (world) => routeParity(world).findings.map(({ text }) => text);
const owedText = (surface, absence) => `${SERIES_PAGE} is owed ${SURFACES[surface].label}: ${absence}`;

const searchDocumentsOf = (texts) => readIndexDocuments((urlPath) => texts[urlPath.slice(1)]);

const relabelSearchEntry = ({ texts }, route, kind) =>
  replaceIndex(
    texts,
    searchDocumentsOf(texts).map((document) => (document.href === route ? { ...document, kind } : document))
  );

function dropShipped(world, file) {
  assert.ok(world.shipped.includes(file), `${file} is part of the clean world`);
  world.shipped = world.shipped.filter((name) => name !== file);
}

function dropHeadTag(world, route, pattern) {
  assert.match(world.htmlByRoute[route], pattern);
  world.htmlByRoute[route] = world.htmlByRoute[route].replace(pattern, '');
}

const owedBy = (world) =>
  Object.fromEntries(Object.entries(routeParity(world).ledger.surfaces).map(([surface, { owed }]) => [surface, owed]));

test('a series page is owed a sitemap entry, a sidecar and its link, a search entry and a social card, and nothing else', () => {
  assert.deepEqual(OWED.series, ['sitemap', 'sidecar', 'sidecar-link', 'search-shard', 'og-image']);
});

test('a series collection with one version is a clean world: its series page a series, its version page an entry', () => {
  const world = seriesWorld();
  const derived = deriveRouteKinds(world);

  assert.deepEqual(routeParity(world).findings, []);
  assert.deepEqual(
    [SERIES_PAGE, VERSION_PAGE].map((route) => [derived.routes.get(route).kind, derived.routes.get(route).collection]),
    [
      ['series', 'spec'],
      ['entry', 'spec'],
    ]
  );
});

test('a series collection adds the series page to the cells of five surfaces and the version page to those of nine', () => {
  const before = owedBy(buildWorld());
  const after = owedBy(seriesWorld());
  const added = Object.fromEntries(SURFACE_IDS.map((surface) => [surface, after[surface] - before[surface]]));

  assert.deepEqual(added, {
    sitemap: 2,
    sidecar: 2,
    'llms-index': 0,
    'llms-collection': 1,
    'collection-feed': 1,
    'feed-link': 1,
    'merged-feed': 1,
    'sidecar-link': 2,
    'search-shard': 2,
    'og-image': 2,
  });
});

const FAULTS = {
  sitemap: {
    plant: (world) => assert.ok(world.sitemapLastmods.delete(SERIES_PAGE)),
    absence: '/sitemap-0.xml does not list it',
  },
  sidecar: {
    plant: (world) => dropShipped(world, SERIES_SIDECAR),
    absence: '/spec/evals-baseline.md did not ship',
  },
  'sidecar-link': {
    plant: (world) => dropHeadTag(world, SERIES_PAGE, MARKDOWN_LINK),
    absence: 'its head has no <link rel="alternate" type="text/markdown" href="/spec/evals-baseline.md">',
  },
  'search-shard': {
    plant: (world) => relabelSearchEntry(world, SERIES_PAGE, KINDS.page.label),
    absence: '/search-index/manifest.json holds no entry for it',
  },
  'og-image': {
    plant: (world) => dropShipped(world, SERIES_CARD),
    absence: 'its og:image /og/spec/evals-baseline.png is not a file this build ships',
  },
};

test('every surface a series page is owed has a planted fault here, so none is left unchecked', () => {
  assert.deepEqual(Object.keys(FAULTS).sort(), [...OWED.series].sort());
});

for (const [surface, { plant, absence }] of Object.entries(FAULTS)) {
  test(`a series page without its ${surface} is one finding that names the page and the surface`, () => {
    const world = seriesWorld();
    plant(world);

    assert.deepEqual(textsOf(world), [owedText(surface, absence)]);
  });
}

test('a series page is never owed a collection surface, whatever its collection lists inline or feeds first', () => {
  const info = { route: SERIES_PAGE, kind: 'series', collection: 'spec', base: 'spec', id: 'evals-baseline' };
  const context = {
    inlineKinds: new Set(['spec']),
    feedHeads: new Map([['spec', SERIES_PAGE]]),
    beyondFeedWindow: new Set([SERIES_PAGE]),
  };

  assert.deepEqual(owedFor(info, context), OWED.series);
});

test('the parity summary counts the series pages between the entries and the hubs', () => {
  const [derived] = parityLines(routeParity(seriesWorld()).ledger);

  assert.match(derived, /\(\d+ entry, 1 series, \d+ hub, \d+ page, /);
});

test('a series page the build marks noindex is withheld and owed nothing, and is reported once as undeclared', () => {
  const world = seriesWorld();
  world.htmlByRoute[SERIES_PAGE] = world.htmlByRoute[SERIES_PAGE].replace('</head>', `${NOINDEX}</head>`);
  world.sitemapLastmods.delete(SERIES_PAGE);
  const { findings, ledger } = routeParity(world);

  assert.deepEqual(
    findings.map(({ rule, subjects }) => [rule, subjects]),
    [['route-noindex-undeclared', [SERIES_PAGE]]]
  );
  assert.equal(ledger.kinds.series, 0);
});

const frontmatter = (lines) => ['---', ...lines, '---', '', 'Body.', ''].join('\n');

async function inSite(files, use) {
  const root = mkdtempSync(join(tmpdir(), 'route-parity-series-'));
  const home = process.cwd();
  try {
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, name)), { recursive: true });
      writeFileSync(join(root, name), text);
    }
    process.chdir(root);
    return await use(join(root, 'dist'));
  } finally {
    process.chdir(home);
    rmSync(root, { recursive: true, force: true });
  }
}

test('the world read from a build takes its collections from the feed bases and names a noindex version by its address', async () => {
  const world = await inSite(
    {
      'src/config.yaml': 'site:\n  name: example.test\n',
      'src/content.config.ts': 'export const collections = {\n  post: postCollection,\n  spec: specCollection,\n};\n',
      'src/data/post/first.md': frontmatter(['title: First', 'noindex: true']),
      'src/data/post/second.md': frontmatter(['title: Second']),
      'src/data/spec/evals-baseline-1.0.md': frontmatter(['name: evals-baseline', "version: '1.0'"]),
      'src/data/spec/evals-baseline-1.1.md': frontmatter(['name: evals-baseline', "version: '1.1'", 'noindex: true']),
      'dist/index.html': '<!doctype html><html><head></head></html>',
      'dist/sitemap-0.xml': '<urlset></urlset>',
    },
    readWorld
  );

  assert.deepEqual(world.collections, [
    { kind: 'post', base: 'blog' },
    { kind: 'spec', base: 'spec' },
  ]);
  assert.deepEqual([...world.declared.noindexRoutes].sort(), ['/blog/first', '/spec/evals-baseline/1.1']);
});
