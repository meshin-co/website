import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, test } from 'node:test';

import { parse } from 'yaml';

import { SCHEDULE_COMMENT, WRITE_DAILY_PATH, withSchedule } from './schedule-workflow.mjs';

const SCRIPTS = import.meta.dirname;
const SITE = resolve(SCRIPTS, '..');
const REPOSITORY = resolve(SITE, '..');
const GATE = join(SCRIPTS, 'schedule-gate.mjs');
const GENERATOR = join(SCRIPTS, 'generate-schedule.mjs');
const CONFIG = JSON.parse(readFileSync(join(SITE, 'engine.config.json'), 'utf8'));
const TIMES = ['03:17', '15:17'];
const DELAYS = CONFIG.loop.catchUpAfterMinutes;
const ENTRY_COUNT = CONFIG.loop.writeTimesUtc.length * (DELAYS.length + 1);

function withFirstTwoEntriesSwapped(workflow) {
  const lines = workflow.split('\n');
  const first = lines.findIndex((line) => line.trimStart().startsWith('- cron:'));
  const swapped = [...lines];
  [swapped[first], swapped[first + 1]] = [swapped[first + 1], swapped[first]];
  return swapped.join('\n');
}
const GENERATED = withSchedule(readFileSync(join(REPOSITORY, WRITE_DAILY_PATH), 'utf8'), TIMES, DELAYS);
const PACKAGE = JSON.parse(readFileSync(join(SITE, 'package.json'), 'utf8'));
const CI = parse(readFileSync(join(REPOSITORY, '.github', 'workflows', 'ci.yml'), 'utf8'));
const FILE = '\\.github/workflows/write-daily\\.yml';
const FIX = 'run npm run assets:schedule to write it again from loop\\.writeTimesUtc';

const roots = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

function scene({ times = TIMES, delays = DELAYS, lead = 0, workflow = GENERATED } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'schedule-gate-'));
  roots.push(root);
  const put = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const loop = { ...CONFIG.loop, writeTimesUtc: times, catchUpAfterMinutes: delays, cronLeadMinutes: lead };
  put('site/engine.config.json', JSON.stringify({ ...CONFIG, loop }, null, 2));
  if (workflow !== null) put(WRITE_DAILY_PATH, workflow);
  return root;
}

const gate = (...args) => spawnSync(process.execPath, [GATE, ...args], { encoding: 'utf8' });
const findingsOf = ({ stderr }) => stderr.split('\n').filter(Boolean);

test('the schedule of this repository is the one its configuration generates, and the gate prints no finding', () => {
  const configured = CONFIG.loop.writeTimesUtc.join(', ');
  const result = gate();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(
    result.stdout,
    `schedule: 0 findings (${WRITE_DAILY_PATH} starts the writer for ${configured} UTC, the times of loop.writeTimesUtc, and tries each slot again ${DELAYS.join(', ')} minutes later, the delays of loop.catchUpAfterMinutes, with every cron entry set ${CONFIG.loop.cronLeadMinutes} minutes before its time, the lead of loop.cronLeadMinutes)\n`
  );
});

test('a generated workflow passes whatever the configured times and lead are', () => {
  for (const times of [['00:00'], ['23:59'], ['05:30', '17:45', '09:05']]) {
    for (const lead of [0, 440, 1439]) {
      const workflow = withSchedule(GENERATED, times, [], lead);
      const result = gate('--root', scene({ times, delays: [], lead, workflow }));
      assert.equal(result.status, 0, `${times.join(' ')} with a lead of ${lead}: ${result.stderr}`);
    }
  }
});

