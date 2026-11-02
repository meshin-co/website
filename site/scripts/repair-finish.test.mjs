import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { ATTEMPT_CAP, validateLedger } from './autowriter-ledger.mjs';
import { validateRecord } from './generation-record.mjs';
import {
  FAILURE,
  GATES,
  HEAD,
  NOW,
  ENTRY,
  LEDGER,
  RECORD,
  before,
  claim,
  cleanup,
  world,
  FINDING,
} from './fixtures/repair-world.mjs';
import { RepairStop } from './repair-outcome.mjs';
import { finishRepair } from './repair-finish.mjs';
import { rewriteEntry } from './repair-rewrite.mjs';
import { WriterError } from './writer-error.mjs';

after(cleanup);

const MODEL_CHECK = {
  vendor: 'openai',
  modelVariable: 'OPENAI_WRITING_MODEL',
  model: 'gpt-6.1-terra',
  shutdownDate: null,
  note: null,
};

async function finishing(changes = {}) {
  const scene = world(changes);
  const situation = await scene.io.open();
  const calls = [];
  const { draft } = await rewriteEntry({
    repoRoot: scene.io.repoRoot,
    adapter: scene.adapter,
    claim,
    before,
    runDate: situation.runDate,
    findings: [{ gate: 'gate:content', ...FINDING }],
    allowances: [],
    attempt: { number: 1, of: ATTEMPT_CAP },
    calls,
  });
  const finish = () =>
    finishRepair({
      repoRoot: scene.io.repoRoot,
      situation,
      draft,
      calls,
      modelCheck: MODEL_CHECK,
      failures: [FAILURE],
      now: NOW,
      run: scene.io.run,
      assemble: scene.io.assemble,
      commit: scene.io.commit,
      secrets: [],
    });
  return { scene, finish, calls };
}

const fileText = (request, path) => request.files.find((file) => file.path === path).text;

test('the commit holds the entry files, the ledger and the record, with the provenance in its message', async () => {
  const { scene, finish } = await finishing();

  const done = await finish();

  assert.equal(done.attempt, 1);
  assert.equal(scene.committed.length, 1);
  assert.deepEqual(
    scene.committed[0].files.map(({ path }) => path).sort(),
    [ENTRY, LEDGER, RECORD, 'docs/SEMANTIC-CORE.md'].sort()
  );
  assert.match(scene.committed[0].message, /^fix\(autowriter\): repair /);
  assert.ok(scene.committed[0].message.includes('Provenance: ' + RECORD));
});

test('the attempt ledger rides inside the repair commit, with the failure it answered and its spend', async () => {
  const { scene, finish } = await finishing();

  await finish();

  const ledger = JSON.parse(fileText(scene.committed[0], LEDGER));
  assert.deepEqual(validateLedger(ledger), []);
  assert.equal(ledger.attempts.length, 1);
  assert.deepEqual(ledger.attempts[0].failures, [FAILURE]);
  assert.equal(ledger.attempts[0].judgedCommit, HEAD);
  assert.equal(ledger.attempts[0].recordedAt, NOW.toISOString());
  assert.equal(ledger.attempts[0].costUsd, 0.0035);
  assert.equal(ledger.verdict.state, 'open');
});

test('the generation record in the commit gains the repair call, publishes it and keeps the gate exits', async () => {
  const { scene, finish } = await finishing();

  await finish();

  const record = JSON.parse(fileText(scene.committed[0], RECORD));
  assert.deepEqual(validateRecord(record), []);
  assert.deepEqual(
    record.calls.map(({ role }) => role),
    ['draft', 'correction', 'repair']
  );
  assert.equal(record.published.callIndex, 2);
  assert.deepEqual(record.gates, GATES);
});

test('a rewrite that breaks the build is not committed, and the money it cost is reported', async () => {
  const { scene, finish } = await finishing({
    assemble: async () => {
      throw new WriterError('build', 'gate:editorial failed after the rewrite');
    },
  });

  await assert.rejects(finish(), (error) => {
    assert.ok(error instanceof RepairStop && error.outcome === 'unrepairable', error.message);
    assert.match(error.message, /broke the build.*gate:editorial/);
    return true;
  });

  assert.equal(scene.committed.length, 0);
});

test('a build that touched a file outside the entry is refused by the scope check and not committed', async () => {
  const { scene, finish } = await finishing({
    assemble: async () => ({
      files: [
        { path: ENTRY, text: 'the entry' },
        { path: 'site/src/pages/index.astro', text: 'a page the repair may not touch' },
      ],
      gates: GATES,
    }),
  });

  await assert.rejects(finish(), (error) => {
    assert.ok(error instanceof RepairStop && error.outcome === 'unrepairable', error.message);
    assert.ok(error.message.includes('site/src/pages/index.astro'), error.message);
    return true;
  });

  assert.equal(scene.committed.length, 0);
});

test('a build that deletes nothing but also writes nothing for the entry is refused, not committed empty', async () => {
  const { scene, finish } = await finishing({ assemble: async () => ({ files: [], gates: GATES }) });

  await assert.rejects(finish(), (error) => error instanceof RepairStop && error.outcome === 'unrepairable');

  assert.equal(scene.committed.length, 0);
});
