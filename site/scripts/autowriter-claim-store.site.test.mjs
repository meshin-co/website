import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';

import { readClaims } from './autowriter-claim-store.mjs';
import { validateClaim } from './autowriter-claims.mjs';

const REPOSITORY_ROOT = join(import.meta.dirname, '..', '..');

test('every claim committed under audits stays valid, so the origin can stay optional', () => {
  const found = readClaims(REPOSITORY_ROOT);
  assert.ok(found.length >= 1, 'the scan found no claim to read');
  for (const { path, claim: read } of found) assert.deepEqual(validateClaim(read), [], path);
});
