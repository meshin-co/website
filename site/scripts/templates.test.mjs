import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FEED_BASES, SERIES_COLLECTIONS } from '../src/utils/feeds.mjs';
import { templateOf, templateRoutes } from './templates.mjs';

test('a collection entry route reduces to its template, a static page stays itself', () => {
  assert.equal(templateOf('/blog/a-post'), '/blog/:entry');
  assert.equal(templateOf('/glossary/evals'), '/glossary/:entry');
  assert.equal(templateOf('/blog/category/governance'), '/blog/category/:entry');
  assert.equal(templateOf('/about'), '/about');
  assert.equal(templateOf('/'), '/');
});

test('one representative route is kept per template, chosen stably', () => {
  const routes = ['/', '/blog', '/blog/b-post', '/blog/a-post', '/about', '/glossary/evals'];

  assert.deepEqual(templateRoutes(routes), ['/', '/about', '/blog', '/blog/a-post', '/glossary/evals']);
});

test('every template present in the input is represented', () => {
  const routes = ['/services', '/services/x', '/services/y', '/faq'];

  assert.deepEqual(templateRoutes(routes).map(templateOf), ['/faq', '/services', '/services/:entry']);
});

test('a version page of a series collection reduces to one template and its series page to another', () => {
  assert.equal(templateOf('/spec/evals-baseline/1.0'), '/spec/:series/:entry');
  assert.equal(templateOf('/spec/another-spec/12.30'), '/spec/:series/:entry');
  assert.equal(templateOf('/spec/evals-baseline'), '/spec/:series');
  assert.equal(templateOf('/spec/another-spec'), '/spec/:series');
});

test('every series collection reads its pages this way, whatever its base', () => {
  for (const kind of SERIES_COLLECTIONS) {
    const base = FEED_BASES[kind];
    assert.equal(templateOf(`/${base}/a/1.0`), `/${base}/:series/:entry`, kind);
    assert.equal(templateOf(`/${base}/a`), `/${base}/:series`, kind);
  }
});

test('a route under a series base that is neither a series page nor a version page stays itself', () => {
  assert.equal(templateOf('/spec'), '/spec');
  assert.equal(templateOf('/spec/evals-baseline/1.0/extra'), '/spec/evals-baseline/1.0/extra');
});

test('a collection that is not a series collection keeps its own reading of two and three segments', () => {
  assert.equal(templateOf('/blog/a-post'), '/blog/:entry');
  assert.equal(templateOf('/blog/a-post/1.0'), '/blog/a-post/1.0');
  assert.equal(templateOf('/blog/category/governance'), '/blog/category/:entry');
});

test('one series page and one version page represent a series family however many series and versions it holds', () => {
  const routes = ['/spec/b/1.0', '/spec/a/1.1', '/spec/a/1.0', '/spec/b', '/spec/a', '/about'];

  assert.deepEqual(templateRoutes(routes), ['/about', '/spec/a', '/spec/a/1.0']);
});
