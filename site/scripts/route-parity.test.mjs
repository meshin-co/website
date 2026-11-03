import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CONDITIONAL, OWED, SURFACE_IDS, parityLines, routeParity } from './route-parity.mjs';
import { SITE, buildWorld, pngHead, urlOf } from './fixtures/parity-world.mjs';

const dropLine = (text, needle) =>
  text
    .split('\n')
    .filter((line) => !line.includes(needle))
    .join('\n');

const dropBlock = (text, route) =>
  text
    .split('\n\n---\n\n')
    .filter((block) => !block.includes(urlOf(route)))
    .join('\n\n---\n\n');

const dropItem = (xml, route) => xml.replace(new RegExp('<item><link>' + urlOf(route) + '</link>.*?</item>'), '');

const dropShardEntry = (text, route) => JSON.stringify(JSON.parse(text).filter(({ href }) => href !== route));

const dropSitemap = (world, route) => world.sitemapLastmods.delete(route);

const dropHeadTag = (world, route, pattern) => {
  world.htmlByRoute[route] = world.htmlByRoute[route].replace(pattern, '');
};

const findingsOf = (world) => routeParity(world).findings;

const MUTATIONS = [
  ['sitemap', '/blog/first', 'a sitemap entry with a lastmod', (world) => dropSitemap(world, '/blog/first')],
  ['sitemap', '/about', 'a sitemap entry with a lastmod', (world) => dropSitemap(world, '/about')],
  ['sitemap', '/blog/tag/ai', 'a sitemap entry with a lastmod', (world) => dropSitemap(world, '/blog/tag/ai')],
  [
    'sitemap',
    '/blog/first',
    'a sitemap entry with a lastmod',
    (world) => world.sitemapLastmods.set('/blog/first', null),
  ],
  [
    'sidecar',
    '/blog/first',
    'a markdown sidecar',
    (world) => (world.shipped = world.shipped.filter((file) => file !== 'blog/first.md')),
  ],
  [
    'sidecar',
    '/',
    'a markdown sidecar',
    (world) => (world.shipped = world.shipped.filter((file) => file !== 'index.md')),
  ],
  [
    'sidecar',
    '/blog/tags',
    'a markdown sidecar',
    (world) => (world.shipped = world.shipped.filter((file) => file !== 'blog/tags.md')),
  ],
  [
    'sidecar-link',
    '/blog/first',
    'a markdown alternate link',
    (world) => dropHeadTag(world, '/blog/first', /<link[^>]*text\/markdown[^>]*>/),
  ],
  [
    'sidecar-link',
    '/glossary',
    'a markdown alternate link',
    (world) => dropHeadTag(world, '/glossary', /<link[^>]*text\/markdown[^>]*>/),
  ],
  [
    'llms-index',
    '/blog/tags',
    'a line in llms.txt',
    (world) => (world.texts['llms.txt'] = dropLine(world.texts['llms.txt'], '/blog/tags')),
  ],
  [
    'llms-index',
    '/about',
    'a line in llms.txt',
    (world) => (world.texts['llms.txt'] = dropLine(world.texts['llms.txt'], '/about')),
  ],
  [
    'llms-collection',
    '/blog/first',
    'a place in its llms collection file',
    (world) => (world.texts['llms/post.txt'] = dropBlock(world.texts['llms/post.txt'], '/blog/first')),
  ],
  [
    'llms-full',
    '/glossary/evals',
    'full text in llms-full.txt',
    (world) => (world.texts['llms-full.txt'] = dropBlock(world.texts['llms-full.txt'], '/glossary/evals')),
  ],
  [
    'collection-feed',
    '/blog/second',
    'an item in its collection feed',
    (world) => (world.texts['blog/rss.xml'] = dropItem(world.texts['blog/rss.xml'], '/blog/second')),
  ],
  [
    'feed-link',
    '/blog/first',
    'a link to its collection feed',
    (world) => dropHeadTag(world, '/blog/first', /<link[^>]*application\/rss\+xml[^>]*>/),
  ],
  [
    'feed-link',
    '/blog',
    'a link to its collection feed',
    (world) => dropHeadTag(world, '/blog', /<link[^>]*application\/rss\+xml[^>]*>/),
  ],
  [
    'merged-feed',
    '/blog/first',
    'a place in the merged feed',
    (world) => (world.texts['rss.xml'] = dropItem(world.texts['rss.xml'], '/blog/first')),
  ],
  [
    'search-shard',
    '/blog/first',
    'a search entry',
    (world) =>
      (world.texts['search-index-post.json'] = dropShardEntry(world.texts['search-index-post.json'], '/blog/first')),
  ],
  [
    'search-shard',
    '/about',
    'a search entry',
    (world) =>
      (world.texts['search-index-page.json'] = dropShardEntry(world.texts['search-index-page.json'], '/about')),
  ],
  [
    'search-shard',
    '/blog/category/governance',
    'a search entry',
    (world) =>
      (world.texts['search-index-page.json'] = dropShardEntry(
        world.texts['search-index-page.json'],
        '/blog/category/governance'
      )),
  ],
  [
    'og-image',
    '/blog/first',
    'a social card',
    (world) => (world.shipped = world.shipped.filter((file) => file !== 'og/post/first.png')),
  ],
  [
    'og-image',
    '/about',
    'a social card',
    (world) => (world.htmlByRoute['/about'] = world.htmlByRoute['/about'].replace('abc', 'zzz')),
  ],
  ['og-image', '/blog', 'a social card', (world) => dropHeadTag(world, '/blog', /<meta[^>]*og:image[^>]*>/)],
];

