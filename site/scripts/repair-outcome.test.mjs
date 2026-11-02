import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ESCALATION_KINDS } from './autowriter-ledger.mjs';
import { ESCALATION_KIND, OUTCOMES, RepairStop, exitCodeOf, isOutcome } from './repair-outcome.mjs';

test('a repair ends in exactly one of seven outcomes, and the watcher reads no other word', () => {
  assert.deepEqual(OUTCOMES, [
    'repaired',
    'stale',
    'unrepairable',
    'no-convergence',
    'spend-ceiling',
    'credential',
    'failed',
  ]);
  for (const outcome of OUTCOMES) assert.equal(isOutcome(outcome), true);
  for (const word of ['', 'done', 'REPAIRED', undefined, null, 7]) assert.equal(isOutcome(word), false);
});

test('every outcome that stops the loop maps to an escalation kind the ledger knows, and only repaired and stale do not', () => {
  const unmapped = OUTCOMES.filter((outcome) => !(outcome in ESCALATION_KIND));
  assert.deepEqual(unmapped, ['repaired', 'stale']);
  for (const kind of Object.values(ESCALATION_KIND)) assert.ok(ESCALATION_KINDS.includes(kind), kind);
});

test('the three outcomes that reach Slack at once are the three immediate kinds, and nothing else is', () => {
  assert.equal(ESCALATION_KIND['no-convergence'], 'no-convergence');
  assert.equal(ESCALATION_KIND['spend-ceiling'], 'spend-ceiling');
  assert.equal(ESCALATION_KIND.credential, 'credential');
  assert.equal(ESCALATION_KIND.unrepairable, 'unrepairable');
  assert.equal(ESCALATION_KIND.failed, 'hard-stop');
});

test('a stop carries its outcome and message, and refuses a word that is not an outcome', () => {
  const stop = new RepairStop('no-convergence', 'the rule failed twice');
  assert.equal(stop.outcome, 'no-convergence');
  assert.equal(stop.message, 'the rule failed twice');
  assert.ok(stop instanceof Error);
  assert.throws(() => new RepairStop('weather', 'x'), /weather is not a repair outcome/);
  assert.throws(() => new RepairStop('repaired', 'x'), /repaired is not a stop/);
});

test('only a repaired entry exits zero, so a shell that ignores the printed outcome still stops on a failure', () => {
  assert.equal(exitCodeOf('repaired'), 0);
  for (const outcome of OUTCOMES.filter((one) => one !== 'repaired')) assert.equal(exitCodeOf(outcome), 1, outcome);
});
