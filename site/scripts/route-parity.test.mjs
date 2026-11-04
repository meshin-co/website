import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { FEED_WINDOW } from '../src/utils/feeds.mjs';
import { SPECIMENS } from './mutation-specimens.mjs';
import { readWorld } from './route-parity-gate.mjs';
import { CONDITIONAL, OWED, SURFACE_IDS, owedFor, parityLines, routeParity } from './route-parity.mjs';
import { SITE, allEntryRoutes, buildWorld, feedOf, pngHead, urlOf } from './fixtures/parity-world.mjs';

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

const NEWER = '2026-10-02T00:00:00.000Z';
const OLDER = '2026-09-01T00:00:00.000Z';
const GLOSSARY_TERMS = 1;
const FEED_ITEM_OWED = ' is owed an item in its collection feed';

const idOf = (number) => 'post-' + String(number).padStart(2, '0');
const routeOf = (number) => '/blog/' + idOf(number);
const routesOf = (first, last) => Array.from({ length: last - first + 1 }, (_, at) => routeOf(first + at));
const postsWorld = (count) => buildWorld({ entries: { post: Array.from({ length: count }, (_, at) => idOf(at + 1)) } });

async function withFiles(files, use) {
  const root = mkdtempSync(join(tmpdir(), 'route-parity-'));
  try {
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, name)), { recursive: true });
      writeFileSync(join(root, name), text);
    }
    return await use(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const readWorldOf = (files) => withFiles(files, readWorld);

const readLlmsFiles = (root) =>
  Object.fromEntries(
    readdirSync(join(root, 'dist/llms')).map((name) => [
      'llms/' + name,
      readFileSync(join(root, 'dist/llms', name), 'utf8'),
    ])
  );

const llmsFilesOf = (world) =>
  Object.fromEntries(
    Object.entries(world.texts)
      .filter(([file]) => file.startsWith('llms/post'))
      .map(([file, text]) => ['dist/' + file, text])
  );

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
  assert.ok(OWED.entry.includes('collection-feed'));
  assert.ok(!OWED.entry.includes('llms-full') && !SURFACE_IDS.includes('llms-full'));
  assert.ok(!OWED.page.includes('sidecar-link'));
  assert.ok(OWED.hub.includes('feed-link') && OWED.hub.includes('sidecar-link'));
});

