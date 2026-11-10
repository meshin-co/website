import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { readEngineConfig } from './engine-config.mjs';
import { surfacesOf } from './entry-surfaces.mjs';
import { BOUNDED_INLINE_COLLECTIONS } from './machine.mjs';
import { OWED, SURFACES } from './route-parity.mjs';
import { collectRoutes } from './routes-gate.mjs';

const ORIGIN = 'https://site.test';
const POST = { format: 'article', slug: 'a-post', origin: ORIGIN };
const TERM = { format: 'term', slug: 'a-term', origin: ORIGIN };

const feedOf = (...routes) =>
  `<rss><channel>${routes.map((route) => `<item><guid isPermaLink="true">${ORIGIN}${route}</guid></item>`).join('')}</channel></rss>`;
const reading = (files) => (file) => files[file];

const shown = (surfaces) => surfaces.map(({ kind, url }) => [kind, url]);
const labelsAreTheGates = (surfaces) =>
  surfaces.filter(({ kind }) => kind !== 'page').every(({ kind, label }) => label === SURFACES[kind].label);

function withPlanted(id, surface, body) {
  SURFACES[id] = surface;
  OWED.entry.push(id);
  try {
    return body();
  } finally {
    OWED.entry.pop();
    delete SURFACES[id];
  }
}

test('an article is the page first and then every surface the parity gate owes an entry, each at its own address', () => {
  const surfaces = surfacesOf(POST);
  assert.deepEqual(shown(surfaces), [
    ['page', 'https://site.test/blog/a-post'],
    ['sitemap', 'https://site.test/sitemap-0.xml'],
    ['sidecar', 'https://site.test/blog/a-post.md'],
    ['llms-collection', 'https://site.test/llms/post.txt'],
    ['collection-feed', 'https://site.test/blog/rss.xml'],
    ['search-shard', 'https://site.test/search-index/manifest.json'],
    ['og-image', 'https://site.test/og/post/a-post.png'],
  ]);
  assert.equal(surfaces[0].label, 'the page');
  assert.ok(labelsAreTheGates(surfaces));
});

test('a glossary term is owed the same surfaces under the glossary base and the glossary collection', () => {
  assert.deepEqual(shown(surfacesOf(TERM)), [
    ['page', 'https://site.test/glossary/a-term'],
    ['sitemap', 'https://site.test/sitemap-0.xml'],
    ['sidecar', 'https://site.test/glossary/a-term.md'],
    ['llms-collection', 'https://site.test/llms/glossary.txt'],
    ['collection-feed', 'https://site.test/glossary/rss.xml'],
    ['search-shard', 'https://site.test/search-index/manifest.json'],
    ['og-image', 'https://site.test/og/glossary/a-term.png'],
  ]);
});

test('an origin written with trailing slashes never doubles a slash', () => {
  const urls = surfacesOf({ ...POST, origin: `${ORIGIN}//` }).map(({ url }) => url);
  assert.deepEqual(
    urls,
    surfacesOf(POST).map(({ url }) => url)
  );
  assert.ok(urls.every((url) => !url.slice('https://'.length).includes('//')));
});

test('a surface that is a fact about the head of the page is not a second address, so no address is listed twice', () => {
  const surfaces = surfacesOf(POST);
  const kinds = surfaces.map(({ kind }) => kind);
  assert.ok(OWED.entry.includes('sidecar-link') && OWED.entry.includes('feed-link'));
  assert.equal(kinds.includes('sidecar-link'), false);
  assert.equal(kinds.includes('feed-link'), false);
  assert.equal(new Set(surfaces.map(({ url }) => url)).size, surfaces.length);
});

