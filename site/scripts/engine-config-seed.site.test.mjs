import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { inspectEngineConfig } from './engine-config.mjs';

const SEED = fileURLToPath(new URL('../../seed/site/engine.config.json.seed', import.meta.url));

test('the seeded engine configuration defines every value the engine requires, so a copy starts with none unset', () => {
  assert.deepEqual(inspectEngineConfig(readFileSync(SEED, 'utf8')).problems, []);
});

test('the seeded configuration starts a new site on one run a day, each cron at its time, and no category rotation', () => {
  const { config } = inspectEngineConfig(readFileSync(SEED, 'utf8'));
  assert.deepEqual(config.loop.writeTimesUtc, ['03:17']);
  assert.equal(config.loop.cronLeadMinutes, 0);
  assert.deepEqual(config.loop.categoryRotation, []);
});
