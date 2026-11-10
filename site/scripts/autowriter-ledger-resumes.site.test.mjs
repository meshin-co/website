import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { validateLedger } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { recordFiles } from './record-layout.mjs';

const REPOSITORY_ROOT = join(import.meta.dirname, '..', '..');
const problemsOf = (ledger) => validateLedger(ledger).map(describeProblem);

test('every ledger committed under audits stays valid, so resumes can stay optional', () => {
  const files = recordFiles(REPOSITORY_ROOT, 'ledger');

  assert.ok(files.length >= 1, 'the scan found no ledger to read');
  for (const file of files) {
    const ledger = JSON.parse(readFileSync(join(REPOSITORY_ROOT, file), 'utf8'));
    assert.deepEqual(problemsOf(ledger), [], file);
  }
});
