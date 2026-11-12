import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RESERVED_LEAF_SLUGS, SERIES_BASES, deriveRouteKinds, routeShape } from './route-kinds.mjs';
import { COLLECTIONS, buildWorld } from './fixtures/parity-world.mjs';

const BASES = new Set(COLLECTIONS.map(({ base }) => base));
const NOINDEX = '<meta content="noindex, follow" name="robots">';

const derive = (world) => deriveRouteKinds(world);
const kindOf = (derived, route) => derived.routes.get(route)?.kind;
const rulesOf = (derived) => derived.findings.map(({ rule }) => rule).sort();

const SHAPES = [
  ['/', 'page'],
  ['/about', 'page'],
  ['/blog', 'hub'],
  ['/faq', 'hub'],
  ['/blog/first', 'entry'],
  ['/blog/tags', 'tag-index'],
  ['/blog/tag/ai', 'archive'],
  ['/blog/category/governance', 'archive'],
  ['/blog/page/2', 'pagination'],
  ['/blog/tag/ai/page/2', 'pagination'],
  ['/blog/category/governance/page/3', 'pagination'],
  ['/blog/series/one/two', 'page'],
];

test('a route is classified by its shape under the collection bases, never by a list of paths', () => {
  for (const [route, shape] of SHAPES) {
    assert.equal(routeShape(route, new Set([...BASES, 'faq'])).shape, shape, route);
  }
});

test('the reserved leaf slugs are the four the archives and pagination use', () => {
  assert.deepEqual([...RESERVED_LEAF_SLUGS].sort(), ['category', 'page', 'tag', 'tags']);
});

test('an entry shape names its collection base and its id', () => {
  assert.deepEqual(routeShape('/blog/first', BASES), { shape: 'entry', base: 'blog', id: 'first' });
  assert.deepEqual(routeShape('/blog', BASES), { shape: 'hub', base: 'blog' });
});

const SPEC_BASES = new Set([...BASES, 'spec']);

const SERIES_SHAPES = [
  ['/spec', { shape: 'hub', base: 'spec' }],
  ['/spec/evals-baseline', { shape: 'series', base: 'spec', id: 'evals-baseline' }],
  ['/spec/evals-baseline/1.0', { shape: 'entry', base: 'spec', id: 'evals-baseline/1.0' }],
  ['/spec/evals-baseline/1.0/extra', { shape: 'page' }],
];

test('the series bases are the URL bases of the collections that publish versioned series', () => {
  assert.deepEqual([...SERIES_BASES], ['spec']);
});

test('under a series base one segment is a hub, two a series, three an entry named by series and version, deeper a page', () => {
  for (const [route, expected] of SERIES_SHAPES) assert.deepEqual(routeShape(route, SPEC_BASES), expected, route);
});

test('the series bases are a parameter: given none, a series base reads like any other base', () => {
  assert.deepEqual(routeShape('/spec/evals-baseline', SPEC_BASES, new Set()), {
    shape: 'entry',
    base: 'spec',
    id: 'evals-baseline',
  });
  assert.deepEqual(routeShape('/spec/evals-baseline/1.0', SPEC_BASES, new Set()), { shape: 'page' });
});

test('a base that is not a series base never reads three segments as an entry', () => {
  assert.deepEqual(routeShape('/blog/evals-baseline/1.0', SPEC_BASES), { shape: 'page' });
  assert.deepEqual(routeShape('/blog/first', SPEC_BASES), { shape: 'entry', base: 'blog', id: 'first' });
});

const NO_DECLARATIONS = { exceptions: [], noindexRoutes: new Set(), emptyCollections: [] };
const SERIES_PAGE = '/spec/evals-baseline';
const FIRST_VERSION = '/spec/evals-baseline/1.0';
const SECOND_VERSION = '/spec/evals-baseline/1.1';

