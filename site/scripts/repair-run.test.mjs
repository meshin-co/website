import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { after, test } from 'node:test';

import { ATTEMPT_CAP, validateLedger } from './autowriter-ledger.mjs';
import { historyReport } from './autowriter-refusal-rules.mjs';
import { refusalFor } from './autowriter-refusals.mjs';
import { commitRepair } from './entry-commit.mjs';
import { committedFiles, scene } from './fixtures/commit-scene.mjs';
import { gitRun } from './fixtures/git-run.mjs';
import {
  COMMIT,
  ENTRY,
  FAILURE,
  HEAD,
  LEDGER,
  NOW,
  RECORD,
  claim,
  cleanup,
  ledgerAfter,
  reworded,
  world,
} from './fixtures/repair-world.mjs';
import { RepairStop } from './repair-outcome.mjs';
import { repairRun } from './repair-run.mjs';
import { WriterError } from './writer-error.mjs';

const sceneRoots = [];
after(() => {
  cleanup();
  sceneRoots.forEach((root) => rmSync(root, { recursive: true, force: true }));
});

const stops = (outcome, pattern) => (error) =>
  error instanceof RepairStop && error.outcome === outcome && pattern.test(error.message);

test('a repairable finding drives a rewrite through the build and into one commit', async () => {
  const rewritten = reworded();
  const { io, adapter, assembled, committed } = world({ drafts: [rewritten] });

  const result = await repairRun(io);

  assert.equal(result.outcome, 'repaired');
  assert.equal(result.commit, COMMIT);
  assert.equal(result.attempt, 1);
  assert.equal(adapter.requests.length, 1);
  assert.equal(assembled.length, 1);
  assert.deepEqual(assembled[0].draft, rewritten);
  assert.deepEqual(assembled[0].attempt, { number: 1, of: ATTEMPT_CAP });
  assert.equal(committed.length, 1);
});

test('the attempt cap stops the loop before the model is verified or asked', async () => {
  const { io, adapter, committed } = world({
    ledger: ledgerAfter(
      [{ rule: 'first-rule', path: ENTRY }],
      [{ rule: 'second-rule', path: ENTRY }],
      [{ rule: 'third-rule', path: ENTRY }]
    ),
  });

  await assert.rejects(repairRun(io), stops('no-convergence', /attempts/));

  assert.equal(adapter.requests.length, 0);
  assert.equal(adapter.state.verified, 0);
  assert.equal(committed.length, 0);
});

test('a failure identical to the one an earlier attempt answered escapes at once, without a model call', async () => {
  const { io, adapter, committed } = world({ ledger: ledgerAfter([FAILURE]) });

  await assert.rejects(repairRun(io), stops('no-convergence', /attempt 1/));

  assert.equal(adapter.requests.length, 0);
  assert.equal(adapter.state.verified, 0);
  assert.equal(committed.length, 0);
});

test('a failure that differs only in its path is not identical, so the repair goes ahead', async () => {
  const { io, adapter } = world({ ledger: ledgerAfter([{ rule: FAILURE.rule, path: '/blog/another' }]) });

  const result = await repairRun(io);

  assert.equal(result.outcome, 'repaired');
  assert.equal(adapter.requests.length, 1);
});

test('a finding the table refuses stops the loop before any model call, naming the reason', async () => {
  const kinds = {
    judgeFindings: () => ({
      rewrite: [],
      refused: [{ gate: 'gate:content', rule: 'inbound-links', subjects: [ENTRY], reason: 'outside-entry' }],
    }),
    allowancesOf: () => [],
  };
  const { io, adapter } = world({ kinds });

  await assert.rejects(repairRun(io), stops('unrepairable', /inbound-links.*outside-entry/));

  assert.equal(adapter.requests.length, 0);
});

test('a table that finds nothing to rewrite stops the loop before any model call', async () => {
  const kinds = { judgeFindings: () => ({ rewrite: [], refused: [] }), allowancesOf: () => [] };
  const { io, adapter } = world({ kinds });

  await assert.rejects(repairRun(io), stops('unrepairable', /no finding asks for a rewrite/));

  assert.equal(adapter.requests.length, 0);
});

test('a reached spend ceiling stops the repair before the model is verified or asked', async () => {
  const { io, adapter, counts } = world({ reached: true });

  await assert.rejects(repairRun(io), stops('spend-ceiling', /50/));

  assert.equal(counts.ceiling, 1);
  assert.equal(adapter.state.verified, 0);
  assert.equal(adapter.requests.length, 0);
});

test('a stale pull request stops the repair before anything is read or spent', async () => {
  const { io, adapter, counts } = world();
  io.open = async () => {
    throw new RepairStop('stale', 'the pull request head moved');
  };

  await assert.rejects(repairRun(io), stops('stale', /moved/));

  assert.equal(counts.ceiling, 0);
  assert.equal(adapter.requests.length, 0);
});

const spentAndFailed = (error) => async (input) => {
  throw typeof error === 'function' ? error(input) : error;
};

const recordedLedger = (committed) => JSON.parse(committed[0].files[0].text);