const SECOND = "    - cron: '17 15 * * *'";
const HAND_EDITS = [
  ['a cron line edited by hand', GENERATED.replace("'17 3 * * *'", "'17 4 * * *'"), 'cron-differs'],
  ['an extra cron entry added', GENERATED.replace(SECOND, `${SECOND}\n    - cron: '17 21 * * *'`), 'cron-extra'],
  ['a cron entry removed', GENERATED.replace(`${SECOND}\n`, ''), 'cron-missing'],
  ['the entries put in the wrong order', withFirstTwoEntriesSwapped(GENERATED), 'cron-order'],
  [
    'the schedule block deleted',
    GENERATED.replace(/ {2}schedule:[^]*?(?= {2}workflow_dispatch:)/, ''),
    'schedule-missing',
  ],
  [
    'the schedule block present twice',
    GENERATED.replace('  workflow_dispatch:', "  schedule:\n    - cron: '0 6 * * 1'\n  workflow_dispatch:"),
    'schedule-twice',
  ],
  ['the generated comment edited away', GENERATED.replace(SCHEDULE_COMMENT, '# a note'), 'schedule-block-differs'],
];

for (const [label, workflow, rule] of HAND_EDITS) {
  test(`${label} fails the gate with exit 1 and a ${rule} finding on stderr that names the fix`, () => {
    assert.notEqual(workflow, GENERATED);
    const result = gate('--root', scene({ workflow }));
    assert.equal(result.status, 1, result.stdout);
    const lines = findingsOf(result);
    assert.equal(lines.length, 1, result.stderr);
    assert.match(lines[0], new RegExp(`^SCHEDULE ${rule} ${FILE}: .*; ${FIX}$`));
    assert.match(
      result.stdout,
      /^schedule: 1 finding \(.*write-daily\.yml must hold the schedule npm run assets:schedule writes from loop\.writeTimesUtc, loop\.catchUpAfterMinutes and loop\.cronLeadMinutes\)\n$/
    );
  });
}

test('a hand-edited cron line is printed with its line, its text and the text the configuration gives', () => {
  const line = GENERATED.split('\n').findIndex((text) => text.includes("'17 3 * * *'")) + 1;
  const result = gate('--root', scene({ workflow: GENERATED.replace("'17 3 * * *'", "'17 4 * * *'") }));
  const holds = `line ${line} holds "17 4 \\* \\* \\*", but loop\\.writeTimesUtc gives "17 3 \\* \\* \\*" for 03:17;`;
  assert.match(findingsOf(result)[0], new RegExp(`^SCHEDULE cron-differs ${FILE}: ${holds}`));
});

test('a changed configuration with a workflow nobody regenerated fails, and regenerating it makes the gate pass', () => {
  const root = scene({ times: ['05:30', '17:45'] });
  const outdated = gate('--root', root);
  assert.equal(outdated.status, 1);
  assert.deepEqual(
    findingsOf(outdated).map((line) => line.split(' ')[1]),
    Array(ENTRY_COUNT).fill('cron-differs')
  );
  const generated = spawnSync(process.execPath, [GENERATOR, '--root', root], { encoding: 'utf8' });
  assert.equal(generated.status, 0, generated.stderr);
  const fixed = gate('--root', root);
  assert.equal(fixed.status, 0, fixed.stderr);
  assert.match(fixed.stdout, /starts the writer for 05:30, 17:45 UTC/);
});

test('a configuration with a lead and a workflow nobody regenerated fails on every entry, and regenerating it makes the gate pass', () => {
  const root = scene({ lead: 95 });
  const outdated = gate('--root', root);
  assert.equal(outdated.status, 1);
  assert.deepEqual(
    findingsOf(outdated).map((line) => line.split(' ')[1]),
    Array(ENTRY_COUNT).fill('cron-differs')
  );
  const generated = spawnSync(process.execPath, [GENERATOR, '--root', root], { encoding: 'utf8' });
  assert.equal(generated.status, 0, generated.stderr);
  const fixed = gate('--root', root);
  assert.equal(fixed.status, 0, fixed.stderr);
  assert.match(
    fixed.stdout,
    /, with every cron entry set 95 minutes before its time, the lead of loop\.cronLeadMinutes\)\n$/
  );
});

