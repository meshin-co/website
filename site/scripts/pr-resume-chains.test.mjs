import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CHAIN_CAP } from './pr-chains.mjs';
import { HOLD_LABEL } from './pr-classify.mjs';
import { describeItem, summarise } from './run-pr-resume.mjs';
import {
  OWN_COMMITS,
  codeCommitAfter,
  ledgerRecord,
  openPull,
  personCommit,
  unjudged,
} from './fixtures/resume-world.mjs';
import { WRITER, named, refusal, sweepWorld, writes } from './fixtures/resume-sweep-harness.mjs';

const world = (numbers, options = {}) =>
  sweepWorld({
    pulls: numbers.map((number) => unjudged(number).pull),
    ledgers: numbers.map((number) => unjudged(number).record),
    ...options,
  });
const watching = (number, status = 'in_progress') => ({ status, title: `Watch pull request #${number}` });
const startedItem = (number) => ({ kind: 'started', pullRequest: number });
const leftItem = (number, reason) => ({ kind: 'left', pullRequest: number, reason });
const dispatched = (calls) => named(calls, 'dispatchSuccessor').map(([, , { inputs }]) => Number(inputs.pr));
const ACTIVE = ['queued', 'in_progress', 'waiting', 'pending', 'requested'];

test('an open pull request with no chain gets one: the watcher is dispatched for it with the bot token, on main, and nothing else is written', async () => {
  const { sweep, calls } = world([138]);

  assert.deepEqual(await sweep.run(), [startedItem(138)]);
  assert.deepEqual(writes(calls), ['dispatchSuccessor']);
  assert.deepEqual(named(calls, 'dispatchSuccessor'), [
    ['dispatchSuccessor', WRITER, { workflow: 'watch-pr.yml', ref: 'main', inputs: { pr: '138' } }],
  ]);
});

for (const status of ACTIVE) {
  test(`a pull request already in a chain that is ${status} does not get a second one`, async () => {
    const { sweep, calls } = world([138], { runs: [watching(138, status)] });

    assert.deepEqual(await sweep.run(), [leftItem(138, 'chain-alive')]);
    assert.deepEqual(writes(calls), []);
  });
}

test('a chain whose runs have all completed is no chain: the sweep starts one, as it does for a chain that died', async () => {
  const { sweep, calls } = world([138], { runs: [watching(138, 'completed')] });

  assert.deepEqual(await sweep.run(), [startedItem(138)]);
  assert.deepEqual(dispatched(calls), [138]);
});

test('two sweeps in a row start one chain, not two: the second finds the chain the first dispatched', async () => {
  const { sweep, calls } = world([138]);

  assert.deepEqual(await sweep.run(), [startedItem(138)]);
  assert.deepEqual(await sweep.run(), [leftItem(138, 'chain-alive')]);
  assert.deepEqual(dispatched(calls), [138]);
});

test('each pull request is judged by itself: the one with a chain is left, the one without gets one', async () => {
  const { sweep, calls } = world([138, 141], { runs: [watching(138)] });

  assert.deepEqual(await sweep.run(), [leftItem(138, 'chain-alive'), startedItem(141)]);
  assert.deepEqual(dispatched(calls), [141]);
});

test('eight open pull requests start the cap and no more, the oldest first, and say why the others wait', async () => {
  const { sweep, calls } = world([145, 138, 161, 141, 165, 152, 150, 151]);
  const items = await sweep.run();
  const ordered = [138, 141, 145, 150, 151, 152, 161, 165];

  assert.deepEqual(dispatched(calls), ordered.slice(0, CHAIN_CAP));
  assert.deepEqual(
    items,
    ordered.map((number, at) => (at < CHAIN_CAP ? startedItem(number) : leftItem(number, 'chain-cap')))
  );
});

test('chains already alive take their places: with the cap alive no chain starts, and a place that frees is taken by the next sweep', async () => {
  const alive = Array.from({ length: CHAIN_CAP }, (_, at) => watching(900 + at));
  const { sweep, calls, watcherRuns } = world([138], { runs: alive });

  assert.deepEqual(await sweep.run(), [leftItem(138, 'chain-cap')]);
  assert.deepEqual(writes(calls), []);

  watcherRuns[0].status = 'completed';

  assert.deepEqual(await sweep.run(), [startedItem(138)]);
});

test('a run whose title carries no number could be a chain of any pull request, so none is started while it is active', async () => {
  const { sweep, calls } = world([138], { runs: [{ status: 'in_progress', title: 'Watch pull request' }] });

  assert.deepEqual(await sweep.run(), [leftItem(138, 'run-unattributed')]);
  assert.deepEqual(writes(calls), []);
});

