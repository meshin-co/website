import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, test } from 'node:test';

import { EngineConfigError } from './engine-config.mjs';
import { readPartitionFacts } from './engine-partition-facts.mjs';
import { SCENE_FILES, sceneReader } from './fixtures/partition-scene.mjs';
import { generateSchedule } from './generate-schedule.mjs';
import { WRITE_DAILY_PATH, cronPlan, scheduleFindings, withSchedule } from './schedule-workflow.mjs';

const SCRIPTS = import.meta.dirname;
const REPOSITORY = resolve(SCRIPTS, '..', '..');
const GENERATOR = join(SCRIPTS, 'generate-schedule.mjs');
const CONFIG = JSON.parse(readFileSync(join(REPOSITORY, 'site', 'engine.config.json'), 'utf8'));
const CURRENT_TIMES = CONFIG.loop.writeTimesUtc;
const CURRENT_LEAD = CONFIG.loop.cronLeadMinutes;
const DELAYS = CONFIG.loop.catchUpAfterMinutes;
const FIXTURE_DELAYS = [120, 240];
const NEW_TIMES = ['05:30', '17:45'];
const CURRENT = withSchedule(
  readFileSync(join(REPOSITORY, WRITE_DAILY_PATH), 'utf8'),
  CURRENT_TIMES,
  DELAYS,
  CURRENT_LEAD
);
const FIRST_CRON = cronPlan(CURRENT_TIMES, DELAYS, CURRENT_LEAD)[0].cron;

const roots = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

function scene({ times = NEW_TIMES, delays = DELAYS, lead = CURRENT_LEAD, workflow = CURRENT } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'generate-schedule-'));
  roots.push(root);
  const put = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const loop = { ...CONFIG.loop, writeTimesUtc: times, catchUpAfterMinutes: delays, cronLeadMinutes: lead };
  put('site/engine.config.json', JSON.stringify({ ...CONFIG, loop }, null, 2));
  if (workflow !== null) put(WRITE_DAILY_PATH, workflow);
  return { root, file: join(root, WRITE_DAILY_PATH), text: () => readFileSync(join(root, WRITE_DAILY_PATH), 'utf8') };
}

const cli = (...args) => spawnSync(process.execPath, [GENERATOR, ...args], { encoding: 'utf8' });
const rulesOf = (text, times) => scheduleFindings(text, times, DELAYS, CURRENT_LEAD).map(({ rule }) => rule);

test('the generator writes the cron entries of the configured times into the workflow and touches nothing else', () => {
  const { root, text } = scene();
  const result = generateSchedule(root);
  assert.deepEqual(result, {
    path: WRITE_DAILY_PATH,
    times: NEW_TIMES,
    catchUpAfterMinutes: DELAYS,
    cronLeadMinutes: CURRENT_LEAD,
    changed: true,
    crons: NEW_TIMES.length * (1 + DELAYS.length),
  });
  assert.deepEqual(scheduleFindings(text(), NEW_TIMES, DELAYS, CURRENT_LEAD), []);
  assert.equal(withSchedule(text(), CURRENT_TIMES, DELAYS, CURRENT_LEAD), CURRENT);
});

test('a workflow that already holds the schedule is not written again, so no file changes and no commit is made', () => {
  const { root, file, text } = scene({ times: CURRENT_TIMES });
  chmodSync(file, 0o444);
  const before = statSync(file).mtimeMs;
  assert.equal(generateSchedule(root).changed, false);
  assert.equal(text(), CURRENT);
  assert.equal(statSync(file).mtimeMs, before);
});

test('a deleted schedule block is put back, and an edited cron line is overwritten by the configured time', () => {
  const block = / {2}schedule:[^]*?(?= {2}workflow_dispatch:)/;
  const missing = scene({ workflow: CURRENT.replace(block, '') });
  assert.deepEqual(rulesOf(missing.text(), NEW_TIMES), ['schedule-missing']);
  generateSchedule(missing.root);
  assert.deepEqual(scheduleFindings(missing.text(), NEW_TIMES, DELAYS, CURRENT_LEAD), []);

  const edited = scene({ workflow: CURRENT.replace(`'${FIRST_CRON}'`, "'59 23 * * *'") });
  assert.notEqual(edited.text(), CURRENT);
  generateSchedule(edited.root);
  assert.deepEqual(scheduleFindings(edited.text(), NEW_TIMES, DELAYS, CURRENT_LEAD), []);
});

test('an unreadable configuration stops the generator before the workflow is touched, and says how to pause the writer', () => {
  const { root, text } = scene({ times: [] });
  assert.throws(
    () => generateSchedule(root),
    (error) => error instanceof EngineConfigError && /pause the writer/.test(error.message)
  );
  assert.equal(text(), CURRENT);
});

