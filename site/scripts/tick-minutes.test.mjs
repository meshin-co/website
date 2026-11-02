import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readEngineConfig } from './engine-config.mjs';
import { TICK_MINUTES } from './pr-watch.mjs';

test('how long the watcher waits between looks is configuration, not a number in the code', () => {
  assert.equal(TICK_MINUTES, readEngineConfig().loop.tickMinutes);
});

test('the configured wait is a whole number of minutes of at least one, because GitHub counts whole minutes', () => {
  const { tickMinutes } = readEngineConfig().loop;

  assert.ok(Number.isInteger(tickMinutes), 'the wait is a whole number');
  assert.ok(tickMinutes >= 1, 'the wait is at least one minute');
});
