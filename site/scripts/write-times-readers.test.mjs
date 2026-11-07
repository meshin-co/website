import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const SCRIPTS = import.meta.dirname;
const FIELD = 'writeTimesUtc';
const MAY_READ = [
  'engine-config-checks.mjs',
  'generate-schedule.mjs',
  'schedule-gate.mjs',
  'schedule-specimens.mjs',
  'schedule-workflow.mjs',
];
const LEAD_FIELD = 'cronLeadMinutes';
const MAY_READ_LEAD = ['generate-schedule.mjs', 'schedule-gate.mjs', 'schedule-workflow.mjs'];

const sources = (directory) =>
  readdirSync(directory).filter((file) => file.endsWith('.mjs') && !file.endsWith('.test.mjs'));

const readersOf = (directory, field = FIELD) =>
  sources(directory).filter((file) => readFileSync(join(directory, file), 'utf8').includes(field));

const strangersIn = (directory, allowed = MAY_READ, field = FIELD) =>
  readersOf(directory, field).filter((file) => !allowed.includes(file));

test("GitHub's schedule is late by minutes to hours and sometimes absent, so only the schedule modules name the configured times, and every other script takes them from schedule-workflow.mjs", () => {
  assert.deepEqual(strangersIn(SCRIPTS), []);
});

test('the check sees the schedule modules reading the times, so an empty list of readers cannot pass for a clean one', () => {
  const readers = readersOf(SCRIPTS);
  for (const file of [
    'schedule-workflow.mjs',
    'generate-schedule.mjs',
    'schedule-gate.mjs',
    'engine-config-checks.mjs',
  ]) {
    assert.ok(readers.includes(file), `${file} is not among the readers: ${readers.join(', ')}`);
  }
});

test('a script that reads the times to decide what to write is named, and a test file that only mentions them is not', () => {
  const directory = mkdtempSync(join(tmpdir(), 'write-times-readers-'));
  try {
    writeFileSync(
      join(directory, 'pick-a-slot.mjs'),
      'export const slot = (config) => config.loop.writeTimesUtc[0];\n'
    );
    writeFileSync(
      join(directory, 'schedule-workflow.mjs'),
      'export const times = (config) => config.loop.writeTimesUtc;\n'
    );
    writeFileSync(join(directory, 'something.test.mjs'), "export const note = 'writeTimesUtc';\n");
    writeFileSync(join(directory, 'unrelated.mjs'), 'export const unrelated = 1;\n');
    assert.deepEqual(strangersIn(directory), ['pick-a-slot.mjs']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the cron lead only moves the crons, so only the schedule modules name it and the slot decision never subtracts it', () => {
  assert.deepEqual(strangersIn(SCRIPTS, MAY_READ_LEAD, LEAD_FIELD), []);
});

test('the check sees the schedule modules reading the lead, so an empty list of readers cannot pass for a clean one', () => {
  const readers = readersOf(SCRIPTS, LEAD_FIELD);
  for (const file of MAY_READ_LEAD)
    assert.ok(readers.includes(file), `${file} is not among the readers: ${readers.join(', ')}`);
});

test('a slot decision that subtracts the lead from its lateness is named', () => {
  const directory = mkdtempSync(join(tmpdir(), 'write-times-readers-'));
  try {
    writeFileSync(
      join(directory, 'slot-standing.mjs'),
      'export const late = (config, minutes) => minutes - config.loop.cronLeadMinutes;\n'
    );
    writeFileSync(
      join(directory, 'schedule-workflow.mjs'),
      'export const lead = (config) => config.loop.cronLeadMinutes;\n'
    );
    assert.deepEqual(strangersIn(directory, MAY_READ_LEAD, LEAD_FIELD), ['slot-standing.mjs']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
