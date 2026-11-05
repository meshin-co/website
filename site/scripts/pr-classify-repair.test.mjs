import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HOLD_LABEL, classifyAfterRepair, classifyHandling, classifyPullRequest } from './pr-classify.mjs';
import { ESCALATION_KIND, OUTCOMES } from './repair-outcome.mjs';
import {
  classify,
  decided,
  green,
  human,
  lastCommitBy,
  ledgerWith,
  openPullRequest,
} from './fixtures/pr-classify-helpers.mjs';
import { asInput, withNoChecksAtAll } from './fixtures/pr-watch.mjs';

const STOPS = OUTCOMES.filter((outcome) => !['repaired', 'stale'].includes(outcome));
const OTHER_HEAD = 'c'.repeat(40);

const inputOf = (bundle, { patch = {}, commits, ledger = null } = {}) => {
  const input = asInput(bundle);
  return {
    pullRequest: { ...openPullRequest(bundle), ...patch },
    commits: commits ?? input.commits,
    ledger,
  };
};

const handling = (bundle, options) => classifyHandling(inputOf(bundle, options));
const afterRepair = (bundle, outcome, options) => classifyAfterRepair({ ...inputOf(bundle, options), outcome });

const GUARDS = {
  'a merged pull request': [{ patch: { merged: true, state: 'closed' } }, 'done', 'merged'],
  'a closed pull request': [{ patch: { state: 'closed' } }, 'blocked-by-human', 'closed'],
  'a draft': [{ patch: { draft: true } }, 'blocked-by-human', 'draft'],
  'the hold label': [{ patch: { labels: [{ name: HOLD_LABEL }] } }, 'blocked-by-human', 'hold-label'],
  'a branch outside the prefix': [
    { patch: { head: { ...openPullRequest(green()).head, ref: 'feat/by-hand' } } },
    'blocked-by-human',
    'foreign-branch',
  ],
  'a ledger a person decided': [{ ledger: ledgerWith(0, decided('stopped')) }, 'done', 'ledger-decided'],
};

const humanCommit = () => ({ commits: lastCommitBy(green(), human) });
const lagging = () => ({ patch: { head: { ...openPullRequest(green()).head, sha: OTHER_HEAD } } });

test('a pull request nobody has taken over has no handling verdict, with or without a ledger', () => {
  assert.equal(handling(green()), null);
  assert.equal(handling(green(), { ledger: ledgerWith(1) }), null);
});

test('the handling guards answer exactly what the full classification answers for the same pull request', () => {
  const cases = { ...GUARDS, 'a commit by a person': humanCommit(), 'a lagging commit list': lagging() };
  for (const [name, entry] of Object.entries(cases)) {
    const options = Array.isArray(entry) ? entry[0] : entry;
    const guarded = handling(green(), options);
    const input = inputOf(green(), options);

    assert.notEqual(guarded, null, name);
    assert.deepEqual(classifyPullRequest({ ...asInput(green()), ...input }), guarded, name);
  }
});

test('a commit by a person is handling, with the commit named', () => {
  const found = handling(green(), humanCommit());

  assert.equal(found.verdict, 'blocked-by-human');
  assert.equal(found.reason, 'human-commit');
  assert.equal(found.evidence.author, human.email);
});

test('a commit list that does not end at the head is the unsettled stale head, never a judgement on who pushed', () => {
  const found = handling(green(), lagging());

  assert.equal(found.verdict, 'unsettled');
  assert.equal(found.reason, 'stale-head');
});

test('a repair that ended as repaired or stale hands the pull request to a successor, with nothing observed', () => {
  for (const outcome of ['repaired', 'stale']) {
    const found = afterRepair(green(), outcome);

    assert.equal(found.verdict, 'unsettled', outcome);
    assert.equal(found.reason, outcome);
    assert.equal(found.kind, null);
    assert.equal(found.observe, '');
    assert.deepEqual(found.evidence, { head: openPullRequest(green()).head.sha, pullRequest: 72 });
  }
});

