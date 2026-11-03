import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import { DISPOSITION_DIRECTORY } from './autowriter-refusals.mjs';
import { BAND_FILE } from './sentence-band.mjs';

const REPO = resolve(import.meta.dirname, '..', '..');

test('this repository keeps the band, the Lighthouse record and the dispositions where the refusal list says', () => {
  assert.ok(existsSync(join(REPO, BAND_FILE)), BAND_FILE + ' is not where the repository keeps the band');
  assert.ok(
    existsSync(join(REPO, 'audits/lighthouse-green.json')),
    'the record lh:record writes is not where the list says'
  );
  assert.ok(readdirSync(join(REPO, DISPOSITION_DIRECTORY)).length > 0, 'no dispositions where the list says');
});