test('a workflow with no on: key stops the generator and is left exactly as it was', () => {
  const bare = 'name: Write daily\n\njobs: {}\n';
  const { root, text } = scene({ workflow: bare });
  assert.throws(() => generateSchedule(root), /no on: key/);
  assert.equal(text(), bare);
});

test('run as a script it writes, says what it wrote, and a second run says it had nothing to write', () => {
  const { root, text } = scene({ delays: FIXTURE_DELAYS, lead: 95 });
  const first = cli('--root', root);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(
    first.stdout,
    'schedule: wrote 6 cron entries into .github/workflows/write-daily.yml for 05:30, 17:45 (loop.writeTimesUtc) and 120, 240 minutes later (loop.catchUpAfterMinutes), each set 95 minutes earlier (loop.cronLeadMinutes)\n'
  );
  const written = text();
  const second = cli('--root', root);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(
    second.stdout,
    'schedule: .github/workflows/write-daily.yml already holds the cron entries for 05:30, 17:45 (loop.writeTimesUtc) and 120, 240 minutes later (loop.catchUpAfterMinutes), each set 95 minutes earlier (loop.cronLeadMinutes); nothing written\n'
  );
  assert.equal(text(), written);
});

test('run as a script it does not mention a lead of 0, so the text is the one it had before the lead existed', () => {
  const { root } = scene({ delays: FIXTURE_DELAYS, lead: 0 });
  assert.equal(
    cli('--root', root).stdout,
    'schedule: wrote 6 cron entries into .github/workflows/write-daily.yml for 05:30, 17:45 (loop.writeTimesUtc) and 120, 240 minutes later (loop.catchUpAfterMinutes)\n'
  );
});

test('a change of the lead alone rewrites the cron entries, so the workflow follows the configuration', () => {
  const otherLead = CURRENT_LEAD === 0 ? 95 : 0;
  const { root, text } = scene({ times: CURRENT_TIMES, lead: otherLead });
  const result = generateSchedule(root);
  assert.deepEqual([result.changed, result.cronLeadMinutes], [true, otherLead]);
  assert.deepEqual(scheduleFindings(text(), CURRENT_TIMES, DELAYS, otherLead), []);
  assert.equal(withSchedule(text(), CURRENT_TIMES, DELAYS, CURRENT_LEAD), CURRENT);
});

test('run as a script it says one entry in the singular', () => {
  const { root } = scene({ times: ['04:44'], delays: [] });
  assert.match(cli('--root', root).stdout, /^schedule: wrote 1 cron entry into /);
});

test('run as a script it exits 1 with the reason on stderr when the configuration or the workflow cannot be used', () => {
  const emptied = cli('--root', scene({ times: [] }).root);
  assert.equal(emptied.status, 1);
  assert.match(emptied.stderr, /^schedule: .*loop\.writeTimesUtc lists no time/);
  assert.equal(emptied.stdout, '');

  const bare = cli('--root', scene({ workflow: 'jobs: {}\n' }).root);
  assert.equal(bare.status, 1);
  assert.match(bare.stderr, /no on: key/);

  const absent = cli('--root', scene({ workflow: null }).root);
  assert.equal(absent.status, 1);
  assert.match(absent.stderr, /write-daily\.yml/);
});

test('run as a script it exits 2 with its usage for a flag it does not know and for a directory that is not there', () => {
  for (const args of [['--force'], ['--root'], ['--root', join(tmpdir(), 'no-such-schedule-root')]]) {
    const result = cli(...args);
    assert.equal(result.status, 2, args.join(' '));
    assert.match(result.stderr, /usage: node scripts\/generate-schedule\.mjs \[--root <repository root>\]/);
  }
});

test('the generator names the workflow by a variable, so the engine partition keeps the workflow an engine file', () => {
  const source = readFileSync(GENERATOR, 'utf8');
  const manifest = JSON.stringify({ scripts: { 'assets:schedule': 'node scripts/generate-schedule.mjs' } });
  const outputsOf = (text) =>
    readPartitionFacts({
      files: SCENE_FILES,
      read: sceneReader({ 'site/package.json': manifest, 'site/scripts/generate-schedule.mjs': text }),
    }).generatedOutputs;
  assert.equal(outputsOf(source).has(WRITE_DAILY_PATH), false);
  const literal = source.replace(/writeFileSync\(\w+/, `writeFileSync('../${WRITE_DAILY_PATH}'`);
  assert.notEqual(literal, source);
  assert.equal(outputsOf(literal).has(WRITE_DAILY_PATH), true);
});