test('the baseline world is at parity: every owed cell is present', () => {
  const { findings, ledger } = routeParity(buildWorld());

  assert.deepEqual(findings, []);
  assert.ok(ledger.cells.owed > 0);
  assert.equal(ledger.cells.owed, ledger.cells.present);
});

for (const [surface, route, label, mutate] of MUTATIONS) {
  test(
    'removing ' + surface + ' from ' + route + ' fails the gate naming the route and the surface (' + label + ')',
    () => {
      const world = buildWorld();
      mutate(world);
      const findings = findingsOf(world);

      assert.equal(findings.length, 1, JSON.stringify(findings));
      assert.equal(findings[0].rule, 'route-surface-missing');
      assert.ok(findings[0].text.startsWith(route + ' is owed ' + label), findings[0].text);
      assert.equal(findings[0].subjects[0], route);
    }
  );
}

test('every surface in the owed table is one the checker knows, and the table names no other', () => {
  const named = new Set([...Object.values(OWED).flat(), ...Object.keys(CONDITIONAL)]);

  for (const surface of named) assert.ok(SURFACE_IDS.includes(surface), surface);
  for (const surface of SURFACE_IDS) assert.ok(named.has(surface), surface + ' is owed to no kind');
});

test('each kind is owed what the generators emit for it, and the withheld kinds are owed nothing', () => {
  assert.deepEqual(OWED.exception, []);
  assert.deepEqual(OWED.withheld, []);
  assert.deepEqual(OWED.pagination, []);
  assert.deepEqual(OWED.archive, ['sitemap', 'search-shard', 'og-image']);
  assert.ok(OWED.entry.includes('collection-feed') && OWED.entry.includes('llms-full'));
  assert.ok(!OWED.page.includes('sidecar-link'));
  assert.ok(OWED.hub.includes('feed-link') && OWED.hub.includes('sidecar-link'));
});

test('an entry is owed an llms.txt line only when its collection is listed inline', () => {
  const pointer = buildWorld();
  const inline = buildWorld({ inlineKinds: ['post'] });
  inline.texts['llms.txt'] = dropLine(inline.texts['llms.txt'], '/blog/first');

  assert.deepEqual(findingsOf(pointer), []);
  const findings = findingsOf(inline);
  assert.equal(findings.length, 1);
  assert.ok(findings[0].text.startsWith('/blog/first is owed a line in llms.txt'), findings[0].text);
});

