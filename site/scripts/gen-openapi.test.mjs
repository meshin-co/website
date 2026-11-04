import assert from 'node:assert/strict';
import fsPromises, { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';

import { buildFeedItems } from '../src/utils/machine-text.mjs';
import { buildSearchIndex, chunkPath, pagePath } from '../src/utils/search-index.mjs';
import { main, publicJsonRoutes, renderOpenApi } from './gen-openapi.mjs';

const ORIGIN = 'https://example.test';
const BRAND = { name: 'example.test' };
const MANIFEST_ROUTE = '/search-index/manifest.json';
const ROUTES = ['/feed.json', MANIFEST_ROUTE];
const MANIFEST_REF = { $ref: '#/components/schemas/SearchIndexManifest' };

const JSON_FEED = JSON.stringify({ version: 'https://jsonfeed.org/version/1.1', title: 'Example', items: [] });

const BUILT_INDEX = buildSearchIndex([
  {
    href: '/blog/evals',
    title: 'Evals',
    description: 'How to measure a model.',
    kind: 'Writing',
    text: 'measure a model with evals',
  },
  {
    href: '/faq/pricing',
    title: 'Pricing',
    description: 'What a sprint costs.',
    kind: 'FAQ',
    text: 'a sprint has a fixed price',
  },
]);
const { version: VERSION } = BUILT_INDEX.manifest;

const SHIPPED = { 'feed.json': JSON_FEED, 'search-index/manifest.json': JSON.stringify(BUILT_INDEX.manifest) };
const NOT_INTERFACES = {
  'gate-routes.json': '{"routes":["/"]}',
  '_astro/manifest.json': '{}',
  'blog/first/index.html': '<!doctype html><title>First</title>',
};

const roots = [];

after(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

async function distWith(files) {
  const root = await mkdtemp(join(tmpdir(), 'gen-openapi-'));
  roots.push(root);
  for (const [name, source] of Object.entries(files)) {
    await mkdir(dirname(join(root, name)), { recursive: true });
    await writeFile(join(root, name), source);
  }
  return root;
}

function indexFiles(count) {
  const files = {};
  for (let at = 0; at < count; at += 1) {
    files[chunkPath(VERSION, at).slice(1)] = '[]';
    files[pagePath(VERSION, at).slice(1)] = '[]';
  }
  return files;
}

const documentFor = (routes = ROUTES) => renderOpenApi({ origin: ORIGIN, routes });
const contentOf = (document, route) => document.paths[route].get.responses['200'].content;

test('discovery lists every shipped JSON file and nothing else, sorted by route', async () => {
  const dist = await distWith({ ...SHIPPED, ...NOT_INTERFACES });

  assert.deepEqual(await publicJsonRoutes(dist), ROUTES);
});

test('gate-routes.json is a harness artifact the gate writes, so it is never described as an interface', async () => {
  const dist = await distWith({ 'feed.json': JSON_FEED, 'gate-routes.json': '{"routes":[]}' });

  assert.deepEqual(await publicJsonRoutes(dist), ['/feed.json']);
});

test('a JSON file under _astro is bundler output, not an interface', async () => {
  const dist = await distWith({ 'feed.json': JSON_FEED, '_astro/chunk.json': '{}', '_astro/deep/map.json': '{}' });

  assert.deepEqual(await publicJsonRoutes(dist), ['/feed.json']);
});

test('the document itself and everything under .well-known are never candidates', async () => {
  const dist = await distWith({
    'feed.json': JSON_FEED,
    'openapi.json': '{"openapi":"3.1.1"}',
    '.well-known/ai-catalog.json': '{}',
    '.well-known/nested/entry.json': '{}',
  });

  assert.deepEqual(await publicJsonRoutes(dist), ['/feed.json']);
});

test('a nested JSON file is a route at its nested path, and a directory named like a JSON file is not a file', async () => {
  const dist = await distWith({ 'data/extra.json': '{}', 'odd.json/index.html': '<!doctype html>' });

  assert.deepEqual(await publicJsonRoutes(dist), ['/data/extra.json']);
});

test('every file under a version directory of the search index is an implementation file, never an interface', async () => {
  const dist = await distWith({ ...SHIPPED, ...indexFiles(3) });

  assert.match(VERSION, /^[0-9a-f]{10}$/);
  assert.deepEqual(await publicJsonRoutes(dist), ROUTES);
});

test('a JSON file the search index keeps outside a version directory is still a candidate, so a stray one is never hidden', async () => {
  const dist = await distWith({
    ...SHIPPED,
    'search-index/stray.json': '{}',
    'search-index/draft/t/0.json': '[]',
  });

  assert.deepEqual(await publicJsonRoutes(dist), [
    '/feed.json',
    '/search-index/draft/t/0.json',
    '/search-index/manifest.json',
    '/search-index/stray.json',
  ]);
});

test('discovery sorts by code unit whatever order the directory listing arrives in, never by locale', async (t) => {
  const dist = await distWith({ 'a.json': '{}', 'B.json': '{}', 'm.json': '{}' });
  const listing = fsPromises.readdir;
  t.mock.method(fsPromises, 'readdir', async (...args) =>
    (await listing(...args)).sort((a, b) => (a.name < b.name ? 1 : -1))
  );
  syncBuiltinESMExports();

  try {
    assert.deepEqual(await publicJsonRoutes(dist), ['/B.json', '/a.json', '/m.json']);
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
});

test('the document declares the OpenAPI version, the site name, a version, the server and every path from a slash', () => {
  const document = documentFor();

  assert.equal(document.openapi, '3.1.1');
  assert.equal(document.info.title, 'example.test');
  assert.match(document.info.version, /^\d+\.\d+\.\d+$/);
  assert.equal(document.servers[0].url, ORIGIN);
  assert.deepEqual(Object.keys(document.paths), ROUTES);
  for (const path of Object.keys(document.paths)) assert.ok(path.startsWith('/'), `${path} must start with a slash`);
});

test('the origin is an input and never a constant', () => {
  const document = renderOpenApi({ origin: 'https://other.example', routes: ROUTES });

  assert.equal(document.servers[0].url, 'https://other.example');
  assert.equal(document.info.title, 'other.example');
});

test('every path carries exactly a get operation with a summary, an operationId and a 200 response', () => {
  for (const [path, item] of Object.entries(documentFor().paths)) {
    assert.deepEqual(Object.keys(item), ['get'], path);
    const { summary, operationId, responses } = item.get;
    assert.ok(typeof summary === 'string' && summary !== '', `${path} needs a summary`);
    assert.match(operationId, /^get[A-Z][A-Za-z0-9]*$/, path);
    assert.deepEqual(Object.keys(responses), ['200'], path);
    assert.ok(responses['200'].description, `${path} needs a response description, which OpenAPI requires`);
    assert.notDeepEqual(Object.keys(responses['200'].content), [], path);
  }
});

test('operation ids derive from the path', () => {
  const { paths } = documentFor(['/feed.json', MANIFEST_ROUTE, '/data/extra.json']);

  assert.deepEqual(Object.fromEntries(Object.entries(paths).map(([path, item]) => [path, item.get.operationId])), {
    '/data/extra.json': 'getDataExtraJson',
    '/feed.json': 'getFeedJson',
    '/search-index/manifest.json': 'getSearchIndexManifestJson',
  });
});

test('two routes deriving the same operationId fail the render instead of producing an invalid document', () => {
  assert.throws(() => documentFor(['/a-b.json', '/a/b.json']), /operationId getABJson/);
});

test('the feed is declared as JSON Feed and also as the plain JSON a static host sends, every other route as JSON', () => {
  const document = documentFor();

  assert.deepEqual(Object.keys(contentOf(document, '/feed.json')), ['application/feed+json', 'application/json']);
  assert.deepEqual(Object.keys(contentOf(document, MANIFEST_ROUTE)), ['application/json']);
});

test('a JSON file with no description of its own is listed as plain JSON and no schema is invented for it', () => {
  const document = documentFor(['/data/extra.json']);

  assert.deepEqual(contentOf(document, '/data/extra.json'), { 'application/json': {} });
  assert.equal(document.components, undefined);
});

test('the search index manifest is described with its own schema, never the plain fallback', () => {
  const document = documentFor([MANIFEST_ROUTE]);

  assert.deepEqual(contentOf(document, MANIFEST_ROUTE), { 'application/json': { schema: MANIFEST_REF } });
});

test('the manifest says it is the entry point of the partitioned search index and where chunks and pages live', () => {
  const { summary, responses } = documentFor([MANIFEST_ROUTE]).paths[MANIFEST_ROUTE].get;
  const { description } = responses['200'];

  assert.equal(summary, 'Search index manifest');
  assert.ok(description.startsWith('Entry point of the partitioned search index.'), description);
  for (const where of ['/search-index/{version}/t/{n}.json', '/search-index/{version}/d/{n}.json']) {
    assert.ok(description.includes(where), `the description never says where ${where} is`);
  }
});

test('every $ref resolves and a schema that nothing refers to is not declared', () => {
  for (const routes of [ROUTES, ['/feed.json'], [MANIFEST_ROUTE], ['/data/extra.json']]) {
    const document = documentFor(routes);
    const referenced = [...JSON.stringify(document.paths).matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g)];

    assert.deepEqual(
      [...new Set(referenced.map(([, name]) => name))].sort(),
      Object.keys(document.components?.schemas ?? {}).sort(),
      routes.join(' ')
    );
  }
});

test('the manifest schema names exactly the fields a built manifest carries, in the types it carries them', () => {
  const { manifest } = BUILT_INDEX;
  const schema = documentFor([MANIFEST_ROUTE]).components.schemas.SearchIndexManifest;
  const holds = { string: (value) => typeof value === 'string', integer: Number.isInteger, array: Array.isArray };

  assert.deepEqual(Object.keys(schema.properties).sort(), Object.keys(manifest).sort());
  assert.deepEqual([...schema.required].sort(), Object.keys(manifest).sort());
  for (const [field, { type }] of Object.entries(schema.properties)) {
    assert.ok(holds[type](manifest[field]), `${field} is declared ${type} and is not`);
  }

  const { lastKeys, kindRuns } = schema.properties;
  assert.deepEqual(lastKeys.items, { type: 'string' });
  assert.ok(manifest.lastKeys.length > 0 && manifest.lastKeys.every((key) => typeof key === 'string'));
  assert.deepEqual(kindRuns.items.prefixItems, [{ type: 'integer' }, { type: 'string' }]);
  assert.deepEqual([kindRuns.items.minItems, kindRuns.items.maxItems], [2, 2]);
  assert.ok(manifest.kindRuns.length > 0);
  for (const [first, kind, ...rest] of manifest.kindRuns) {
    assert.ok(Number.isInteger(first) && typeof kind === 'string' && rest.length === 0, `${first} ${kind}`);
  }
});

test('the feed schema names exactly the fields a built feed item carries', () => {
  const [built] = buildFeedItems([
    {
      url: 'https://example.test/blog/a',
      title: 'A',
      summary: 'S',
      body: 'B',
      publishDate: new Date('2026-01-01T00:00:00Z'),
      updatedDate: new Date('2026-01-02T00:00:00Z'),
      tags: ['t'],
      kind: 'post',
    },
  ]);
  const item = documentFor(['/feed.json']).components.schemas.JsonFeed.properties.items.items;

  assert.deepEqual(Object.keys(item.properties).sort(), Object.keys(built).sort());
  assert.deepEqual([...item.required].sort(), Object.keys(built).sort());
});

test('the document is the same whatever order the routes arrive in, and the list the caller passed is left as it was', () => {
  const expected = JSON.stringify(documentFor(ROUTES));
  const reversed = [...ROUTES].reverse();

  assert.equal(JSON.stringify(documentFor(reversed)), expected);
  assert.deepEqual(reversed, [...ROUTES].reverse());
  assert.equal(JSON.stringify(documentFor([...ROUTES, ...ROUTES])), expected);
});

test('paths sort by code unit, so the document never depends on the machine locale', () => {
  assert.deepEqual(Object.keys(documentFor(['/a.json', '/B.json']).paths), ['/B.json', '/a.json']);
});

test('the returned document shares no state with the module, so a caller can edit it freely', () => {
  documentFor().components.schemas.SearchIndexManifest.required.push('invented');

  assert.ok(!documentFor().components.schemas.SearchIndexManifest.required.includes('invented'));
});

test('main writes dist/openapi.json, and a second run over the tree that now holds it writes the same bytes', async (t) => {
  t.mock.method(console, 'log', () => {});
  const dist = await distWith({ ...SHIPPED, ...NOT_INTERFACES });

  await main(dist, BRAND);
  const first = await readFile(join(dist, 'openapi.json'), 'utf8');
  await main(dist, BRAND);
  const second = await readFile(join(dist, 'openapi.json'), 'utf8');

  assert.equal(second, first);
  assert.ok(first.endsWith('\n'));
  assert.deepEqual(JSON.parse(first), documentFor());
});

test('two identical trees built in a different file order produce identical bytes', async (t) => {
  t.mock.method(console, 'log', () => {});
  const forward = await distWith({ ...SHIPPED, ...NOT_INTERFACES });
  const backward = await distWith(Object.fromEntries(Object.entries({ ...SHIPPED, ...NOT_INTERFACES }).reverse()));

  await main(forward, BRAND);
  await main(backward, BRAND);

  assert.equal(
    await readFile(join(backward, 'openapi.json'), 'utf8'),
    await readFile(join(forward, 'openapi.json'), 'utf8')
  );
});

test('the document does not grow with the corpus: 500 term chunks and 500 document pages change not one byte', async (t) => {
  t.mock.method(console, 'log', () => {});
  const small = await distWith({ ...SHIPPED, ...indexFiles(1) });
  const large = await distWith({ ...SHIPPED, ...indexFiles(500) });

  await main(small, BRAND);
  await main(large, BRAND);

  const document = await readFile(join(small, 'openapi.json'), 'utf8');
  assert.equal(await readFile(join(large, 'openapi.json'), 'utf8'), document);
  assert.deepEqual(Object.keys(JSON.parse(document).paths), ROUTES);
});

test('main refuses to publish a document with no paths and writes nothing', async (t) => {
  t.mock.method(console, 'log', () => {});
  const dist = await distWith({ 'index.html': '<!doctype html>' });

  await assert.rejects(main(dist, BRAND), /no public JSON route/);
  await assert.rejects(readFile(join(dist, 'openapi.json')), { code: 'ENOENT' });
});
