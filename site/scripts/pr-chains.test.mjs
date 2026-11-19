import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { parse } from 'yaml';

import { newLedger } from './autowriter-ledger.mjs';
import { readEngineConfig } from './engine-config.mjs';
import { CHAIN_CAP, CHAIN_REASONS, chainBook, pullRequestOfRun } from './pr-chains.mjs';
import { readSnapshot, tickProblem } from './pr-github.mjs';
import { WORKFLOW } from './pr-watch.mjs';
import { LEDGER_PATH, apiAnswering, json, ledgerAt, serving } from './fixtures/github-fake.mjs';
import { scenario } from './fixtures/pr-watch.mjs';

const WORKFLOWS = join(import.meta.dirname, '..', '..', '.github', 'workflows');
const RUN_NAME = parse(readFileSync(join(WORKFLOWS, WORKFLOW), 'utf8'))['run-name'];
const expression = (inside) => '$' + `{{ ${inside} }}`;
const titled = (number) => RUN_NAME.replace(expression('inputs.pr'), String(number));
const run = (number, status = 'in_progress') => ({ status, title: titled(number) });
const untitled = { status: 'in_progress', title: 'Watch pull request' };
const ACTIVE = ['queued', 'in_progress', 'waiting', 'pending', 'requested'];
const others = (count) => Array.from({ length: count }, (_, at) => run(900 + at));

test('the number of the pull request is read from the title the watcher workflow gives its runs', () => {
  assert.equal(pullRequestOfRun({ title: titled(138) }), 138);
  assert.equal(pullRequestOfRun({ title: titled(1) }), 1);
});

for (const title of [
  'Watch pull request',
  'Watch pull request #',
  'Watch pull request #12 and more',
  ' Watch pull request #12',
  'watch pull request #12',
  'Resume escalated pull requests',
  '',
]) {
  test(`the title ${JSON.stringify(title)} names no pull request`, () => {
    assert.equal(pullRequestOfRun({ title }), null);
  });
}

for (const status of ACTIVE) {
  test(`a run that is ${status} is a chain that is alive`, () => {
    assert.equal(chainBook([run(7, status)]).refusal(7), 'chain-alive');
  });
}

test('a run that has completed is no chain, whatever it concluded', () => {
  assert.equal(chainBook([run(7, 'completed')]).refusal(7), null);
});

test('a chain is alive for the pull request in its title only', () => {
  assert.equal(chainBook([run(7)]).refusal(8), null);
});

test('a chain that is alive is named before a run with no number, and before the cap', () => {
  const crowded = chainBook([untitled, run(7), ...others(CHAIN_CAP)]);

  assert.equal(crowded.refusal(7), 'chain-alive');
});

test('a run with no number leaves no pull request provably without a chain, so none gets one', () => {
  assert.equal(chainBook([untitled]).refusal(7), 'run-unattributed');
});

test('a run with no number is named before the cap', () => {
  assert.equal(chainBook([untitled, ...others(CHAIN_CAP)]).refusal(7), 'run-unattributed');
});

test('a run with no number that has completed is not in the way', () => {
  assert.equal(chainBook([{ ...untitled, status: 'completed' }]).refusal(7), null);
});

test('the cap is on chains alive, whoever started them: one below it a chain may start, at it none may', () => {
  assert.equal(chainBook(others(CHAIN_CAP - 1)).refusal(7), null);
  assert.equal(chainBook(others(CHAIN_CAP)).refusal(7), 'chain-cap');
  assert.equal(chainBook(others(CHAIN_CAP + 2)).refusal(7), 'chain-cap');
});

test('two runs of one chain are one chain: counted as runs they would fill the cap, counted as chains they leave a place', () => {
  const rest = Array.from({ length: CHAIN_CAP - 2 }, (_, at) => run(910 + at));

  assert.equal(chainBook([run(900), run(900, 'waiting'), ...rest]).refusal(7), null);
});

test('a chain the sweep began is alive from then on and takes one place under the cap', () => {
  const book = chainBook(others(CHAIN_CAP - 1));
  book.began(7);

  assert.equal(book.refusal(7), 'chain-alive');
  assert.equal(book.refusal(8), 'chain-cap');
});

test('every reason a chain can be refused for is one of the three the design names, and each is given', () => {
  const given = new Set([
    chainBook([run(7)]).refusal(7),
    chainBook([untitled]).refusal(7),
    chainBook(others(CHAIN_CAP)).refusal(7),
  ]);

  assert.deepEqual(CHAIN_REASONS, ['chain-alive', 'run-unattributed', 'chain-cap']);
  assert.deepEqual([...given].sort(), [...CHAIN_REASONS].sort());
});

const GITHUB_TOKEN_REQUESTS_PER_HOUR_PER_REPOSITORY = 1000;
const SHARE_FOR_THE_LOOKS = 0.7;

async function requestsInOneLook() {
  const bundle = scenario('green');
  bundle.pullRequest.head.ref = 'autowriter/a-slug';
  const ledger = newLedger({ slug: 'a-slug', runId: '1', pullRequest: bundle.pullRequest.number });
  const answer = serving(bundle, { tree: [LEDGER_PATH], ledger: ledgerAt(LEDGER_PATH, ledger) });
  const respond = (call) =>
    call.path.startsWith('environments/')
      ? json({ protection_rules: [{ type: 'wait_timer', wait_timer: 3 }] })
      : answer(call);
  const { api, calls } = apiAnswering(respond);
  await readSnapshot(api, bundle.pullRequest.number);
  await tickProblem(api, { environment: 'autowriter-tick', minutes: 3 });
  return calls.length;
}

const requestsPerHour = ({ chains, perLook }) => chains * perLook * (60 / readEngineConfig().loop.tickMinutes);
const fitsTheBudget = (load) =>
  requestsPerHour(load) <= GITHUB_TOKEN_REQUESTS_PER_HOUR_PER_REPOSITORY * SHARE_FOR_THE_LOOKS;

test('the chains the cap allows make requests with the read token, at the fastest pace the tick allows, inside the share of the hourly limit they may use', async () => {
  assert.equal(fitsTheBudget({ chains: CHAIN_CAP, perLook: await requestsInOneLook() }), true);
});

test('the budget check can fail: it refuses a cap one chain higher, a look that costs two requests more, and the eight chains of the open pull requests', async () => {
  const perLook = await requestsInOneLook();

  assert.equal(fitsTheBudget({ chains: CHAIN_CAP + 1, perLook }), false);
  assert.equal(fitsTheBudget({ chains: CHAIN_CAP, perLook: perLook + 2 }), false);
  assert.equal(fitsTheBudget({ chains: 8, perLook }), false);
});
