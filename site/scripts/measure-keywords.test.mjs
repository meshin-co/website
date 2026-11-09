import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { parse } from 'yaml';

const workflow = (file) =>
  parse(readFileSync(join(import.meta.dirname, '..', '..', '.github', 'workflows', file), 'utf8'));

const DAILY = workflow('write-daily.yml');
const WEEKLY = workflow('measure-keywords.yml');

const KEY = 'BING_WEBMASTER_API_KEY';
const REPORT = 'audits/keyword-demand.md';

const stepsOf = (definition) => Object.values(definition.jobs).flatMap(({ steps = [] }) => steps);
const named = (definition, text) => stepsOf(definition).find(({ name = '' }) => name.startsWith(text));

test('the day that writes an article never asks Bing anything, so Bing can never stop it', () => {
  const daily = JSON.stringify(DAILY);
  assert.ok(!daily.includes(KEY), `write-daily.yml names ${KEY}`);
  assert.ok(!daily.includes('audit:keywords'), 'write-daily.yml runs the keyword audit');
  assert.ok(!daily.includes(REPORT), `write-daily.yml touches ${REPORT}`);
});

test('the keyword measurement runs once a week on its own', () => {
  const crons = WEEKLY.on.schedule.map(({ cron }) => cron);
  assert.equal(crons.length, 1);
  const [, , dayOfMonth, month, dayOfWeek] = crons[0].split(' ');
  assert.equal(dayOfMonth, '*');
  assert.equal(month, '*');
  assert.match(dayOfWeek, /^[0-6]$/);
  assert.ok('workflow_dispatch' in WEEKLY.on, 'a person cannot start it by hand');
});

test('the key reaches the measurement through the environment, never through the command', () => {
  const measure = named(WEEKLY, 'price every phrase');
  assert.equal(measure.env[KEY], `\${{ secrets.${KEY} }}`);
  assert.ok(!measure.run.includes(KEY), 'the key is interpolated into the shell');
  assert.ok(!measure.run.includes('secrets.'), 'a secret is interpolated into the shell');
});

test('the measurement commits the report, because the next run reads it as its cache', () => {
  const commit = named(WEEKLY, 'commit the report');
  assert.ok(commit.run.includes(`--path ${REPORT}`), `the commit step does not name ${REPORT}`);
});

test('a repository without the key reports green and measures nothing', () => {
  const { steps } = WEEKLY.jobs.configured;
  const [check] = steps;
  assert.ok(check.env.MISSING.includes(KEY), 'the preflight does not look for the key');
  assert.ok(check.run.includes('ready=false'), 'the preflight cannot report itself unready');
  assert.ok(WEEKLY.jobs.measure.if.includes("needs.configured.outputs.ready == 'true'"));
});
