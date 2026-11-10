import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';

import { readRecord } from './generation-record.mjs';
import { recordFiles } from './record-layout.mjs';

const REPOSITORY_ROOT = join(import.meta.dirname, '..', '..');

test('every record committed under audits stays valid, so the origin and the null row can stay optional', () => {
  const files = recordFiles(REPOSITORY_ROOT, 'generation');
  assert.ok(files.length >= 1, 'the scan found no generation record to read');
  for (const file of files) assert.doesNotThrow(() => readRecord(join(REPOSITORY_ROOT, file)), file);
});
