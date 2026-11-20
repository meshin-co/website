import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { verdictInForce } from './autowriter-ledger.mjs';
import { createRemeasurer } from './pr-remeasure.mjs';
import { SECRET } from './pr-watch.mjs';
import { parseArguments, runCli } from './remeasure-record.mjs';
import {
  MAIN_SHA,
  capture,
  codeCommitAfter,
  ledgerRecord,
  pullOnBranch,
  withLastEscalation,
} from './fixtures/resume-world.mjs';
import { READER, WRITER, named, sweepWorld, writes } from './fixtures/resume-sweep-harness.mjs';

const GIVEN_UP = capture('repair-found-no-findings');
const SLUG = GIVEN_UP.ledger.slug;
const MEASURED_MAIN = 'd84805bc7ba18bc22bb17a8e1ceab775ab18abaa';
const WHY = { stop: 'no-artifact', gate: 'gate:orphans', ciRun: 44671747275, measuredMain: MEASURED_MAIN };
const TODAY = new Date('2026-11-21T09:00:00.000Z');
const PATH = `audits/autowriter/2026/11/${SLUG}.json`;
const PULL = pullOnBranch(SLUG, 145);
const ENTRY = { at: TODAY.toISOString(), gate: 'gate:orphans', measuredMain: MEASURED_MAIN, mainSha: MAIN_SHA };

const stale = () => withLastEscalation(GIVEN_UP.ledger, WHY);
const waiting = () => ({ ...stale(), remeasures: [{ ...ENTRY, result: 'requested' }] });
const worldOf = (ledger) =>
  sweepWorld({ pulls: [PULL], ledgers: [ledgerRecord(ledger, PATH)], main: [codeCommitAfter()], now: TODAY });
const writtenLedger = (calls) => JSON.parse(named(calls, 'putLedger').at(-1)[2].text);
const remeasurerOf = ({ io }) =>
  createRemeasurer({
    io,
    reader: io.createApi({ token: READER }),
    writer: io.createApi({ token: WRITER }),
    ref: 'main',
    now: () => TODAY,
  });

test('the real ledger of pull request 145 has spent both resumes, and a stale verdict is still re-measured: once, under its own name', async () => {
  const world = worldOf(stale());
  const [item] = await world.sweep.run();
  const ledger = writtenLedger(world.calls);

  assert.equal(GIVEN_UP.ledger.resumes.filter(({ by }) => by !== 'owner').length, 2);
  assert.deepEqual([item.kind, item.pullRequest, item.gate], ['remeasuring', 145, 'gate:orphans']);
  assert.deepEqual(ledger.remeasures, [{ ...ENTRY, result: 'requested' }]);
  assert.deepEqual(ledger.resumes, GIVEN_UP.ledger.resumes);
  assert.deepEqual(
    named(world.calls, 'dispatchSuccessor').map(([, token, args]) => [token, args.workflow, args.inputs]),
    [[WRITER, 'remeasure-pr.yml', { pr: '145', head: PULL.head.sha, gate: 'gate:orphans' }]]
  );
});

test('the second re-measure on one pull request is a person, not a sweep: it writes and dispatches nothing', async () => {
  const world = worldOf({ ...waiting(), remeasures: [{ ...ENTRY, result: 'reproduced' }] });
  const [item] = await world.sweep.run();

  assert.deepEqual(item, { kind: 'left', pullRequest: 145, reason: 'remeasure-spent' });
  assert.deepEqual(writes(world.calls), []);
});

test('a clear result lifts the verdict and starts the watcher, and the result is written to the entry the request spent', async () => {
  const world = worldOf(waiting());
  const done = await remeasurerOf(world).settle({ number: 145, result: 'clear' });
  const ledger = writtenLedger(world.calls);

  assert.deepEqual([done.kind, done.result, done.problems], ['remeasured', 'clear', []]);
  assert.deepEqual(
    ledger.remeasures.map(({ result }) => result),
    ['clear']
  );
  assert.equal(verdictInForce(ledger), false);
  assert.deepEqual(
    named(world.calls, 'dispatchSuccessor').map(([, , args]) => [args.workflow, args.inputs]),
    [['watch-pr.yml', { pr: '145' }]]
  );
});

test('a reproduced result keeps the verdict, starts no watcher, and tells the person on the escalation issue', async () => {
  const world = worldOf(waiting());
  await remeasurerOf(world).settle({ number: 145, result: 'reproduced' });
  const ledger = writtenLedger(world.calls);

  assert.deepEqual(
    ledger.remeasures.map(({ result }) => result),
    ['reproduced']
  );
  assert.equal(verdictInForce(ledger), true);
  assert.deepEqual(named(world.calls, 'dispatchSuccessor'), []);
  assert.match(named(world.calls, 'commentOnIssue').at(-1)[2].body, /still fails.*a person is needed/);
});

test('the owner forcing a pull request whose verdict is stale is answered, though both resumes are spent', async () => {
  const world = worldOf(stale());
  const [item] = await world.sweep.run({ pullRequest: 145 });

  assert.deepEqual([item.kind, item.by], ['resumed', 'owner']);
});

test('the record command takes a pull request and a result, writes the result, and says so', async () => {
  assert.deepEqual(parseArguments(['--pr', '145', '--result', 'clear']), { number: 145, result: 'clear' });
  for (const argv of [
    [],
    ['--pr', '145'],
    ['--pr', 'x', '--result', 'clear'],
    ['--pr', '145', '--result', 'requested'],
  ])
    assert.throws(() => parseArguments(argv), /Usage: node scripts\/remeasure-record\.mjs/, argv.join(' '));

  const world = worldOf(waiting());
  const out = [];
  const status = await runCli(['--pr', '145', '--result', 'clear'], {
    stdout: (line) => out.push(line),
    stderr: (line) => out.push(line),
    env: { GITHUB_REPOSITORY: 'meshin-co/website', GITHUB_TOKEN: READER, [SECRET]: WRITER, GITHUB_REF_NAME: 'main' },
    io: world.io,
    now: () => TODAY,
  });

  assert.deepEqual([status, out], [0, ['remeasure-record: #145 clear']]);
});
