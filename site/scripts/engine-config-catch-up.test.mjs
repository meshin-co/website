import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { ENGINE_CONFIG_FILE, inspectEngineConfig, readEngineConfig } from './engine-config.mjs';

const REAL = JSON.parse(readFileSync(ENGINE_CONFIG_FILE, 'utf8'));

const inspectedLoop = (changes) => inspectEngineConfig(JSON.stringify({ ...REAL, loop: { ...REAL.loop, ...changes } }));

test('the shipped configuration retries a slot two and four hours late, and what it returns cannot be changed', () => {
  const { catchUpAfterMinutes } = readEngineConfig().loop;
  assert.deepEqual(catchUpAfterMinutes, [120, 240]);
  assert.throws(() => catchUpAfterMinutes.push(60), TypeError);
});

test('the key is required, so a configuration that forgot it is refused and not run without catch-up', () => {
  const { catchUpAfterMinutes, ...rest } = REAL.loop;
  assert.ok(catchUpAfterMinutes);
  const { config, problems } = inspectEngineConfig(JSON.stringify({ ...REAL, loop: rest }));
  assert.equal(config, null);
  assert.deepEqual(problems, [{ path: '$.loop.catchUpAfterMinutes', problem: 'is required' }]);
});

test('an empty list turns catch-up off and is accepted, because the writer still runs at its times', () => {
  assert.deepEqual(inspectedLoop({ catchUpAfterMinutes: [] }).problems, []);
});

for (const [value, path] of [
  [[0], '$.loop.catchUpAfterMinutes[0]'],
  [[120, 1440], '$.loop.catchUpAfterMinutes[1]'],
  [[90.5], '$.loop.catchUpAfterMinutes[0]'],
  [['120'], '$.loop.catchUpAfterMinutes[0]'],
]) {
  test(`catchUpAfterMinutes set to ${JSON.stringify(value)} is refused at ${path}`, () => {
    const { config, problems } = inspectedLoop({ catchUpAfterMinutes: value });
    assert.equal(config, null);
    assert.deepEqual(
      problems.map((found) => found.path),
      [path]
    );
  });
}

test('a delay named twice is refused, because it would write one cron minute twice', () => {
  const { config, problems } = inspectedLoop({ catchUpAfterMinutes: [120, 240, 120] });
  assert.equal(config, null);
  assert.equal(problems.length, 1);
  assert.deepEqual(problems, [{ path: '$.loop.catchUpAfterMinutes', problem: 'must have unique items' }]);
});

test('a delay that carries a slot past midnight is refused, because the slot no longer counts the next day', () => {
  const { config, problems } = inspectedLoop({ writeTimesUtc: ['03:17', '23:17'], catchUpAfterMinutes: [120] });
  assert.equal(config, null);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].path, '$.loop.catchUpAfterMinutes[0]');
  assert.match(problems[0].problem, /^120 minutes after 23:17 is 01:17 the next day/);
});

test('a catch-up that lands on a write time is refused, so one cron minute never has two meanings', () => {
  const { config, problems } = inspectedLoop({ writeTimesUtc: ['03:17', '05:17'], catchUpAfterMinutes: [120] });
  assert.equal(config, null);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].path, '$.loop.catchUpAfterMinutes[0]');
  assert.match(problems[0].problem, /^120 minutes after 03:17 is 05:17, which is a write time/);
});

test('two catch-ups that land on one minute are refused, naming both slots', () => {
  const { config, problems } = inspectedLoop({
    writeTimesUtc: ['03:17', '04:47'],
    catchUpAfterMinutes: [30, 120],
  });
  assert.equal(config, null);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].path, '$.loop.catchUpAfterMinutes[1]');
  assert.match(problems[0].problem, /^120 minutes after 03:17 is 05:17, which 30 minutes after 04:47 already is/);
});

test('a configuration the checks accept: three slots, two delays, every catch-up on its own minute', () => {
  const { problems } = inspectedLoop({
    writeTimesUtc: ['03:17', '11:17', '19:17'],
    catchUpAfterMinutes: [60, 180],
  });
  assert.deepEqual(problems, []);
});