test('only the newest entry of a collection is owed a place in the merged feed', () => {
  const world = buildWorld();
  world.texts['rss.xml'] = dropItem(world.texts['rss.xml'], '/blog/second');

  assert.deepEqual(findingsOf(world), []);
});

test('a card that is not a 1200 by 630 PNG is a finding', () => {
  const small = buildWorld();
  small.imageHeads['og/post/first.png'] = pngHead(600, 315);
  const corrupt = buildWorld();
  corrupt.imageHeads['og/post/first.png'] = new Uint8Array(24);
  const unread = buildWorld();
  delete unread.imageHeads['og/post/first.png'];

  for (const world of [small, corrupt, unread]) {
    const findings = findingsOf(world);
    assert.equal(findings.length, 1, JSON.stringify(findings));
    assert.ok(findings[0].text.startsWith('/blog/first is owed a social card'), findings[0].text);
  }
});

test('an og:image that points off the site cannot be verified and is a finding', () => {
  const world = buildWorld();
  world.htmlByRoute['/about'] = world.htmlByRoute['/about'].replace(SITE + '/_astro', 'https://cdn.example/_astro');
  const findings = findingsOf(world);

  assert.equal(findings.length, 1);
  assert.ok(findings[0].text.startsWith('/about is owed a social card'), findings[0].text);
});

test('a new collection and its entries are owed everything the day they exist, with no list to edit', () => {
  const world = buildWorld();
  world.collections = [...world.collections, { kind: 'talk', base: 'talks' }];
  world.routes = [...world.routes, '/talks/keynote'];
  world.htmlByRoute['/talks/keynote'] = '<html><head></head></html>';
  const missing = findingsOf(world).filter(({ rule }) => rule === 'route-surface-missing');
  const surfaces = missing.map(({ text }) => text.slice('/talks/keynote is owed '.length).split(':')[0]);

  assert.ok(missing.every(({ subjects }) => subjects[0] === '/talks/keynote'));
  assert.equal(missing.length, OWED.entry.length);
  assert.ok(surfaces.includes('a markdown sidecar'));
  assert.ok(surfaces.includes('a search entry'));
});

test('a build with no route to examine says so instead of passing', () => {
  const world = buildWorld();
  world.routes = [];
  world.htmlByRoute = {};
  const findings = findingsOf(world);

  assert.ok(findings.some(({ rule }) => rule === 'examined-nothing'));
  assert.match(findings.find(({ rule }) => rule === 'examined-nothing').text, /^route parity examined nothing/);
});

test('the ledger counts every kind, owed cell and declaration, so the summary is read from the run', () => {
  const { ledger } = routeParity(buildWorld());

  assert.equal(ledger.routes, 13);
  assert.deepEqual(ledger.kinds, {
    entry: 3,
    hub: 2,
    page: 2,
    'tag-index': 1,
    archive: 2,
    pagination: 0,
    exception: 2,
    withheld: 1,
  });
  assert.deepEqual(
    ledger.exceptions.map(({ route }) => route),
    ['/404', '/search']
  );
  assert.deepEqual(
    ledger.emptyCollections.map(({ collection }) => collection),
    ['case']
  );
  assert.equal(ledger.surfaces.sitemap.owed, 10);
  assert.equal(ledger.surfaces.sitemap.present, 10);
});

test('the summary lines name the declared exceptions and empty collections with their count', () => {
  const lines = parityLines(routeParity(buildWorld()).ledger);

  assert.equal(lines.length, 2);
  assert.match(lines[0], /^machine: route parity derived 13 routes \(3 entry, 2 hub, 2 page,/);
  assert.match(lines[0], /checked \d+ owed cells across 11 surfaces, \d+ present/);
  assert.equal(lines[1], 'machine: route parity declares 2 exceptions (/404, /search) and 1 empty collection (case)');
});