function seriesWorld({
  routes = [SERIES_PAGE, FIRST_VERSION, SECOND_VERSION],
  collections = [{ kind: 'spec', base: 'spec' }],
  noindex = [],
  declaredNoindex = [],
} = {}) {
  const head = (route) => `<html><head>${noindex.includes(route) ? NOINDEX : ''}</head></html>`;
  return {
    routes,
    htmlByRoute: Object.fromEntries(routes.map((route) => [route, head(route)])),
    collections,
    declared: { ...NO_DECLARATIONS, noindexRoutes: new Set(declaredNoindex) },
  };
}

test('a series collection derives its series page as a series and each version page as an entry, with no list of paths', () => {
  const derived = derive(seriesWorld());
  const described = [...derived.routes.values()].map(({ route, kind, shape, base, id, collection }) => ({
    route,
    kind,
    shape,
    base,
    id,
    collection,
  }));

  assert.deepEqual(derived.findings, []);
  assert.deepEqual(described, [
    { route: SERIES_PAGE, kind: 'series', shape: 'series', base: 'spec', id: 'evals-baseline', collection: 'spec' },
    { route: FIRST_VERSION, kind: 'entry', shape: 'entry', base: 'spec', id: 'evals-baseline/1.0', collection: 'spec' },
    {
      route: SECOND_VERSION,
      kind: 'entry',
      shape: 'entry',
      base: 'spec',
      id: 'evals-baseline/1.1',
      collection: 'spec',
    },
  ]);
});

test('the live entries of a series collection are its version pages, and the series page is never one of them', () => {
  assert.deepEqual(derive(seriesWorld()).liveEntries, { spec: [FIRST_VERSION, SECOND_VERSION] });
});

test('a series page alone does not make its collection live', () => {
  const derived = derive(seriesWorld({ routes: [SERIES_PAGE] }));

  assert.deepEqual(derived.liveEntries, { spec: [] });
  assert.deepEqual(rulesOf(derived), ['collection-empty-undeclared']);
  assert.equal(kindOf(derived, SERIES_PAGE), 'series');
});

test('a noindex series page is an undeclared noindex and is withheld, and no entry frontmatter can declare it', () => {
  for (const declaredNoindex of [[], [SERIES_PAGE]]) {
    const derived = derive(seriesWorld({ noindex: [SERIES_PAGE], declaredNoindex }));

    assert.deepEqual(rulesOf(derived), ['route-noindex-undeclared']);
    assert.equal(derived.findings[0].subjects[0], SERIES_PAGE);
    assert.equal(kindOf(derived, SERIES_PAGE), 'withheld');
    assert.deepEqual(derived.liveEntries.spec, [FIRST_VERSION, SECOND_VERSION]);
  }
});

test('a version page whose frontmatter says noindex is withheld without a finding, and its series page stays a series', () => {
  const derived = derive(seriesWorld({ noindex: [SECOND_VERSION], declaredNoindex: [SECOND_VERSION] }));

  assert.deepEqual(derived.findings, []);
  assert.equal(kindOf(derived, SECOND_VERSION), 'withheld');
  assert.equal(kindOf(derived, SERIES_PAGE), 'series');
  assert.deepEqual(derived.liveEntries.spec, [FIRST_VERSION]);
});

test('a version page declared noindex by its frontmatter whose built page is indexable is a finding', () => {
  const derived = derive(seriesWorld({ declaredNoindex: [FIRST_VERSION] }));

  assert.deepEqual(rulesOf(derived), ['route-noindex-missing']);
  assert.equal(derived.findings[0].subjects[0], FIRST_VERSION);
});

