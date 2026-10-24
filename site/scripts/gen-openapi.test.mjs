import assert from 'node:assert/strict';
import fsPromises, { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';

import { KINDS, buildShardEntry, shardHref } from '../public/search/shards.mjs';
import { buildFeedItems } from '../src/utils/machine-text.mjs';
import { main, publicJsonRoutes, renderOpenApi } from './gen-openapi.mjs';

const ORIGIN = 'https://example.test';
const BRAND = { name: 'example.test' };
const ROUTES = ['/feed.json', '/search-index-faq.json', '/search-index-post.json'];
const SHARD_REF = { $ref: '#/components/schemas/SearchIndexShard' };

const JSON_FEED = JSON.stringify({ version: 'https://jsonfeed.org/version/1.1', title: 'Example', items: [] });

const SHIPPED = { 'feed.json': JSON_FEED, 'search-index-faq.json': '[]', 'search-index-post.json': '[]' };
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
  const { paths } = documentFor(['/feed.json', '/search-index-faq.json', '/data/extra.json']);

  assert.deepEqual(Object.fromEntries(Object.entries(paths).map(([path, item]) => [path, item.get.operationId])), {
    '/data/extra.json': 'getDataExtraJson',
    '/feed.json': 'getFeedJson',
    '/search-index-faq.json': 'getSearchIndexFaqJson',
  });
});

test('two routes deriving the same operationId fail the render instead of producing an invalid document', () => {
  assert.throws(() => documentFor(['/a-b.json', '/a/b.json']), /operationId getABJson/);
});

test('the feed is declared as JSON Feed and also as the plain JSON a static host sends, every other route as JSON', () => {
  const document = documentFor();

  assert.deepEqual(Object.keys(contentOf(document, '/feed.json')), ['application/feed+json', 'application/json']);
  assert.deepEqual(Object.keys(contentOf(document, '/search-index-faq.json')), ['application/json']);
});

test('a JSON file with no description of its own is listed as plain JSON and no schema is invented for it', () => {
  const document = documentFor(['/data/extra.json']);

  assert.deepEqual(contentOf(document, '/data/extra.json'), { 'application/json': {} });
  assert.equal(document.components, undefined);
});

test('every search shard the build makes is described with the shard schema, never the plain fallback', () => {
  const routes = Object.keys(KINDS).map(shardHref);
  const document = documentFor(routes);

  for (const route of routes)
    assert.deepEqual(contentOf(document, route), { 'application/json': { schema: SHARD_REF } });
});

test('every $ref resolves and a schema that nothing refers to is not declared', () => {
  for (const routes of [ROUTES, ['/feed.json'], ['/search-index-faq.json'], ['/data/extra.json']]) {
    const document = documentFor(routes);
    const referenced = [...JSON.stringify(document.paths).matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g)];

    assert.deepEqual(
      [...new Set(referenced.map(([, name]) => name))].sort(),
      Object.keys(document.components?.schemas ?? {}).sort(),
      routes.join(' ')
    );
  }
});

test('the shard schema names exactly the fields a built search entry carries', () => {
  const entryFields = Object.keys(buildShardEntry('faq', { href: '/faq/x', title: 'T', description: 'D' })).sort();
  const entry = documentFor(['/search-index-faq.json']).components.schemas.SearchIndexShard.items;

  assert.deepEqual(Object.keys(entry.properties).sort(), entryFields);
  assert.deepEqual([...entry.required].sort(), entryFields);
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
  documentFor().components.schemas.SearchIndexShard.items.required.push('invented');

  assert.ok(!documentFor().components.schemas.SearchIndexShard.items.required.includes('invented'));
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

test('main refuses to publish a document with no paths and writes nothing', async (t) => {
  t.mock.method(console, 'log', () => {});
  const dist = await distWith({ 'index.html': '<!doctype html>' });

  await assert.rejects(main(dist, BRAND), /no public JSON route/);
  await assert.rejects(readFile(join(dist, 'openapi.json')), { code: 'ENOENT' });
});
