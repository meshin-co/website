import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { readConceptRegister } from './topic-owners.mjs';

test('the committed semantic core carries a concept register this reader finds', () => {
  const core = readFileSync(new URL('../../docs/SEMANTIC-CORE.md', import.meta.url), 'utf8');
  const declared = Number(/^#### Concept register \((\d+)\)$/m.exec(core)?.[1]);
  const real = readConceptRegister(core);
  assert.ok(declared > 0, 'the committed core declares no concept register');
  assert.equal(real.length, declared, 'concepts read: ' + real.length);
});