test('the series bases are read from the collections the derivation receives, by kind and not by the base in use', () => {
  const routes = ['/specs/evals-baseline', '/specs/evals-baseline/1.0', '/talks/keynote', '/talks/keynote/2'];
  const collections = [
    { kind: 'spec', base: 'specs' },
    { kind: 'talk', base: 'talks' },
  ];
  const derived = derive(seriesWorld({ routes, collections }));

  assert.deepEqual(
    routes.map((route) => kindOf(derived, route)),
    ['series', 'entry', 'entry', 'page']
  );
  assert.deepEqual(derived.liveEntries, { spec: ['/specs/evals-baseline/1.0'], talk: ['/talks/keynote'] });
});

test('the baseline world derives every built route to one kind and raises no finding', () => {
  const derived = derive(buildWorld());
  const counts = {};
  for (const { kind } of derived.routes.values()) counts[kind] = (counts[kind] ?? 0) + 1;

  assert.deepEqual(derived.findings, []);
  assert.deepEqual(counts, { page: 2, exception: 2, hub: 2, withheld: 1, 'tag-index': 1, archive: 2, entry: 3 });
  assert.equal(derived.routes.size, buildWorld().routes.length);
});

test('a collection the world has never heard of is derived from the configuration alone', () => {
  const world = buildWorld();
  world.collections = [...world.collections, { kind: 'talk', base: 'talks' }];
  world.routes = [...world.routes, '/talks', '/talks/keynote'];
  world.htmlByRoute['/talks'] = '<html><head></head></html>';
  world.htmlByRoute['/talks/keynote'] = '<html><head></head></html>';
  const derived = derive(world);

  assert.equal(kindOf(derived, '/talks'), 'hub');
  assert.equal(kindOf(derived, '/talks/keynote'), 'entry');
  assert.equal(derived.routes.get('/talks/keynote').collection, 'talk');
  assert.deepEqual(derived.liveEntries.talk, ['/talks/keynote']);
});

test('a noindex route nobody declared is a finding and is withheld, not silently excused', () => {
  const world = buildWorld();
  world.htmlByRoute['/about'] = world.htmlByRoute['/about'].replace('</head>', NOINDEX + '</head>');
  const derived = derive(world);

  assert.deepEqual(rulesOf(derived), ['route-noindex-undeclared']);
  assert.equal(derived.findings[0].subjects[0], '/about');
  assert.match(derived.findings[0].text, /^\/about is noindex in the build and nothing declares it/);
  assert.equal(kindOf(derived, '/about'), 'withheld');
});

test('a noindex entry is withheld only when its frontmatter says noindex', () => {
  const undeclared = buildWorld();
  undeclared.htmlByRoute['/blog/second'] = undeclared.htmlByRoute['/blog/second'].replace(
    '</head>',
    NOINDEX + '</head>'
  );
  const declared = buildWorld();
  declared.htmlByRoute['/blog/second'] = undeclared.htmlByRoute['/blog/second'];
  declared.declared.noindexRoutes = new Set(['/blog/second']);

  assert.deepEqual(rulesOf(derive(undeclared)), ['route-noindex-undeclared']);
  assert.deepEqual(derive(declared).findings, []);
  assert.equal(kindOf(derive(declared), '/blog/second'), 'withheld');
  assert.deepEqual(derive(declared).liveEntries.post, ['/blog/first']);
});

test('an entry whose frontmatter says noindex but whose page is indexable is a finding', () => {
  const world = buildWorld();
  world.declared.noindexRoutes = new Set(['/blog/second']);
  const derived = derive(world);

  assert.deepEqual(rulesOf(derived), ['route-noindex-missing']);
  assert.match(
    derived.findings[0].text,
    /^\/blog\/second is declared noindex by its source but its built page is indexable/
  );
});

test('a pagination page is its own kind whether or not it carries noindex', () => {
  const world = buildWorld();
  world.routes = [...world.routes, '/blog/page/2', '/blog/tag/ai/page/2'];
  world.htmlByRoute['/blog/page/2'] = '<html><head>' + NOINDEX + '</head></html>';
  world.htmlByRoute['/blog/tag/ai/page/2'] = '<html><head></head></html>';
  const derived = derive(world);

  assert.deepEqual(derived.findings, []);
  assert.equal(kindOf(derived, '/blog/page/2'), 'pagination');
  assert.equal(kindOf(derived, '/blog/tag/ai/page/2'), 'pagination');
});

