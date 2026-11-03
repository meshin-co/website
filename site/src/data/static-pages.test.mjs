import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HUB_PAGES, STATIC_PAGE_CATALOG } from './static-pages.mjs';

const ENGINE_PAGES = ['/search', '/styleguide', '/404'];
const ROUTE = /^\/[a-z0-9\-/]*$/;

test('every static page is one route, listed once, with a title and a description', () => {
  const paths = STATIC_PAGE_CATALOG.map((page) => page.path);
  assert.equal(new Set(paths).size, paths.length, 'a route is listed twice');
  for (const page of STATIC_PAGE_CATALOG) {
    assert.match(page.path, ROUTE, `${page.path} is not a route`);
    assert.ok(page.title.length > 0, `${page.path} has no title`);
    assert.ok(page.description.length > 0, `${page.path} has no description`);
  }
});

test('a date, where a static page has one, is a plain YYYY-MM-DD day', () => {
  for (const page of STATIC_PAGE_CATALOG.filter((candidate) => candidate.updatedDate !== undefined)) {
    assert.match(page.updatedDate, /^\d{4}-\d{2}-\d{2}$/, `${page.path} is not a plain day`);
  }
});

test('the pages the engine serves itself are listed, so a copy of the engine builds before its owner adds a page', () => {
  const paths = STATIC_PAGE_CATALOG.map((page) => page.path);
  for (const route of ENGINE_PAGES) assert.ok(paths.includes(route), `${route} is missing`);
});

test('every collection hub is one route, listed once, with a title and a description', () => {
  const bases = HUB_PAGES.map((hub) => hub.base);
  assert.equal(new Set(bases).size, bases.length, 'a hub is listed twice');
  for (const hub of HUB_PAGES) {
    assert.match(hub.base, ROUTE, `${hub.base} is not a route`);
    assert.ok(hub.title.length > 0, `${hub.base} has no title`);
    assert.ok(hub.description.length > 0, `${hub.base} has no description`);
  }
});
