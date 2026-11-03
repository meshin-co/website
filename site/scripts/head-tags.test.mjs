import assert from 'node:assert/strict';
import { test } from 'node:test';

import { attributeOf, declaredUrl, linkTags, metaTags } from './head-tags.mjs';

const HEAD =
  '<head><link href="https://a.test/x" rel="canonical"><meta content="https://a.test/card.png" property="og:image">' +
  "<link rel='alternate' type='text/markdown' href='/x.md'><meta name=\"robots\" content=\"noindex\"></head>";

test('an attribute is read in either quote style and in any order', () => {
  assert.equal(attributeOf('<link href="/a" rel="canonical">', 'href'), '/a');
  assert.equal(attributeOf("<link rel='alternate' href='/b'>", 'href'), '/b');
  assert.equal(attributeOf('<link rel="alternate">', 'href'), undefined);
});

test('a name that only ends an attribute name is not read as that attribute', () => {
  assert.equal(attributeOf('<meta data-href="/no" href="/yes">', 'href'), '/yes');
});

test('the tags of a head are listed in document order', () => {
  assert.equal(linkTags(HEAD).length, 2);
  assert.equal(metaTags(HEAD).length, 2);
  assert.ok(linkTags(HEAD)[0].includes('canonical'));
});

test('a declared url is found by the attribute that identifies its tag', () => {
  assert.equal(declaredUrl(HEAD, /<meta\b[^>]*>/gi, 'property', 'og:image', 'content'), 'https://a.test/card.png');
  assert.equal(declaredUrl(HEAD, /<link\b[^>]*>/gi, 'rel', 'canonical', 'href'), 'https://a.test/x');
  assert.equal(declaredUrl(HEAD, /<meta\b[^>]*>/gi, 'property', 'og:url', 'content'), undefined);
});