test('a lead of 0 is not mentioned in the summary, because the cron entries then sit at their times', () => {
  const result = gate('--root', scene());
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout,
    `schedule: 0 findings (${WRITE_DAILY_PATH} starts the writer for ${TIMES.join(', ')} UTC, the times of loop.writeTimesUtc, and tries each slot again ${DELAYS.join(', ')} minutes later, the delays of loop.catchUpAfterMinutes)\n`
  );
});

test('every problem is printed, so one run shows everything a hand edit changed', () => {
  const workflow = GENERATED.replace("'17 3 * * *'", "'17 4 * * *'").replace("'17 15 * * *'", "'17 16 * * *'");
  const result = gate('--root', scene({ workflow }));
  assert.equal(findingsOf(result).length, 2);
  assert.match(result.stdout, /^schedule: 2 findings /);
});

test('an empty schedule list is a configuration finding that says how to pause the writer, and not a crash', () => {
  const result = gate('--root', scene({ times: [] }));
  assert.equal(result.status, 1);
  const [line, ...others] = findingsOf(result);
  assert.deepEqual(others, []);
  assert.match(
    line,
    /^SCHEDULE config-invalid site\/engine\.config\.json: .*loop\.writeTimesUtc lists no time.*pause the writer/
  );
  assert.doesNotMatch(result.stderr, /at .*\.mjs:\d+/);
});

test('a malformed time is a configuration finding that names the value and its position', () => {
  const result = gate('--root', scene({ times: ['03:17', '3:5'] }));
  assert.equal(result.status, 1);
  assert.match(
    findingsOf(result)[0],
    /^SCHEDULE config-invalid site\/engine\.config\.json: .*loop\.writeTimesUtc\[1\] "3:5" is not a time of day/
  );
});

test('a repository with no write-daily workflow is a finding, not a crash', () => {
  const result = gate('--root', scene({ workflow: null }));
  assert.equal(result.status, 1);
  assert.match(findingsOf(result)[0], new RegExp(`^SCHEDULE workflow-missing ${FILE}: `));
});

test('a repository with no engine configuration is a finding that names the file', () => {
  const root = scene();
  rmSync(join(root, 'site', 'engine.config.json'));
  const result = gate('--root', root);
  assert.equal(result.status, 1);
  assert.match(findingsOf(result)[0], /^SCHEDULE config-invalid site\/engine\.config\.json: /);
});

test('a flag the gate does not know, or a directory that is not there, exits 2 with the usage', () => {
  for (const args of [['--force'], ['--root'], ['--root', join(tmpdir(), 'no-such-schedule-root')], ['extra']]) {
    const result = gate(...args);
    assert.equal(result.status, 2, args.join(' '));
    assert.match(result.stderr, /usage: node scripts\/schedule-gate\.mjs \[--root <repository root>\]/);
    assert.equal(result.stdout, '');
  }
});

test('npm run gate:schedule and npm run assets:schedule sit beside their siblings, and the gate is not excused from CI', () => {
  assert.equal(PACKAGE.scripts['gate:schedule'], 'node scripts/schedule-gate.mjs');
  assert.equal(PACKAGE.scripts['assets:schedule'], 'node scripts/generate-schedule.mjs');
  assert.equal(Object.hasOwn(PACKAGE.localOnlyGates ?? {}, 'gate:schedule'), false);
  const names = Object.keys(PACKAGE.scripts);
  assert.equal(names.indexOf('gate:schedule'), names.indexOf('gate:routes') + 1);
  assert.equal(names.indexOf('assets:schedule'), names.indexOf('assets:routes') + 1);
});

test('ci.yml runs the gate in the job that runs the spec gate, so a hand edit cannot reach main', () => {
  const jobs = Object.entries(CI.jobs).filter(([, { steps = [] }]) =>
    steps.some(({ run }) => run === 'npm run gate:spec')
  );
  assert.deepEqual(
    jobs.map(([name]) => name),
    ['types-and-units']
  );
  const runs = jobs[0][1].steps.map(({ run }) => run);
  assert.equal(runs.filter((run) => run === 'npm run gate:schedule').length, 1);
});
