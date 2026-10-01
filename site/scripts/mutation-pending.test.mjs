import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';

import { PENDING } from './mutation-pending.mjs';
import { pendingPhaseFindings } from './plan-gate.mjs';

const phases = readdirSync(new URL('../../docs/plan/phases/', import.meta.url));

test('every pending entry names a phase that exists and is not done, and says why the specimen is owed', () => {
  assert.deepEqual(pendingPhaseFindings(PENDING, phases), []);
});