test('a pull request a person has touched is left alone: a commit of theirs, the hold label or a draft start no chain', async () => {
  const touched = [
    ['a commit by a person', { branchCommits: { 138: [...OWN_COMMITS, personCommit('d'.repeat(40))] } }],
    ['the hold label', { pulls: [{ ...unjudged(138).pull, labels: [{ name: HOLD_LABEL }] }] }],
    ['a draft', { pulls: [{ ...unjudged(138).pull, draft: true }] }],
  ];

  for (const [name, options] of touched) {
    const { sweep, calls } = world([138], options);

    assert.deepEqual(await sweep.run(), [leftItem(138, 'human-touched')], name);
    assert.deepEqual(writes(calls), [], name);
  }
});

test('a pull request the loop has finished with gets no chain: a verdict of merged, stopped or discarded, and a branch with no ledger', async () => {
  for (const state of ['merged', 'stopped', 'discarded']) {
    const { value, path } = unjudged(138).record;
    const ended = ledgerRecord({ ...value, verdict: { ...value.verdict, state } }, path);
    const { sweep, calls } = world([138], { ledgers: [ended] });

    assert.deepEqual(await sweep.run(), [leftItem(138, 'not-escalated')], state);
    assert.deepEqual(writes(calls), [], state);
  }
  const { sweep, calls } = world([138], { ledgers: [] });

  assert.deepEqual(await sweep.run(), [leftItem(138, 'not-escalated')]);
  assert.deepEqual(writes(calls), []);
});

test('a chain that cannot be dispatched is reported failed with the command to start it, and the next sweep tries again', async () => {
  const denied = refusal('POST', 'actions/workflows/watch-pr.yml/dispatches', 403, 'Resource not accessible');
  const failWith = { dispatchSuccessor: denied };
  const { sweep, calls } = world([138], { failWith });
  const [item] = await sweep.run();

  assert.equal(item.kind, 'failed');
  assert.match(
    item.message,
    /the watcher was not dispatched: .*answered 403.*gh workflow run watch-pr\.yml -f pr=138$/
  );

  failWith.dispatchSuccessor = undefined;

  assert.deepEqual(await sweep.run(), [startedItem(138)]);
  assert.equal(named(calls, 'dispatchSuccessor').length, 2);
});

test('the runs of the watcher are read once per sweep, with the read token', async () => {
  const { sweep, calls } = world([138, 141, 145]);
  await sweep.run();

  assert.equal(named(calls, 'listWatcherRuns').length, 1);
  assert.equal(named(calls, 'listWatcherRuns')[0][1], 'default-token-value');
});

test('a pull request that cannot be told from the runs fails the sweep loudly instead of passing as if none had a chain', async () => {
  const unreadable = refusal(
    'GET',
    'actions/workflows/watch-pr.yml/runs',
    403,
    'Resource not accessible by integration'
  );
  const { sweep, calls } = world([138], { failWith: { listWatcherRuns: unreadable } });
  const [item] = await sweep.run();

  assert.equal(item.kind, 'failed');
  assert.match(item.message, /answered 403/);
  assert.deepEqual(writes(calls), []);
});

test('the owner forcing a resume is not held back by the cap or by a run with no number, but is by a chain that is alive', async () => {
  const fullCap = Array.from({ length: CHAIN_CAP }, (_, at) => watching(900 + at));
  const unattributed = [{ status: 'in_progress', title: 'Watch pull request' }];
  const forced = async (runs) => sweepWorld({ runs }).sweep.run({ pullRequest: 84 });

  assert.equal((await forced(fullCap))[0].by, 'owner');
  assert.equal((await forced(unattributed))[0].by, 'owner');
  assert.deepEqual(await forced([watching(84)]), [leftItem(84, 'chain-alive')]);
});

test('a resume takes a place under the cap like any chain: with one place left the resume gets it and the next pull request waits', async () => {
  const alive = Array.from({ length: CHAIN_CAP - 1 }, (_, at) => watching(900 + at));
  const { sweep, calls } = sweepWorld({
    pulls: [openPull(), unjudged(138).pull],
    ledgers: [ledgerRecord(), unjudged(138).record],
    main: [codeCommitAfter()],
    runs: alive,
  });
  const [resumed, waiting] = await sweep.run();

  assert.equal(resumed.kind, 'resumed');
  assert.deepEqual(waiting, leftItem(138, 'chain-cap'));
  assert.deepEqual(dispatched(calls), [84]);
});

test('a chain that was started prints as started, counts as started, and a failed start counts as failed', () => {
  assert.equal(describeItem(startedItem(138)), '#138 watcher started');
  assert.equal(
    summarise([startedItem(138), { kind: 'failed', subject: '#141', pullRequest: 141, message: 'x' }]),
    'pr-resume: 0 resumed, 1 started, 0 re-measuring, 0 left, 0 issues closed, 1 failed'
  );
});
