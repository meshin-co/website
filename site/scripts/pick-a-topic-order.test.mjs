import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';

import { readClaim } from './autowriter-claim-store.mjs';
import { AGENTIC, GOVERNANCE, QUERY_ACCEPTED, answerWith } from './fixtures/proposal-scene.mjs';
import { reportText, unprovenPrompt, withPickRepo } from './fixtures/pick-scene.mjs';
import { ROUTES, adapterOn, inSequence } from './fixtures/writer-vendors.mjs';

const EVALS = 'how to put evals for AI agents into CI';
const PILOTS = 'why do AI pilots fail to reach production';
const BOARD = 'board memo AI strategy one page';
const SCENE = {
  report: reportText({ prompts: [unprovenPrompt(1, EVALS), unprovenPrompt(2, PILOTS), unprovenPrompt(3, BOARD)] }),
};
const ROTATION = [GOVERNANCE, AGENTIC];

const written = (repo, argv = [], io = {}) =>
  repo.run(['--write', '--output', join(repo.root, 'out', 'decision.json'), ...argv], { rotation: ROTATION, ...io });
const claimOf = (repo, entry) => readClaim(join(repo.root, entry.claimPath));

test('with no order the scene writes prompt 2, so the orders below have a topic they could fall back to', async () => {
  await withPickRepo(SCENE, async (repo) => {
    const { exit, stdout, stderr } = await written(repo);
    assert.equal(exit, 0, stderr.join('\n'));
    assert.equal(stdout[0], 'Choice: signal 2, prompt 2, unproven, 0 impressions in the window to 2026-10-30');
    assert.equal(claimOf(repo, repo.json('out/decision.json').entries[0]).origin, 'demand');
  });
});

test('--order-prompt writes that prompt alone, claimed as ordered with its prompt, and calls no model', async () => {
  const vendor = adapterOn();
  await withPickRepo(SCENE, async (repo) => {
    const { exit, stdout, stderr } = await written(repo, ['--order-prompt', '3', '--run-id', 'run-1'], { vendor });
    assert.equal(exit, 0, stderr.join('\n'));
    assert.equal(vendor.calls.length, 0);
    const file = repo.json('out/decision.json');
    assert.equal(file.entries.length, 1);
    const [entry] = file.entries;
    const claim = claimOf(repo, entry);
    assert.deepEqual(claim, entry.claim);
    assert.deepEqual(
      [claim.origin, claim.format, claim.slug, claim.prompt],
      ['ordered', 'article', 'board-memo-ai-strategy-one-page', { number: 3, text: BOARD }]
    );
    assert.deepEqual([entry.table, entry.choice], ['Buyer prompts', 'Choice: ordered, prompt 3, requested by hand']);
    assert.deepEqual(stdout.slice(0, 2), [
      'Choice: ordered, prompt 3, requested by hand',
      'article: Board memo AI strategy one page, /blog/board-memo-ai-strategy-one-page, prompt 3',
    ]);
    assert.equal(repo.filesBelow('audits/autowriter').length, 2);
  });
});

test('--order-title writes that title alone, claimed as ordered with no prompt and no report row', async () => {
  const vendor = adapterOn();
  await withPickRepo(SCENE, async (repo) => {
    const { exit, stdout, stderr } = await written(repo, ['--order-title', 'Why AI steering committees stall'], {
      vendor,
    });
    assert.equal(exit, 0, stderr.join('\n'));
    assert.equal(vendor.calls.length, 0);
    const [entry] = repo.json('out/decision.json').entries;
    const claim = claimOf(repo, entry);
    assert.deepEqual(
      [claim.origin, claim.slug, claim.title],
      ['ordered', 'why-ai-steering-committees-stall', 'Why AI steering committees stall?']
    );
    assert.equal(Object.hasOwn(claim, 'prompt'), false);
    assert.deepEqual([entry.table, entry.row], [null, null]);
    assert.deepEqual(stdout.slice(0, 2), [
      'Choice: ordered, "Why AI steering committees stall", requested by hand',
      'article: Why AI steering committees stall?, /blog/why-ai-steering-committees-stall, ordered',
    ]);
  });
});

const REFUSED = [
  [['--order-prompt', '1'], /^The order for prompt 1 was refused \(register-owner\)/],
  [['--order-prompt', '31'], /^The order for prompt 31 was refused \(no-such-prompt\).*it holds 3 prompts$/],
  [
    ['--order-title', 'How to put evals into CI'],
    /^The order for "How to put evals into CI" was refused \(register-owner\)/,
  ],
];

for (const [argv, reason] of REFUSED) {
  test(
    'a refused order (' + argv.join(' ') + ') ends in none, with no claim, no ledger, no model call and no other topic',
    async () => {
      const vendor = adapterOn({ routes: { [ROUTES.responses]: inSequence(answerWith(QUERY_ACCEPTED)) } });
      await withPickRepo(SCENE, async (repo) => {
        const summary = join(repo.root, 'summary.md');
        const { exit, stdout, stderr } = await written(repo, [...argv, '--summary', summary], { vendor });
        assert.equal(exit, 0, stderr.join('\n'));
        assert.equal(vendor.calls.length, 0);
        const file = repo.json('out/decision.json');
        assert.deepEqual(file, { schema: 1, decision: 'none', reason: file.reason, advisories: [] });
        assert.match(file.reason, reason);
        assert.deepEqual(stdout, [file.reason, 'Examined 1 candidate, set aside 1.']);
        assert.deepEqual(repo.filesBelow('audits/autowriter'), []);
        for (const text of [stdout.join('\n'), repo.read('summary.md'), JSON.stringify(file)]) {
          for (const other of ['pilots', 'Board memo', 'Category', 'Strengthen', 'Proposal']) {
            assert.equal(text.includes(other), false, other);
          }
        }
      });
    }
  );
}

test('ordering the same topic twice writes it once: the claim of the first run refuses the second, which ends in none', async () => {
  await withPickRepo(SCENE, async (repo) => {
    assert.equal((await written(repo, ['--order-prompt', '3', '--run-id', 'a'])).exit, 0);
    const again = await written(repo, ['--order-prompt', '3', '--run-id', 'b']);
    assert.equal(again.exit, 0);
    assert.match(again.stdout[0], /^The order for prompt 3 was refused \((title-collision|slug-held)\)/);
    assert.equal(repo.json('out/decision.json').decision, 'none');
    assert.equal(repo.filesBelow('audits/autowriter').length, 2);
  });
});

test('both order flags exit 2 naming both, and write no decision file, claim or ledger', async () => {
  await withPickRepo(SCENE, async (repo) => {
    const { exit, stdout, stderr } = await written(repo, ['--order-prompt', '3', '--order-title', 'x']);
    assert.equal(exit, 2);
    assert.deepEqual(stdout, []);
    assert.ok(stderr.join('\n').includes('--order-prompt') && stderr.join('\n').includes('--order-title'));
    assert.deepEqual(repo.filesBelow('out'), []);
    assert.deepEqual(repo.filesBelow('audits/autowriter'), []);
  });
});
