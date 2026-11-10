import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import { anchorsFor } from './engine-anchors.mjs';
import { readEngineConfig } from './engine-config.mjs';

const REPOSITORY = resolve(import.meta.dirname, '..', '..');
const anchors = anchorsFor(readEngineConfig());

test('every anchor exists in this repository, so the list describes the real engine', () => {
  for (const { path, kind } of anchors) {
    const target = join(REPOSITORY, path);
    assert.ok(existsSync(target), `${path} is listed and absent`);
    assert.equal(statSync(target).isDirectory(), kind === 'directory', path);
  }
});
