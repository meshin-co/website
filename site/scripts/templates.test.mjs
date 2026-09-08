import assert from 'node:assert/strict';
import { test } from 'node:test';

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
