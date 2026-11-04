import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';

import { readLedger } from './autowriter-ledger.mjs';
import { callTotals } from './generation-record.mjs';
import {
  AGENTIC,
  GOVERNANCE,
  QUERY_ACCEPTED,
  QUERY_REGISTER,
  answerWith,
  modelRequests,
  promptOf,
} from './fixtures/proposal-scene.mjs';
import { reportText, withPickRepo } from './fixtures/pick-scene.mjs';
import { ROUTES, adapterOn, errorBody, inSequence, reply, response, usageOf } from './fixtures/writer-vendors.mjs';
import { openRun } from './write-open.mjs';

const QUERY_PRICE = 'how to price a model audit for a small bank';
const ROTATION = [GOVERNANCE, AGENTIC];
const POSTS = {
  'older-review': { title: 'Why governance reviews stall', category: GOVERNANCE, publishDate: '2026-09-01' },
  'review-board': { title: 'How a review board decides', category: GOVERNANCE, publishDate: '2026-10-01' },
  'agent-runbook': { title: 'What an agent runbook holds', category: AGENTIC, publishDate: '2026-09-15' },
};
const written = (repo, argv = [], io = {}) =>
  repo.run(['--write', '--output', join(repo.root, 'out', 'decision.json'), ...argv], io);
const vendorAnswering = (...answers) => adapterOn({ routes: { [ROUTES.responses]: inSequence(...answers) } });
const lastLine = (lines) => JSON.parse(lines.at(-1));
const NO_SPEND = { tokens: { input: 0, output: 0 }, costUsd: 0 };

test('the category with the fewest entries is asked once, and its query becomes a category entry the writer opens', async () => {
  const vendor = vendorAnswering(answerWith(QUERY_ACCEPTED, { input: 1500, output: 50 }));
  await withPickRepo({ report: reportText(), posts: POSTS }, async (repo) => {
    const { exit, stderr } = await written(repo, [], { vendor, rotation: ROTATION });
    assert.equal(exit, 0, stderr.join('\n'));
    assert.equal(modelRequests(vendor.calls).length, 1);
    const file = repo.json('out/decision.json');
    const [entry] = file.entries;
    assert.deepEqual(
      [entry.claim.origin, entry.claim.category, entry.row, entry.table],
      ['category', AGENTIC, null, null]
    );
    assert.deepEqual(entry.claim.demand, { impressions: 0, position: null });
    assert.equal(Object.hasOwn(entry.claim, 'prompt'), false);
    assert.equal(entry.proposal.calls.length, 1);
    const ledger = readLedger(join(repo.root, file.ledgerPath));
    assert.deepEqual(ledger.generation, callTotals(entry.proposal.calls));
    assert.deepEqual(ledger.generation, { tokens: { input: 1500, output: 50 }, costUsd: 0.00175 });
    assert.equal(openRun({ repoRoot: repo.root, decision: file }).entries[0].anchor, true);
    const prompt = promptOf(modelRequests(vendor.calls)[0]);
    for (const { title } of Object.values(POSTS)) assert.ok(prompt.includes(title), title);
    for (const concept of ['Evals', 'AI register', 'Guardrails']) assert.ok(prompt.includes(concept), concept);
  });
});

test('a second run, with the first claim on disk, rotates to the other category', async () => {
  const vendor = vendorAnswering(answerWith(QUERY_ACCEPTED), answerWith(QUERY_PRICE));
  await withPickRepo({ report: reportText(), posts: POSTS }, async (repo) => {
    assert.equal((await written(repo, [], { vendor, rotation: ROTATION })).exit, 0);
    const first = repo.json('out/decision.json').entries[0].claim;
    assert.equal((await written(repo, [], { vendor, rotation: ROTATION })).exit, 0);
    const second = repo.json('out/decision.json').entries[0].claim;
    assert.deepEqual([first.category, second.category], [AGENTIC, GOVERNANCE]);
    assert.notEqual(second.slug, first.slug);
    assert.ok(promptOf(modelRequests(vendor.calls)[1]).includes(first.title));
  });
});

