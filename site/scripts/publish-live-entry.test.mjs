import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import { parse } from 'yaml';

const WORKFLOW = parse(
  readFileSync(resolve(import.meta.dirname, '..', '..', '.github', 'workflows', 'publish-live.yml'), 'utf8')
);
const { steps } = WORKFLOW.jobs.publish;
const COMMAND = 'node scripts/live-entry.mjs --dist dist --state .live-entries.json';
const STATE = 'site/.live-entries.json';
const KEY = 'live-entries-${{ github.run_id }}';

const stepRunning = (text) => steps.find(({ run = '' }) => run.includes(text));
const stepUsing = (action) => steps.filter(({ uses = '' }) => uses === action);
const positionOf = (step) => steps.indexOf(step);
const announce = stepRunning('scripts/live-entry.mjs');
const [restore] = stepUsing('actions/cache/restore@v4').filter(({ with: inputs }) => inputs.path === STATE);
const [save] = stepUsing('actions/cache/save@v4').filter(({ with: inputs }) => inputs.path === STATE);

test('exactly one step runs the live entry command, with the build and the state file and nothing else', () => {
  assert.equal(steps.filter(({ run = '' }) => run.includes('live-entry')).length, 1);
  assert.equal(announce.run.trim(), COMMAND);
});

test('the step gets the Slack webhook from secrets and no other secret or variable', () => {
  assert.deepEqual(announce.env, { SLACK_WEBHOOK_URL: '${{ secrets.SLACK_WEBHOOK_URL }}' });
});

test('the step runs after the deploy and the smoke of the live origin, so the check follows what it checks', () => {
  assert.ok(positionOf(announce) > positionOf(stepRunning('npm run deploy')));
  assert.ok(positionOf(announce) > positionOf(stepRunning('npm run smoke:prod')));
});

test('the step does not depend on the indexnow step: it runs first, and a failure of its own skips nothing after it', () => {
  assert.ok(positionOf(announce) < positionOf(stepRunning('scripts/indexnow-ping.mjs')));
  assert.equal(announce['continue-on-error'], true);
  assert.equal(announce.if, undefined);
});

test('the announced entries are restored before the step and saved by the next step, under a key of this run', () => {
  assert.equal(restore.with.key, KEY);
  assert.equal(restore.with['restore-keys'], 'live-entries-');
  assert.equal(save.with.key, KEY);
  assert.equal(positionOf(restore) < positionOf(announce), true);
  assert.equal(positionOf(save), positionOf(announce) + 1);
});

test('the memory of announced entries is never saved by a step that waits for the end of the job', () => {
  const combined = stepUsing('actions/cache@v4').filter(({ with: inputs }) => inputs.path === STATE);
  assert.deepEqual(combined, []);
  assert.equal(save.if, undefined);
});
