import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { ATTEMPT_CAP } from './autowriter-ledger.mjs';
import { FINDING, before, claim, cleanup, reworded, withoutASentence, world } from './fixtures/repair-world.mjs';
import { removalProblems } from './repair-guard.mjs';
import { RepairStop } from './repair-outcome.mjs';
import { rewriteEntry } from './repair-rewrite.mjs';

after(cleanup);

function rewriting(scene) {
  const calls = [];
  const rewrite = () =>
    rewriteEntry({
      repoRoot: scene.io.repoRoot,
      adapter: scene.adapter,
      claim,
      before,
      runDate: '2026-11-02',
      findings: [{ gate: 'gate:content', ...FINDING }],
      allowances: [],
      attempt: { number: 1, of: ATTEMPT_CAP },
      calls,
    });
  return { calls, rewrite };
}

test('a finding drives one repair call whose prompt carries the finding, its text and the attempt', async () => {
  const rewritten = reworded();
  const scene = world({ drafts: [rewritten] });
  const { calls, rewrite } = rewriting(scene);

  const result = await rewrite();

  assert.deepEqual(result.draft, rewritten);
  assert.deepEqual(
    calls.map(({ role }) => role),
    ['repair']
  );
  const asked = scene.adapter.requests[0].messages[0].content;
  assert.ok(asked.includes('the entry says "leverage"'), 'the prompt carries the finding');
  assert.ok(asked.includes('we leverage the register'), 'the prompt carries the text of the finding');
  assert.ok(asked.includes('Attempt: 1 of ' + ATTEMPT_CAP), 'the prompt names the attempt');
});

test('a rewrite that passes by deleting a sentence is refused, even after the correction round', async () => {
  const dropped = withoutASentence();
  const expected = removalProblems({ before, after: dropped, may: [] });
  assert.ok(expected.length > 0, 'the guard sees the deletion');
  const scene = world({ drafts: [dropped] });
  const { calls, rewrite } = rewriting(scene);

  await assert.rejects(rewrite(), (error) => {
    assert.ok(error instanceof RepairStop && error.outcome === 'unrepairable', error.message);
    assert.ok(error.message.includes("repair's own checks"), error.message);
    assert.ok(error.message.includes(expected[0].rule), error.message);
    return true;
  });

  assert.deepEqual(
    calls.map(({ role }) => role),
    ['repair', 'repair-correction']
  );
  assert.equal(scene.adapter.requests.length, 2);
  assert.ok(scene.adapter.requests[1].messages.at(-1).content.includes('never delete'));
});

test('an answer that is not the shape of an entry is a problem to correct, not a crash', async () => {
  const rewritten = reworded();
  const scene = world({ drafts: [{ nonsense: true }, rewritten] });
  const { calls, rewrite } = rewriting(scene);

  const result = await rewrite();

  assert.deepEqual(result.draft, rewritten);
  assert.deepEqual(
    calls.map(({ role }) => role),
    ['repair', 'repair-correction']
  );
});
