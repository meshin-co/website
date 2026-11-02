import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { insertPassage, passageOf } from './route-derive.mjs';
import { CORE_TEXT } from './fixtures/semantic-core-doc.mjs';
import { WriterError } from './writer-error.mjs';

test('the passage of a prompt is found for the route it was written for', () => {
  assert.equal(passageOf(CORE_TEXT, { promptNumber: 1, route: '/a' }), 'First passage.');
  assert.equal(passageOf(CORE_TEXT, { promptNumber: 1, route: '/b' }), 'Second passage.');
  assert.equal(passageOf(CORE_TEXT, { promptNumber: 22, route: '/z' }), 'Twenty-second passage.');
});

test('a prompt with no passage for the route gives null', () => {
  assert.equal(passageOf(CORE_TEXT, { promptNumber: 1, route: '/c' }), null);
  assert.equal(passageOf(CORE_TEXT, { promptNumber: 2, route: '/c' }), null);
  assert.equal(passageOf(CORE_TEXT, { promptNumber: 3, route: '/a' }), null);
});

test('a prompt that is not in the document is refused', () => {
  assert.throws(
    () => passageOf(CORE_TEXT, { promptNumber: 99, route: '/a' }),
    (error) => error instanceof WriterError && error.message.includes('99')
  );
});

test('it returns what insertPassage wrote, for a prompt with and without passages', () => {
  const passage = 'A registry row says which model runs where.';
  const route = '/glossary/model-registry';
  for (const promptNumber of [1, 2, 3]) {
    const written = insertPassage(CORE_TEXT, { promptNumber, passage, route });

    assert.equal(passageOf(written, { promptNumber, route }), passage, String(promptNumber));
  }
});
