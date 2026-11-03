import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import { isDispositionFile } from './autowriter-refusals.mjs';
import { LENGTH_FILE } from './entry-length.mjs';
import { recordDirectory, recordFiles } from './record-layout.mjs';
import { BAND_FILE } from './sentence-band.mjs';

const REPO = resolve(import.meta.dirname, '..', '..');

test('this repository keeps the band, the length record, the Lighthouse record and the dispositions where the refusal list says', () => {
  assert.ok(existsSync(join(REPO, BAND_FILE)), BAND_FILE + ' is not where the repository keeps the band');
  assert.ok(existsSync(join(REPO, LENGTH_FILE)), LENGTH_FILE + ' is not where the repository keeps the length record');
  assert.ok(
    existsSync(join(REPO, 'audits/lighthouse-green.json')),
    'the record lh:record writes is not where the list says'
  );
  assert.ok(readdirSync(join(REPO, recordDirectory('disposition'))).length > 0, 'no dispositions where the list says');
  const present = recordFiles(REPO, 'disposition');
  assert.ok(present.length > 0, 'the layout reader finds no dispositions where the list says');
  assert.deepEqual(
    present.filter((path) => !isDispositionFile(path)),
    []
  );
});