test('a repair that spent money and then failed commits only the ledger, with the spend, the rule and the judged head', async () => {
  const { io, adapter, committed } = world({ assemble: spentAndFailed(new WriterError('build', 'the build broke')) });

  const error = await repairRun(io).then(
    () => assert.fail('the repair should have stopped'),
    (stopped) => stopped
  );

  assert.ok(stops('unrepairable', /the rewrite broke the build/)(error));
  assert.equal(adapter.requests.length, 1);
  assert.equal(committed.length, 1);
  assert.deepEqual(
    committed[0].files.map(({ path }) => path),
    [LEDGER]
  );
  const ledger = recordedLedger(committed);
  assert.deepEqual(validateLedger(ledger), []);
  assert.equal(ledger.attempts.length, 1);
  assert.deepEqual(ledger.attempts[0], {
    number: 1,
    judgedCommit: HEAD,
    recordedAt: NOW.toISOString(),
    failingRule: FAILURE.rule,
    failingPath: FAILURE.path,
    failures: [FAILURE],
    tokens: error.spend.tokens,
    costUsd: error.spend.costUsd,
  });
  assert.deepEqual(ledger.spend, { tokens: error.spend.tokens, costUsd: error.spend.costUsd });
  assert.equal(error.commit, COMMIT);
  assert.equal(error.spend.costUsd, 0.0035);
});

test('the commit of a failed repair names the entry and the outcome in its subject and the record in its trailer', async () => {
  const { io, committed } = world({ assemble: spentAndFailed(new WriterError('build', 'the build broke')) });

  await assert.rejects(repairRun(io));

  const [{ message }] = committed;
  assert.equal(
    message.split('\n')[0],
    'fix(autowriter): record the spend of a repair of ' + claim.slug + ' that ended as unrepairable'
  );
  assert.ok(message.split('\n').includes('Provenance: ' + RECORD));
  assert.equal(committed[0].run, io.run);
  assert.equal(committed[0].repoRoot, io.repoRoot);
});

test('an unexpected error after a call is recorded the same way and is still the error thrown', async () => {
  const original = new Error('the build crashed');
  const { io, committed } = world({ assemble: spentAndFailed(original) });

  const error = await repairRun(io).then(
    () => assert.fail('the repair should have failed'),
    (failed) => failed
  );

  assert.equal(error, original);
  assert.equal(error.message, 'the build crashed');
  assert.equal(error.commit, COMMIT);
  assert.equal(committed.length, 1);
  assert.deepEqual(
    committed[0].files.map(({ path }) => path),
    [LEDGER]
  );
  assert.ok(committed[0].message.split('\n')[0].endsWith('that ended as failed'));
});

test('a credential refusal after a billed call is recorded as a repair that ended as credential', async () => {
  const original = new WriterError('credential', 'the key was refused');
  const { io, committed } = world({ assemble: spentAndFailed(original) });

  await assert.rejects(repairRun(io), (error) => error === original && error.commit === COMMIT);

  assert.ok(committed[0].message.split('\n')[0].endsWith('that ended as credential'));
});

test('a failed repair leaves the generation record and the entry untouched', async () => {
  const { io, committed } = world({ assemble: spentAndFailed(new WriterError('build', 'the build broke')) });

  await assert.rejects(repairRun(io));

  const paths = committed.flatMap(({ files }) => files.map(({ path }) => path));
  assert.deepEqual(paths, [LEDGER]);
  assert.equal(paths.includes(RECORD), false);
  assert.equal(paths.includes(ENTRY), false);
});

test('a commit that throws while recording the spend leaves the original error and its spend in place, and says so', async () => {
  const original = new WriterError('build', 'the build broke');
  const { io } = world({ assemble: spentAndFailed(original) });
  io.commit = async () => {
    throw new Error('git is unavailable');
  };

  const error = await repairRun(io).then(
    () => assert.fail('the repair should have stopped'),
    (stopped) => stopped
  );

  assert.ok(error instanceof RepairStop);
  assert.equal(error.outcome, 'unrepairable');
  assert.match(error.message, /the rewrite broke the build: the build broke/);
  assert.match(error.message, /the spend of this repair could not be recorded: git is unavailable/);
  assert.equal(error.commit, undefined);
  assert.equal(error.spend.costUsd, 0.0035);
});

test('a ledger that cannot take another attempt cannot mask the original error either', async () => {
  const original = new Error('the build crashed');
  const { io, committed } = world();
  const open = io.open;
  io.open = async () => {
    const situation = await open();
    io.assemble = async () => {
      situation.ledger.attempts.push(...ledgerAfter(...Array(ATTEMPT_CAP).fill([FAILURE])).attempts);
      throw original;
    };
    return situation;
  };

  const error = await repairRun(io).then(
    () => assert.fail('the repair should have failed'),
    (failed) => failed
  );

  assert.equal(error, original);
  assert.match(error.message, /the build crashed; the spend of this repair could not be recorded: .*cap is/);
  assert.equal(error.spend.costUsd, 0.0035);
  assert.equal(committed.length, 0);
});

test('a failure before any model call commits nothing', async () => {
  const { io, adapter, committed } = world();
  adapter.verifyModel = async () => {
    throw new WriterError('credential', 'the key was refused');
  };

  await assert.rejects(repairRun(io), (error) => error.commit === undefined && error.spend === undefined);

  assert.equal(adapter.requests.length, 0);
  assert.equal(committed.length, 0);
});

test('a ledger-only commit by the pipeline passes the commit check and the history rules', async () => {
  const made = scene();
  sceneRoots.push(made.root);
  const { io } = world({ assemble: spentAndFailed(new WriterError('build', 'the build broke')) });
  io.run = gitRun();
  io.commit = (request) => commitRepair({ ...request, repoRoot: made.root });

  const error = await repairRun(io).then(
    () => assert.fail('the repair should have stopped'),
    (stopped) => stopped
  );

  assert.match(error.commit, /^[0-9a-f]{40}$/);
  assert.equal(error.message.includes('could not be recorded'), false);
  assert.deepEqual(committedFiles(made.root), [LEDGER]);
  assert.deepEqual(historyReport({ root: made.root }), { findings: [], commits: 0, skipped: null });
  assert.equal(refusalFor(LEDGER), null);
});