test('a proposal that rewords an article is refused as the same subject, and the second attempt is told why and succeeds', async () => {
  const vendor = vendorAnswering(answerWith(QUERY_ACCEPTED), answerWith(QUERY_PRICE, { input: 1000, output: 20 }));
  const posts = { 'incident-runbook': { ...POSTS['older-review'], title: 'An AI incident runbook for a small team' } };
  await withPickRepo({ report: reportText(), posts }, async (repo) => {
    const { exit, stdout, stderr } = await written(repo, [], { vendor, rotation: [GOVERNANCE] });
    assert.equal(exit, 0, stderr.join('\n'));
    const [first, second] = modelRequests(vendor.calls).map(promptOf);
    assert.equal(first.includes(QUERY_ACCEPTED), false);
    assert.ok(second.includes(QUERY_ACCEPTED) && second.includes('/blog/incident-runbook'), second);
    const file = repo.json('out/decision.json');
    assert.equal(file.entries[0].proposal.calls.length, 2);
    assert.equal(file.entries[0].claim.query, QUERY_PRICE);
    const [refusal] = readLedger(join(repo.root, file.ledgerPath)).refusals;
    assert.deepEqual([refusal.reason, refusal.against], ['same-subject', '/blog/incident-runbook']);
    assert.ok(
      stdout.some((line) => line.includes('was refused (same-subject)')),
      stdout.join('\n')
    );
  });
});

for (const [kind, vendor, env] of [
  ['credential', adapterOn({ routes: { [ROUTES.models]: () => reply(errorBody(), 401) } }), undefined],
  ['config', adapterOn(), {}],
]) {
  test(`a ${kind} failure aborts the pick: the last stdout line is the failure, the exit is 1 and nothing is written`, async () => {
    await withPickRepo({ report: reportText(), posts: POSTS }, async (repo) => {
      const { exit, stdout, stderr } = await written(repo, [], { vendor, env, rotation: ROTATION });
      assert.equal(exit, 1);
      const failure = lastLine(stdout);
      assert.deepEqual([failure.ok, failure.kind, failure.spend], [false, kind, NO_SPEND]);
      assert.ok(stderr.join('\n').includes(`pick:topic failed (${kind})`), stderr.join('\n'));
      assert.deepEqual(repo.filesBelow('audits/autowriter'), []);
      assert.deepEqual(repo.filesBelow('out'), []);
    });
  });
}

test('a price failure after a billed call aborts the pick and the failure carries the spend of both calls', async () => {
  const cacheWrite = () => reply(response({ usage: usageOf(12000, 800, { cache_write_tokens: 7000 }) }));
  const vendor = vendorAnswering(answerWith(QUERY_REGISTER), cacheWrite);
  await withPickRepo({ report: reportText(), posts: { 'incident-runbook': POSTS['older-review'] } }, async (repo) => {
    const { exit, stdout } = await written(repo, [], { vendor, rotation: [GOVERNANCE] });
    assert.equal(exit, 1);
    const failure = lastLine(stdout);
    assert.equal(failure.kind, 'price');
    assert.deepEqual(failure.spend, { tokens: { input: 13200, output: 1600 }, costUsd: 0.0212 });
  });
});

test('a preview names the rotation order and that no model is called, and it neither calls the model nor writes anything', async () => {
  const vendor = vendorAnswering(answerWith(QUERY_ACCEPTED));
  await withPickRepo({ report: reportText(), posts: POSTS }, async (repo) => {
    const { exit, stdout } = await repo.run([], { vendor, rotation: ROTATION });
    assert.equal(exit, 0);
    assert.equal(vendor.calls.length, 0);
    const rotation = `Category rotation: ${AGENTIC}, ${GOVERNANCE}. No model is called without --write.`;
    assert.ok(stdout.includes(rotation), stdout.join('\n'));
    assert.deepEqual(repo.filesBelow('audits/autowriter'), []);
  });
});

test('the summary of a category pick names the proposals and the cost the ledger of the claim records', async () => {
  const vendor = vendorAnswering(answerWith(QUERY_ACCEPTED));
  await withPickRepo({ report: reportText(), posts: POSTS }, async (repo) => {
    const summary = join(repo.root, 'summary.md');
    assert.equal((await written(repo, ['--summary', summary], { vendor, rotation: ROTATION })).exit, 0);
    const text = repo.read('summary.md');
    assert.ok(text.includes('### Category proposals'), text);
    assert.ok(text.includes('- Category agentic-architecture: "how to write an ai incident runbook" was taken.'), text);
    assert.ok(text.includes('the ledger of the claim records them.'), text);
    assert.ok(text.includes('category agentic-architecture'), text);
  });
});
