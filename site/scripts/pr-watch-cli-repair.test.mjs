import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseArguments, runCli } from './pr-watch.mjs';
import { OUTCOMES } from './repair-outcome.mjs';
import { green, harness, readJson } from './fixtures/pr-watch-harness.mjs';

const capture = () => {
  const lines = [];
  return { lines, io: { stdout: (line) => lines.push(line), stderr: (line) => lines.push(line) } };
};

const options = ({ env, io, fetch, now, workdir }) => ({ env, io, fetch, now, workdir });

test('the flag after-repair carries the outcome of the repair the workflow just ran, for each outcome there is', () => {
  for (const outcome of OUTCOMES) {
    assert.deepEqual(parseArguments(['--pr', '72', '--after-repair', outcome]), {
      number: 72,
      observed: '',
      afterRepair: outcome,
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
  assert.deepEqual(parseArguments(['--pr', '72', '--observed', 'x', '--after-repair', 'stale']), {
    number: 72,
    observed: 'x',
    afterRepair: 'stale',
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

  assert.equal(await runCli(['--pr', '72', '--after-repair', 'repaired'], { ...io, ...options(scene) }), 0);
  assert.deepEqual(lines, ['pr-watch: pull request #72 unsettled (repaired), successor']);
});

test('the command line prints the escalation after a repair that stopped, and exits 0 when it was delivered', async () => {
  const scene = await harness({ bundle: green() });
  const { lines, io } = capture();

  assert.equal(await runCli(['--pr', '72', '--after-repair', 'no-convergence'], { ...io, ...options(scene) }), 0);
  assert.deepEqual(lines, ['pr-watch: pull request #72 escalate (no-convergence), escalated']);
  assert.equal(readJson(scene.ledgerPath).escalations[0].kind, 'no-convergence');
});

test('the command line exits 1 when the escalation after a repair was not delivered, and says so', async () => {
  const scene = await harness({ bundle: green(), slack: false });
  const { lines, io } = capture();

  assert.equal(await runCli(['--pr', '72', '--after-repair', 'spend-ceiling'], { ...io, ...options(scene) }), 1);
  assert.ok(
    lines.some((line) => line.includes('was not delivered')),
    lines.join('\n')
  );
});
