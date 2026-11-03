import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EMPTY_COLLECTIONS } from './route-exceptions.mjs';

test('the case collection is the only one declared empty, until a client agrees in writing', () => {
  assert.deepEqual(
    EMPTY_COLLECTIONS.map(({ collection }) => collection),
    ['case']
  );
});