test('an entry that appears in no line of llms-full.txt is not a finding, because that file lists collections and no entry', () => {
  const world = buildWorld();
  const pointers = world.texts['llms-full.txt'];

  for (const route of allEntryRoutes()) assert.equal(pointers.includes(urlOf(route)), false, route);
  assert.ok(pointers.includes(urlOf('/llms/post.txt')) && pointers.includes(urlOf('/llms/glossary.txt')));
  assert.deepEqual(findingsOf(world), []);
  delete world.texts['llms-full.txt'];
  assert.deepEqual(findingsOf(world), []);
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

test('an entry listed only in a numbered shard of its collection is present, because the index and every shard are read', () => {
  const world = buildWorld({ shardSize: 1 });
  const holdsSecond = (file) => world.texts[file].includes(urlOf('/blog/second'));

  assert.deepEqual(['llms/post.txt', 'llms/post-1.txt', 'llms/post-2.txt'].map(holdsSecond), [false, false, true]);
  assert.deepEqual(findingsOf(world), []);
});

test('an entry listed in no file of its collection is a finding that names the collection file and its shards', () => {
  const world = buildWorld({ shardSize: 1 });
  world.texts['llms/post-2.txt'] = dropBlock(world.texts['llms/post-2.txt'], '/blog/second');
  const findings = findingsOf(world);

  assert.equal(findings.length, 1, JSON.stringify(findings));
  assert.equal(
    findings[0].text,
    '/blog/second is owed a place in its llms collection file: /llms/post.txt and its shards do not list it'
  );
  assert.deepEqual(findings[0].subjects, ['/blog/second', '/llms/post.txt']);
});

test('the llms shard specimen strips the URL line of its entry from the one file that lists it, wherever that file is', async () => {
  const { plant, token } = SPECIMENS.parityEntryLeavesItsLlmsShards;
  const route = token.split(' ')[0];
  const slug = route.slice('/blog/'.length);
  const layouts = [
    [slug, 'a'],
    [slug, 'a', 'b', 'c', 'd'],
    ['a', 'b', slug, 'c', 'd'],
    ['a', 'b', 'c', 'd', slug],
  ];

  for (const ids of layouts) {
    const world = buildWorld({ entries: { post: ids }, shardSize: 2 });
    await withFiles(llmsFilesOf(world), async (copySite) => {
      const pristine = readLlmsFiles(copySite);
      assert.deepEqual(findingsOf(world), []);

      const restore = await plant(copySite);
      const planted = readLlmsFiles(copySite);
      const changed = Object.keys(planted).filter((file) => planted[file] !== pristine[file]);

      assert.equal(changed.length, 1, JSON.stringify(changed));
      assert.ok(pristine[changed[0]].includes(urlOf(route)), changed[0]);
      assert.equal(planted[changed[0]].includes(urlOf(route)), false, changed[0]);
      assert.deepEqual(
        findingsOf({ ...world, texts: { ...world.texts, ...planted } }).map(({ text }) => text),
        [token]
      );

      await restore();
      assert.deepEqual(readLlmsFiles(copySite), pristine);
    });
  }
});

test('the collection feed specimen removes an item the feed really carries, so it stays inside the window as the collection grows', async () => {
  const { plant, token } = SPECIMENS.parityEntryLeavesItsCollectionFeed;

  for (const count of [3, FEED_WINDOW, FEED_WINDOW * 3]) {
    const world = postsWorld(count);
    await withFiles({ 'dist/blog/rss.xml': world.texts['blog/rss.xml'] }, async (copySite) => {
      await plant(copySite);
      const planted = readFileSync(join(copySite, 'dist/blog/rss.xml'), 'utf8');
      const findings = findingsOf({ ...world, texts: { ...world.texts, 'blog/rss.xml': planted } });

      assert.equal(findings.length, 1, JSON.stringify(findings));
      assert.ok(findings[0].text.endsWith(token), findings[0].text);
    });
  }
});

test('the world read from a build holds the index and every numbered shard of an llms collection', async () => {
  const { texts } = await readWorldOf({
    'index.html': '<!doctype html><html><head></head></html>',
    'sitemap-0.xml': '<urlset></urlset>',
    'llms/post.txt': '# example.test\n',
    'llms/post-1.txt': '# example.test\n',
    'llms/post-12.txt': '# example.test\n',
  });
  const llmsFiles = Object.keys(texts).filter((file) => file.startsWith('llms/'));

  assert.deepEqual(llmsFiles.sort(), ['llms/post-1.txt', 'llms/post-12.txt', 'llms/post.txt']);
});

test('only the newest entry of a collection is owed a place in the merged feed', () => {
  const world = buildWorld();
  world.texts['rss.xml'] = dropItem(world.texts['rss.xml'], '/blog/second');

  assert.deepEqual(findingsOf(world), []);
});

test('an entry inside its collection feed window and absent from the feed is a finding', () => {
  const world = postsWorld(FEED_WINDOW + 1);
  world.texts['blog/rss.xml'] = dropItem(world.texts['blog/rss.xml'], routeOf(FEED_WINDOW));
  const findings = findingsOf(world);

  assert.equal(findings.length, 1, JSON.stringify(findings));
  assert.ok(findings[0].text.startsWith(routeOf(FEED_WINDOW) + FEED_ITEM_OWED), findings[0].text);
});

test('an entry past its collection feed window is owed no feed item, so its absence from the feed is not a finding', () => {
  const world = postsWorld(FEED_WINDOW + 1);
  const { findings, ledger } = routeParity(world);

  assert.equal(world.texts['blog/rss.xml'].includes(urlOf(routeOf(FEED_WINDOW + 1))), false);
  assert.deepEqual(findings, []);
  assert.deepEqual(ledger.surfaces['collection-feed'], {
    owed: FEED_WINDOW + GLOSSARY_TERMS,
    present: FEED_WINDOW + GLOSSARY_TERMS,
  });
});

test('the window holds the newest entries by last modification, wherever their routes sort', () => {
  const newest = routeOf(FEED_WINDOW + 1);
  const windowRoutes = [newest, ...routesOf(1, FEED_WINDOW - 1)];
  const world = postsWorld(FEED_WINDOW + 1);
  world.sitemapLastmods.set(newest, NEWER);

  world.texts['blog/rss.xml'] = feedOf(windowRoutes);
  assert.deepEqual(findingsOf(world), []);

  world.texts['blog/rss.xml'] = feedOf(windowRoutes.slice(1));
  const findings = findingsOf(world);
  assert.equal(findings.length, 1, JSON.stringify(findings));
  assert.ok(findings[0].text.startsWith(newest + FEED_ITEM_OWED), findings[0].text);
});

test('entries that share a last modification across the cut are ordered by route, whatever order the routes arrive in', () => {
  const arrivals = [
    (routes) => routes,
    (routes) => [...routes].reverse(),
    (routes) => [...routes.slice(7), ...routes.slice(0, 7)],
    (routes) => [...routes.filter((_, at) => at % 2 === 0), ...routes.filter((_, at) => at % 2 === 1)],
  ];

  for (const arrive of arrivals) {
    const world = postsWorld(FEED_WINDOW + 1);
    for (const route of routesOf(1, FEED_WINDOW - 1)) world.sitemapLastmods.set(route, NEWER);
    for (const route of routesOf(FEED_WINDOW, FEED_WINDOW + 1)) world.sitemapLastmods.set(route, OLDER);
    world.routes = arrive(world.routes);
    const { findings, ledger } = routeParity(world);

    assert.deepEqual(findings, []);
    assert.equal(ledger.surfaces['collection-feed'].owed, FEED_WINDOW + GLOSSARY_TERMS);
  }
});

test('a route with no lastmod sorts oldest, so it is the entry the window cuts', () => {
  const lacking = routeOf(1);
  const unlist = [(lastmods) => lastmods.delete(lacking), (lastmods) => lastmods.set(lacking, null)];

  for (const remove of unlist) {
    const world = postsWorld(FEED_WINDOW + 1);
    remove(world.sitemapLastmods);
    world.texts['blog/rss.xml'] = feedOf(routesOf(2, FEED_WINDOW + 1));
    const findings = findingsOf(world);

    assert.equal(findings.length, 1, JSON.stringify(findings));
    assert.ok(findings[0].text.startsWith(lacking + ' is owed a sitemap entry with a lastmod'), findings[0].text);
  }
});

test('a collection of at most the window owes every one of its entries a feed item', () => {
  for (const count of [2, FEED_WINDOW]) {
    const world = postsWorld(count);
    const owed = count + GLOSSARY_TERMS;
    assert.deepEqual(routeParity(world).ledger.surfaces['collection-feed'], { owed, present: owed });

    world.texts['blog/rss.xml'] = dropItem(world.texts['blog/rss.xml'], routeOf(count));
    const findings = findingsOf(world);
    assert.equal(findings.length, 1, JSON.stringify(findings));
    assert.ok(findings[0].text.startsWith(routeOf(count) + FEED_ITEM_OWED), findings[0].text);
  }
});

test('an entry asked about with no feed window known is owed its feed item, which is how the live announcement asks', () => {
  const entry = { kind: 'entry', collection: 'post', route: '/blog/first' };
  const asked = { inlineKinds: new Set(), feedHeads: new Map() };

  assert.deepEqual(owedFor(entry, asked), OWED.entry);
  assert.deepEqual(owedFor(entry, { ...asked, beyondFeedWindow: new Set() }), OWED.entry);
  assert.deepEqual(
    owedFor(entry, { ...asked, beyondFeedWindow: new Set(['/blog/first']) }),
    OWED.entry.filter((surface) => surface !== 'collection-feed')
  );
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
  assert.match(lines[0], /checked \d+ owed cells across 10 surfaces, \d+ present/);
  assert.equal(lines[1], 'machine: route parity declares 2 exceptions (/404, /search) and 1 empty collection (case)');
});
