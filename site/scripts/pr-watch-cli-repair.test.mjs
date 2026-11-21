import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseArguments } from './pr-watch-arguments.mjs';
import { runCli } from './pr-watch.mjs';
import { OUTCOMES } from './repair-outcome.mjs';
import { green, harness, readJson } from './fixtures/pr-watch-harness.mjs';

const capture = () => {
  const lines = [];
  return { lines, io: { stdout: (line) => lines.push(line), stderr: (line) => lines.push(line) } };
};

const options = ({ env, io, fetch, now, workdir }) => ({ env, io, fetch, now, workdir });

test('the flag after-repair carries the line the repair printed, and its outcome is one of the outcomes there are', () => {
  for (const outcome of OUTCOMES) {
    assert.deepEqual(parseArguments(['--pr', '72', '--after-repair', JSON.stringify({ outcome })]), {
      number: 72,
      observed: '',
      afterRepair: outcome,
      report: {},
    });
  }
});

test('without the flag the arguments carry no member for it, so a plain judgement is never read as one after a repair', () => {
  assert.equal('afterRepair' in parseArguments(['--pr', '72']), false);
  assert.equal('afterRepair' in parseArguments(['--pr', '72', '--observed', 'x']), false);
});

test('a word that is not an outcome after the flag is a usage error naming the outcomes there are', () => {
  for (const word of [
    'fixed',
    '',
    'Repaired',
    ' repaired',
    'repaired ',
    'repaired;id',
    '$(id)',
    'no_convergence',
    '--pr',
  ]) {
    assert.throws(
      () => parseArguments(['--pr', '72', '--after-repair', word]),
      (error) => /usage/i.test(error.message) && OUTCOMES.every((outcome) => error.message.includes(outcome)),
      JSON.stringify(word)
    );
  }
});

test('the flag without a word after it is a usage error', () => {
  assert.throws(() => parseArguments(['--pr', '72', '--after-repair']), /usage/i);
});

test('an observation beside an outcome is read and then left unused, because the successor judges the new head', () => {
  const line = JSON.stringify({ outcome: 'stale' });
  assert.deepEqual(parseArguments(['--pr', '72', '--observed', 'x', '--after-repair', line]), {
    number: 72,
    observed: 'x',
    afterRepair: 'stale',
    report: {},
  });
});

test('the command line exits 2 on a word that is not an outcome, and touches nothing', async () => {
  const scene = await harness({ bundle: green() });
  const { lines, io } = capture();

  assert.equal(await runCli(['--pr', '72', '--after-repair', 'fixed'], { ...io, ...options(scene) }), 2);
  assert.deepEqual(scene.calls, []);
  assert.ok(lines.some((line) => /usage/i.test(line)));
});

test('the command line prints the verdict, the reason and the action after a repair, as it does after a judgement', async () => {
  const scene = await harness({ bundle: green() });
  const { lines, io } = capture();

  const line = JSON.stringify({ outcome: 'repaired' });
  assert.equal(await runCli(['--pr', '72', '--after-repair', line], { ...io, ...options(scene) }), 0);
  assert.deepEqual(lines, ['pr-watch: pull request #72 unsettled (repaired), successor']);
});

test('the command line prints the escalation after a repair that stopped, and exits 0 when it was delivered', async () => {
  const scene = await harness({ bundle: green() });
  const { lines, io } = capture();

  const line = JSON.stringify({ outcome: 'no-convergence' });
  assert.equal(await runCli(['--pr', '72', '--after-repair', line], { ...io, ...options(scene) }), 0);
  assert.deepEqual(lines, ['pr-watch: pull request #72 escalate (no-convergence), escalated']);
  assert.equal(readJson(scene.ledgerPath).escalations[0].kind, 'no-convergence');
});

test('the escalation after an unrepairable stop carries why the repair gave up, so the ledger can tell a stale verdict from a live one', async () => {
  const scene = await harness({ bundle: green() });
  const { io } = capture();
  const measuredMain = 'd'.repeat(40);
  const line = JSON.stringify({
    outcome: 'unrepairable',
    stop: 'no-artifact',
    gate: 'gate:orphans',
    ciRun: 44671747275,
    measuredMain,
  });

  assert.equal(await runCli(['--pr', '72', '--after-repair', line], { ...io, ...options(scene) }), 0);
  const [escalation] = readJson(scene.ledgerPath).escalations;
  assert.deepEqual(
    { stop: escalation.stop, gate: escalation.gate, ciRun: escalation.ciRun, measuredMain: escalation.measuredMain },
    { stop: 'no-artifact', gate: 'gate:orphans', ciRun: 44671747275, measuredMain }
  );
  assert.match(escalation.detail, /^Stop: no-artifact at gate:orphans$/m);
});

test('the command line exits 1 when the escalation after a repair was not delivered, and says so', async () => {
  const scene = await harness({ bundle: green(), slack: false });
  const { lines, io } = capture();

  const line = JSON.stringify({ outcome: 'spend-ceiling' });
  assert.equal(await runCli(['--pr', '72', '--after-repair', line], { ...io, ...options(scene) }), 1);
  assert.ok(
    lines.some((line) => line.includes('was not delivered')),
    lines.join('\n')
  );
});
