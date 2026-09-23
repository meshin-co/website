import assert from 'node:assert/strict';
import { test } from 'node:test';

import { contactEmail, readBrand, titleSuffix } from './brand.mjs';

test('the brand name is read from the site config, never typed into a module', () => {
  assert.equal(readBrand('site:\n  name: example.dev\n  site: "https://example.dev"\n').name, 'example.dev');
});

test('the title suffix is derived from the name, so a rename moves every title at once', () => {
  assert.equal(titleSuffix({ name: 'example.dev' }), ' — example.dev');
});

test('the contact email is derived from the name, so a rename moves the address too', () => {
  assert.equal(contactEmail({ name: 'example.dev' }), 'hello@example.dev');
});

test('a config with no name fails loudly rather than yielding an empty suffix', () => {
  assert.throws(() => readBrand('site:\n  site: "https://example.dev"\n'), /name/);
});
