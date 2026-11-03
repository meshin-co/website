import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HUB_PAGES, STATIC_PAGE_CATALOG } from '../data/static-pages.mjs';
import { pageExists } from './page-exists.mjs';

const staticPages = [{ path: '/about' }, { path: '/blog/tags' }];
const hubs = [{ base: '/blog' }, { base: '/case-studies' }];

test('a path in the static catalog exists', () => {
  assert.equal(pageExists('/about', { staticPages, hubs }), true);
  assert.equal(pageExists('/blog/tags', { staticPages, hubs }), true);
});

test('a collection hub base exists even when the catalog does not list it', () => {
  assert.equal(pageExists('/case-studies', { staticPages, hubs }), true);
});

test('a path in neither list does not exist', () => {
  assert.equal(pageExists('/faq', { staticPages, hubs }), false);
  assert.equal(pageExists('/about/team', { staticPages, hubs }), false);
});

test('a hub base is not matched with a trailing slash or a different case', () => {
  assert.equal(pageExists('/blog/', { staticPages, hubs }), false);
  assert.equal(pageExists('/Blog', { staticPages, hubs }), false);
});

test('empty lists leave no page', () => {
  assert.equal(pageExists('/', { staticPages: [], hubs: [] }), false);
});

test('the shipped lists are the default source of truth', () => {
  for (const page of STATIC_PAGE_CATALOG) assert.equal(pageExists(page.path), true, page.path);
  for (const hub of HUB_PAGES) assert.equal(pageExists(hub.base), true, hub.base);
  assert.equal(pageExists('/this-page-is-in-no-catalog'), false);
});