test('the merged feed is listed only for the newest entry of its collection feed, read from the feed the build wrote', () => {
  const newest = surfacesOf({ ...POST, read: reading({ 'blog/rss.xml': feedOf('/blog/a-post', '/blog/older') }) });
  assert.deepEqual(newest.at(-1), {
    kind: 'merged-feed',
    label: SURFACES['merged-feed'].label,
    url: `${ORIGIN}/rss.xml`,
  });
  const second = surfacesOf({ ...POST, read: reading({ 'blog/rss.xml': feedOf('/blog/newer', '/blog/a-post') }) });
  assert.equal(
    second.some(({ kind }) => kind === 'merged-feed'),
    false
  );
  assert.equal(
    surfacesOf(POST).some(({ kind }) => kind === 'merged-feed'),
    false
  );
  const term = surfacesOf({ ...TERM, read: reading({ 'glossary/rss.xml': feedOf('/glossary/a-term') }) });
  assert.equal(term.at(-1).kind, 'merged-feed');
});

test('the line in llms.txt is listed only for a collection that llms.txt lists inline', () => {
  assert.equal(
    surfacesOf(POST).some(({ kind }) => kind === 'llms-index'),
    false
  );
  BOUNDED_INLINE_COLLECTIONS.push('post');
  try {
    const listed = surfacesOf(POST);
    assert.deepEqual(listed.at(-1), {
      kind: 'llms-index',
      label: SURFACES['llms-index'].label,
      url: `${ORIGIN}/llms.txt`,
    });
  } finally {
    BOUNDED_INLINE_COLLECTIONS.pop();
  }
});

test("when the parity gate is owed a new surface for entries, the surfaces of an entry gain it, with the gate's own label and address", () => {
  const planted = {
    label: 'a planted surface',
    artifact: ({ route }) => `/planted${route}`,
    absence: () => null,
  };
  const gained = withPlanted('planted', planted, () => surfacesOf(POST));
  assert.deepEqual(gained.at(-1), {
    kind: 'planted',
    label: 'a planted surface',
    url: 'https://site.test/planted/blog/a-post',
  });
  assert.equal(gained.length, surfacesOf(POST).length + 1);
  assert.equal(
    surfacesOf(POST).some(({ kind }) => kind === 'planted'),
    false
  );
});

test('a surface is derived from the very description of the route the parity gate derives, the shape and the collection included', () => {
  const described = {
    label: 'a planted surface',
    artifact: ({ shape, kind, base, id, collection }) => `/${[shape, kind, base, id, collection].join('/')}`,
    absence: () => null,
  };
  const gained = withPlanted('planted-description', described, () => surfacesOf(TERM));
  assert.equal(gained.at(-1).url, 'https://site.test/entry/entry/glossary/a-term/glossary');
});

test('a planted surface that only names the page itself adds no address', () => {
  const head = { label: 'a planted head fact', artifact: ({ route }) => route, absence: () => null };
  const surfaces = withPlanted('planted-head', head, () => surfacesOf(POST));
  assert.deepEqual(shown(surfaces), shown(surfacesOf(POST)));
});

test('a format the writer does not write is refused, so no surface is guessed for it', () => {
  assert.throws(
    () => surfacesOf({ format: 'service', slug: 'x', origin: ORIGIN }),
    /writes term and article entries, not "service"/
  );
});

const WRITTEN_SLUG = 'a-written-entry';

function routesBuiltAt(prefixes) {
  const dist = mkdtempSync(join(tmpdir(), 'entry-surfaces-'));
  try {
    for (const prefix of prefixes) {
      const file = join(dist, `${prefix}${WRITTEN_SLUG}.html`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, '<!doctype html>');
    }
    return collectRoutes(dist);
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
}

test('the page address of an entry of each format the writer writes is its configured route prefix and its slug, and a route of the ledger a build of that form writes', () => {
  const { formats } = readEngineConfig().content;
  const ledger = new Set(routesBuiltAt(Object.values(formats).map(({ routePrefix }) => routePrefix)));
  assert.equal(ledger.size, Object.keys(formats).length);
  for (const [format, { routePrefix }] of Object.entries(formats)) {
    const [page] = surfacesOf({ format, slug: WRITTEN_SLUG, origin: ORIGIN });
    const { pathname } = new URL(page.url);
    assert.equal(pathname, `${routePrefix}${WRITTEN_SLUG}`);
    assert.equal(ledger.has(pathname), true, page.url);
  }
});
