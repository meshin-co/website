import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { parse } from 'yaml';

const WORKFLOW = parse(
  readFileSync(join(import.meta.dirname, '..', '..', '.github', 'workflows', 'repair-links.yml'), 'utf8')
);
const STEPS = WORKFLOW.jobs.repair.steps;
const expression = (inside) => '$' + `{{ ${inside} }}`;
const find = (pattern) => STEPS.findIndex((step) => pattern.test(step.uses ?? step.run ?? ''));
const [restoreAt, jobAt, saveAt] = [
  find(/^actions\/cache\/restore@/),
  find(/repair-links\.mjs/),
  find(/^actions\/cache\/save@/),
];
const [restore, job, save] = [STEPS[restoreAt], STEPS[jobAt], STEPS[saveAt]];

test('the count of runs is restored before the job step and saved after it, even when the job step fails', () => {
  assert.ok(restoreAt >= 0 && jobAt > restoreAt && saveAt > jobAt, JSON.stringify([restoreAt, jobAt, saveAt]));
  assert.equal(save.if, 'always()');
});

test('the job step is told the file, and the cache restores and saves exactly that file', () => {
  const file = expression('runner.temp') + '/link-rot-watch.json';

  assert.equal(job.env.REPAIR_LINKS_WATCH, file);
  assert.equal(restore.with.path, file);
  assert.equal(save.with.path, file);
});

test('every run saves under a key of its own and restores the newest one by prefix, so the count is carried from run to run', () => {
  const key = 'link-rot-watch-' + expression('github.run_id') + '-' + expression('github.run_attempt');

  assert.equal(restore.with.key, key);
  assert.equal(save.with.key, key);
  assert.equal(restore.with['restore-keys'], 'link-rot-watch-');
  assert.ok(key.startsWith(restore.with['restore-keys']));
});

test('the cache steps are pinned the way the other workflows pin their actions: one major tag', () => {
  assert.match(restore.uses, /^actions\/cache\/restore@v4$/);
  assert.match(save.uses, /^actions\/cache\/save@v4$/);
});

test('the summary of the run is still the last line of what the job step printed, so the lines about the watch come before it', () => {
  assert.match(job.run, /tail -n 1 "\$RUNNER_TEMP\/repair-links\.txt"/);
});

test('the workflow still runs the job only on main, and still holds no write permission', () => {
  assert.equal(WORKFLOW.jobs.repair.if, "github.ref == 'refs/heads/main' && needs.configured.outputs.ready == 'true'");
  assert.deepEqual(WORKFLOW.jobs.repair.permissions, { contents: 'read' });
});
