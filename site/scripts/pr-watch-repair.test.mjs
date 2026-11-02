import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { HOLD_LABEL } from './pr-classify.mjs';
import { writeOutputs } from './pr-watch-repair.mjs';
import { scenario } from './fixtures/pr-watch.mjs';
import { green, harness, ledgerRecord, queued, spentAttempts, written } from './fixtures/pr-watch-harness.mjs';

const REPAIR_FALSE = 'repair=false\n';

const repairable = () => scenario('content-gate-failure');

test('a failure the loop may repair dispatches the repair: the action is repair and nothing is escalated', async () => {
  const { run, calls, requests, ledgerPath } = await harness({ bundle: repairable() });
  const { action, result } = await run();

  assert.equal(result.verdict, 'repairable');
  assert.equal(action, 'repair');
  assert.deepEqual(written(calls), []);
  assert.deepEqual(requests, []);
  assert.equal(existsSync(ledgerPath), false);
});

test('the watcher only reads when it dispatches a repair, and checks no tick because no successor is made', async () => {
  const { run, calls } = await harness({ bundle: repairable() });
  await run();

  assert.deepEqual(
    calls.map(([name]) => name),
    ['readSnapshot']
  );
});

test('the outputs tell the workflow to repair, which head was judged and which branch holds it', async () => {
  const bundle = repairable();
  const { run, outputs } = await harness({ bundle });
  await run();

  assert.equal(
    readFileSync(outputs, 'utf8'),
    `repair=true\nhead=${bundle.pullRequest.head.sha}\nbranch=autowriter/a-slug\n`
  );
});

test('every other action tells the workflow not to repair', async () => {
  const held = { labels: [{ name: HOLD_LABEL }] };
  const cases = {
    merged: { bundle: green() },
    successor: { bundle: queued(green()) },
    escalated: { bundle: scenario('cancel-storm') },
    stopped: { bundle: green(), pullRequestPatch: held },
  };
  for (const [expected, options] of Object.entries(cases)) {
    const { run, outputs } = await harness(options);
    const { action } = await run();

    assert.equal(action, expected);
    assert.equal(readFileSync(outputs, 'utf8'), REPAIR_FALSE, expected);
  }
});

test('an action that fails tells the workflow not to repair either', async () => {
  const { run, outputs } = await harness({ bundle: queued(green()), tick: 'the tick has no wait timer' });

  await assert.rejects(run(), /no wait timer/);
  assert.equal(readFileSync(outputs, 'utf8'), REPAIR_FALSE);
});

test('a failing gate on a pull request a person holds is not repaired', async () => {
  const { run, outputs } = await harness({
    bundle: repairable(),
    pullRequestPatch: { labels: [{ name: HOLD_LABEL }] },
  });
  const { action } = await run();

  assert.equal(action, 'stopped');
  assert.equal(readFileSync(outputs, 'utf8'), REPAIR_FALSE);
});

test('a failing gate with the attempt cap spent is escalated, not repaired a fourth time', async () => {
  const ledger = ledgerRecord({ attempts: spentAttempts });
  const { run, outputs, ledgerPath } = await harness({ bundle: repairable(), ledger });
  const { action, result } = await run();

  assert.equal(result.reason, 'attempt-cap');
  assert.equal(action, 'escalated');
  assert.equal(readFileSync(outputs, 'utf8'), REPAIR_FALSE);
  assert.equal(existsSync(ledgerPath), true);
});

test('no outputs are written when the run has nowhere to write them', async () => {
  const { run, outputs, env } = await harness({ bundle: repairable() });
  delete env.GITHUB_OUTPUT;
  const { action } = await run();

  assert.equal(action, 'repair');
  assert.equal(readFileSync(outputs, 'utf8'), '');
});

test('the step summary names the repair as the action', async () => {
  const { run, summary } = await harness({ bundle: repairable() });
  await run();

  assert.match(readFileSync(summary, 'utf8'), /\| Action \| `repair` \|/);
});

test("an output value with a line break is refused, because it would write a second output of the attacker's choosing", async () => {
  const directory = await mkdtemp(join(tmpdir(), 'outputs-'));
  const target = join(directory, 'outputs.txt');
  await writeFile(target, '');

  assert.throws(
    () => writeOutputs({ GITHUB_OUTPUT: target }, { repair: 'true', branch: 'autowriter/a\nrepair=false' }),
    /branch.*line break/
  );
  assert.equal(readFileSync(target, 'utf8'), '');
});

test('outputs are appended after what earlier steps wrote, one name=value per line', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'outputs-'));
  const target = join(directory, 'outputs.txt');
  await writeFile(target, 'earlier=1\n');

  writeOutputs({ GITHUB_OUTPUT: target }, { repair: 'false' });

  assert.equal(readFileSync(target, 'utf8'), 'earlier=1\nrepair=false\n');
});