test('a nested route under a collection base that is none of the known shapes is owed what a page is owed', () => {
  const world = buildWorld();
  world.routes = [...world.routes, '/blog/series/one'];
  world.htmlByRoute['/blog/series/one'] = '<html><head></head></html>';

  assert.equal(kindOf(derive(world), '/blog/series/one'), 'page');
});

test('a hub under noindex is withheld only while its collection has no live entry', () => {
  const emptied = buildWorld();
  emptied.htmlByRoute['/glossary/evals'] = emptied.htmlByRoute['/glossary/evals'].replace(
    '</head>',
    NOINDEX + '</head>'
  );
  emptied.htmlByRoute['/glossary'] = emptied.htmlByRoute['/glossary'].replace('</head>', NOINDEX + '</head>');
  emptied.declared.noindexRoutes = new Set(['/glossary/evals']);
  const populated = buildWorld();
  populated.htmlByRoute['/blog'] = populated.htmlByRoute['/blog'].replace('</head>', NOINDEX + '</head>');

  assert.deepEqual(rulesOf(derive(emptied)), ['collection-empty-undeclared']);
  assert.match(
    derive(emptied).findings[0].text,
    /^collection glossary has no live entry in the build and is not declared empty/
  );
  assert.deepEqual(rulesOf(derive(populated)), ['route-noindex-undeclared']);
  assert.match(
    derive(populated).findings[0].text,
    /^\/blog is noindex in the build but the post collection has live entries/
  );
});

test('a collection with no live entry that nobody declared empty is a finding, so a vanished collection cannot pass', () => {
  const world = buildWorld();
  world.declared.emptyCollections = [];
  const derived = derive(world);

  assert.deepEqual(rulesOf(derived), ['collection-empty-undeclared']);
  assert.deepEqual(derived.findings[0].subjects, ['/case-studies']);
});

test('a collection declared empty that holds a live entry is a finding, so the declaration cannot go stale', () => {
  const world = buildWorld();
  world.routes = [...world.routes, '/case-studies/acme'];
  world.htmlByRoute['/case-studies/acme'] = '<html><head></head></html>';
  const derived = derive(world);

  assert.ok(rulesOf(derived).includes('collection-empty-stale'));
  assert.match(
    derived.findings.find(({ rule }) => rule === 'collection-empty-stale').text,
    /^collection case is declared empty but holds 1 live entry/
  );
});

test('a declaration of an empty collection the site does not have is a finding', () => {
  const world = buildWorld();
  world.declared.emptyCollections = [...world.declared.emptyCollections, { collection: 'ghost', reason: 'None.' }];
  const derived = derive(world);

  assert.deepEqual(rulesOf(derived), ['collection-empty-stale']);
  assert.match(derived.findings[0].text, /^collection ghost is declared empty but the site has no such collection/);
});

test('an exception for a route that no longer builds is a finding', () => {
  const world = buildWorld();
  world.declared.exceptions = [...world.declared.exceptions, { route: '/gone', reason: 'It used to exist.' }];
  const derived = derive(world);

  assert.deepEqual(rulesOf(derived), ['route-exception-stale']);
  assert.match(derived.findings[0].text, /^\/gone is a declared exception but no page built at that route/);
});

test('an exception whose page is indexable is a finding, and the page is held to what its shape owes', () => {
  const world = buildWorld();
  world.htmlByRoute['/search'] = '<html><head></head></html>';
  const derived = derive(world);

  assert.deepEqual(rulesOf(derived), ['route-exception-stale']);
  assert.match(derived.findings[0].text, /^\/search is a declared exception but its page is indexable/);
  assert.equal(kindOf(derived, '/search'), 'page');
});
