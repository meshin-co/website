import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { PENDING } from './mutation-pending.mjs';
import { changeDirectories, pendingChangeFindings } from './plan-gate.mjs';

const changes = changeDirectories(fileURLToPath(new URL('../../openspec/changes', import.meta.url)));

test('every pending entry names a change that is still open, and says why the specimen is owed', () => {
  assert.deepEqual(pendingChangeFindings(PENDING, changes), []);
});