test('every other outcome is an escalation of the kind the loop files that outcome under', () => {
  assert.deepEqual(STOPS.toSorted(), [
    'conflict',
    'credential',
    'failed',
    'no-convergence',
    'spend-ceiling',
    'unconverged',
    'unrepairable',
  ]);
  for (const outcome of STOPS) {
    const found = afterRepair(green(), outcome);

    assert.equal(found.verdict, 'escalate', outcome);
    assert.equal(found.reason, outcome);
    assert.equal(found.kind, ESCALATION_KIND[outcome]);
    assert.equal(found.observe, '');
  }
});

test('every verdict after a repair has the five members a verdict has, and no more', () => {
  for (const outcome of OUTCOMES) {
    assert.deepEqual(Object.keys(afterRepair(green(), outcome)).sort(), [
      'evidence',
      'kind',
      'observe',
      'reason',
      'verdict',
    ]);
  }
});

test('a person who owns the pull request outranks every outcome, so nothing is escalated or chained', () => {
  for (const [name, [options, verdict, reason]] of Object.entries(GUARDS)) {
    for (const outcome of OUTCOMES) {
      const found = afterRepair(green(), outcome, options);

      assert.equal(found.verdict, verdict, `${name} after ${outcome}`);
      assert.equal(found.reason, reason, `${name} after ${outcome}`);
    }
  }
  for (const outcome of OUTCOMES) {
    assert.equal(afterRepair(green(), outcome, humanCommit()).reason, 'human-commit', outcome);
  }
});

test('a commit list that has not caught up with the push is ignored, because the API lags a moment behind a push', () => {
  for (const outcome of OUTCOMES) {
    const found = afterRepair(green(), outcome, lagging());

    assert.notEqual(found.reason, 'stale-head', outcome);
    assert.equal(found.reason, outcome);
  }
});

test('a commit list that has not caught up still shows a commit by a person, and the person owns the pull request', () => {
  for (const outcome of OUTCOMES) {
    const found = afterRepair(green(), outcome, { ...lagging(), ...humanCommit() });

    assert.equal(found.verdict, 'blocked-by-human', outcome);
    assert.equal(found.reason, 'human-commit', outcome);
  }
});

test('a commit list that has not caught up still shows a decision a person recorded in the ledger', () => {
  for (const outcome of OUTCOMES) {
    const found = afterRepair(green(), outcome, { ...lagging(), ledger: ledgerWith(0, decided('stopped')) });

    assert.equal(found.verdict, 'done', outcome);
    assert.equal(found.reason, 'ledger-decided', outcome);
  }
});

test('the full classification still calls a commit list that has not caught up the unsettled stale head', () => {
  assert.equal(handling(green(), lagging()).reason, 'stale-head');
  assert.equal(classifyPullRequest({ ...asInput(green()), ...inputOf(green(), lagging()) }).reason, 'stale-head');
});

test('the checks are not judged after a repair, because the head was just pushed and has none yet', () => {
  const bundle = withNoChecksAtAll(green());

  assert.equal(classify(bundle).verdict, 'escalate');
  assert.equal(classify(bundle).reason, 'no-checks');
  assert.equal(afterRepair(bundle, 'repaired').verdict, 'unsettled');
  assert.equal(afterRepair(bundle, 'repaired').reason, 'repaired');
});

test('a word that is not an outcome is refused, rather than escalated with a kind nobody defined', () => {
  assert.throws(() => afterRepair(green(), 'fixed'), /fixed.*not a repair outcome/);
  assert.throws(() => afterRepair(green(), undefined), /not a repair outcome/);
});

test('after a repair the verdict is never a merge or a repair, whatever the outcome and whoever owns the pull request', () => {
  const scenes = [{}, ...Object.values(GUARDS).map(([options]) => options), humanCommit(), lagging()];
  const seen = new Set();
  for (const options of scenes) {
    for (const outcome of OUTCOMES) seen.add(afterRepair(green(), outcome, options).verdict);
  }

  assert.deepEqual([...seen].sort(), ['blocked-by-human', 'done', 'escalate', 'unsettled']);
});
