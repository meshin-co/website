import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { test } from 'node:test';

import { invokedDirectly } from './invoked-directly.mjs';

test('a script run through a symlink still knows it is the entry point', () => {
  const real = realpathSync(new URL('invoked-directly.mjs', import.meta.url).pathname);

  assert.equal(invokedDirectly(real, '/elsewhere/link/scripts/invoked-directly.mjs'), false);
  assert.equal(invokedDirectly(real, real), true);
});

test('a script merely imported by another is not the entry point', () => {
  assert.equal(invokedDirectly('/repo/scripts/a.mjs', '/repo/scripts/b.mjs'), false);
  assert.equal(invokedDirectly('/repo/scripts/a.mjs', undefined), false);
});
