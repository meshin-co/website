import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FEED_BASES } from './feeds.mjs';
import { NOINDEX_STATIC_PAGES } from './machine-text.mjs';
import { EMPTY_COLLECTIONS, ROUTE_EXCEPTIONS } from './route-exceptions.mjs';

test('every declared exception names a route and gives a reason of at least a sentence', () => {
  assert.ok(ROUTE_EXCEPTIONS.length > 0);
  for (const { route, reason } of ROUTE_EXCEPTIONS) {
    assert.match(route, /^\/[a-z0-9-]*$/, route);
    assert.ok(reason.trim().split(/\s+/).length >= 8, route + ' needs a reason of at least a sentence');
  }
});

test('a route is declared an exception once', () => {
  const routes = ROUTE_EXCEPTIONS.map(({ route }) => route);

  assert.deepEqual(routes, [...new Set(routes)]);
});

test('the exceptions stay small: the 404, search and styleguide pages and nothing else', () => {
  assert.deepEqual(ROUTE_EXCEPTIONS.map(({ route }) => route).sort(), ['/404', '/search', '/styleguide']);
});

test('the noindex static pages that feed the sitemap, llms.txt and the sidecars are this register, read once', () => {
  assert.deepEqual([...NOINDEX_STATIC_PAGES].sort(), ROUTE_EXCEPTIONS.map(({ route }) => route).sort());
});

test('every declared empty collection is a collection the feeds know, with a reason', () => {
  assert.ok(EMPTY_COLLECTIONS.length > 0);
  for (const { collection, reason } of EMPTY_COLLECTIONS) {
    assert.ok(Object.hasOwn(FEED_BASES, collection), collection + ' is not a collection');
    assert.ok(reason.trim().split(/\s+/).length >= 8, collection + ' needs a reason of at least a sentence');
  }
});
