import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';

import { newClaim } from './autowriter-claim-store.mjs';
import { readClaim } from './autowriter-claim-store.mjs';
import { readLedger } from './autowriter-ledger.mjs';
import {
  AGENTIC,
  GOVERNANCE,
  QUERY_ACCEPTED,
  QUERY_DEFINITION,
  QUERY_REGISTER,
  answerWith,
  modelRequests,
} from './fixtures/proposal-scene.mjs';
import { NOW, provenPrompt, queryRow, reportText, unprovenPrompt, withPickRepo } from './fixtures/pick-scene.mjs';
import { createScene } from './fixtures/spend-scene.mjs';
import { ROUTES, adapterOn, errorBody, inSequence, reply } from './fixtures/writer-vendors.mjs';
import { recordPath } from './record-layout.mjs';
import { runCli as spendEnded } from './spend-ended.mjs';
import { topicFrom } from './topic-format.mjs';

const WEAK_QUERY = 'how to budget for an ai pilot';
const WEBHOOK = 'https://hooks.slack.test/services/T0SECRET/B0SECRET/xoxSECRETpath';
const SPENT_PROMPTS = [provenPrompt(1, 'fractional CAIO pricing'), unprovenPrompt(2, 'what is a model card')];
const reportWith = (...rows) => reportText({ prompts: SPENT_PROMPTS, queries: rows });
const written = (repo, argv = [], io = {}) =>
  repo.run(['--write', '--output', join(repo.root, 'out', 'decision.json'), ...argv], io);
const post = (title, publishDate = '2026-10-01') => ({ title, category: GOVERNANCE, publishDate });

test('with no fresh topic the picker takes a measured, unprompted query as weak demand and never calls the model', async () => {
  const vendor = adapterOn();
  await withPickRepo({ report: reportWith(queryRow(WEAK_QUERY, 1, 52.5)) }, async (repo) => {
    const { exit, stdout, stderr } = await written(repo, ['--run-id', 'run-1'], { vendor });
    assert.equal(exit, 0, stderr.join('\n'));
    assert.equal(vendor.calls.length, 0);
    const file = repo.json('out/decision.json');
    const [entry] = file.entries;
    const claim = readClaim(join(repo.root, entry.claimPath));
    assert.deepEqual(claim, entry.claim);
    assert.deepEqual(
      [claim.origin, claim.format, claim.query, claim.demand],
      ['weak-demand', 'article', WEAK_QUERY, { impressions: 1, position: 52.5 }]
    );
    assert.deepEqual(claim.weakness, ['no-buyer-prompt', 'impressions-at-floor', 'position-beyond-strengthen-band']);
    assert.equal(Object.hasOwn(claim, 'prompt'), false);
    assert.deepEqual([entry.table, entry.row.Query], ['Queries', WEAK_QUERY]);
    assert.equal(Object.hasOwn(entry, 'proposal'), false);
    assert.equal(Object.hasOwn(readLedger(join(repo.root, file.ledgerPath)), 'generation'), false);
    assert.ok(stdout[0].startsWith(`Choice: signal 3, "${WEAK_QUERY}", 1 impression at position 52.5`), stdout[0]);
    assert.ok(
      stdout[1].endsWith('weak-demand: no-buyer-prompt, impressions-at-floor, position-beyond-strengthen-band')
    );
  });
});

for (const [impressions, position, weakness] of [
  [1, 52.5, ['no-buyer-prompt', 'impressions-at-floor', 'position-beyond-strengthen-band']],
  [4, 52.5, ['no-buyer-prompt', 'position-beyond-strengthen-band']],
  [1, 6, ['no-buyer-prompt', 'impressions-at-floor']],
  [3, 6, ['no-buyer-prompt']],
]) {
  test(`the weakness of ${impressions} impressions at position ${position} is computed from the row`, async () => {
    await withPickRepo({ report: reportWith(queryRow(WEAK_QUERY, impressions, position)) }, async (repo) => {
      assert.equal((await written(repo)).exit, 0);
      assert.deepEqual(repo.json('out/decision.json').entries[0].claim.weakness, weakness);
    });
  });
}

test('an empty report and an empty rotation end with no entry, no claim and no model call, and exit 0', async () => {
  const vendor = adapterOn();
  await withPickRepo({ report: reportText() }, async (repo) => {
    const { exit, stdout } = await written(repo, [], { vendor, rotation: [] });
    assert.equal(exit, 0);
    assert.equal(vendor.calls.length, 0);
    const reason = 'The report holds no query and no buyer prompt, so there is nothing to choose from.';
    assert.deepEqual(repo.json('out/decision.json'), { schema: 1, decision: 'none', reason, advisories: [] });
    assert.equal(stdout[0], reason);
    assert.deepEqual(repo.filesBelow('audits/autowriter'), []);
  });
});

test('when every candidate is already claimed or written the run ends with no entry, and the claim stays alone', async () => {
  const text = 'how to write an ai acceptable use policy';
  const topic = topicFrom(text);
  const report = reportText({ prompts: [unprovenPrompt(99, text)], queries: [queryRow(WEAK_QUERY, 2, 40)] });
  const posts = { 'how-to-budget-for-an-ai-pilot': post('How to budget for an AI pilot') };
  const vendor = adapterOn();
  await withPickRepo({ report, posts }, async (repo) => {
    const claim = newClaim({
      slug: topic.slug,
      title: topic.title,
      format: 'article',
      query: topic.query,
      demand: { impressions: 0, position: null },
      prompt: { number: 99, text },
      origin: 'demand',
      runId: 'earlier',
      now: NOW,
    });
    const claimPath = recordPath('claim', claim.slug, claim.claimedAt);
    repo.put(claimPath, claim);
    const { exit, stdout, stderr } = await written(repo, [], { vendor, rotation: [] });
    assert.equal(exit, 0, stderr.join('\n'));
    assert.equal(vendor.calls.length, 0);
    const file = repo.json('out/decision.json');
    assert.equal(file.decision, 'none');
    assert.ok(file.reason.startsWith('No candidate.'), file.reason);
    assert.equal(stdout[0], file.reason);
    assert.deepEqual(repo.filesBelow('audits/autowriter'), [claimPath]);
  });
});

test('every proposal refused or failed ends with no entry that names each refusal and the spend, and the Slack notice still renders', async () => {
  const answers = [
    answerWith(QUERY_DEFINITION),
    () => reply(errorBody(), 500),
    answerWith(QUERY_ACCEPTED),
    answerWith(QUERY_REGISTER),
  ];
  const vendor = adapterOn({ routes: { [ROUTES.responses]: inSequence(...answers) } });
  const posts = { 'incident-runbook': post('An AI incident runbook for a small team') };
  await withPickRepo({ report: reportText(), posts }, async (repo) => {
    const summary = join(repo.root, 'summary.md');
    const { exit, stdout, stderr } = await written(repo, ['--summary', summary], {
      vendor,
      rotation: [GOVERNANCE, AGENTIC],
    });
    assert.equal(exit, 0, stderr.join('\n'));
    assert.equal(modelRequests(vendor.calls).length, 4);
    const file = repo.json('out/decision.json');
    assert.equal(file.decision, 'none');
    for (const tried of [
      `${AGENTIC} (format-mismatch, proposal-failed)`,
      `${GOVERNANCE} (same-subject, register-owner)`,
    ]) {
      assert.ok(file.reason.includes(tried), file.reason);
    }
    const steps = stdout.filter((line) => line.startsWith('Category '));
    assert.deepEqual(
      steps.map((line) => line.match(/\((format-mismatch|proposal-failed|same-subject|register-owner)\)/)?.[1]),
      ['format-mismatch', 'proposal-failed', 'same-subject', 'register-owner']
    );
    const spend = 'Topic proposals: 3 calls, 3600 input and 2400 output tokens, 0.0156 USD; no ledger records them.';
    assert.ok(stdout.includes(spend), stdout.join('\n'));
    assert.ok(repo.read('summary.md').includes(`- ${spend}`));
    assert.deepEqual(repo.filesBelow('audits/autowriter'), []);
    const ended = createScene();
    try {
      const posted = [];
      const slack = async (url, init) => posted.push(JSON.parse(init.body)) && new Response('ok', { status: 200 });
      const output = join(repo.root, 'out', 'decision.json');
      const argv = ['pick', '--decision', output, '--repo-root', ended.root];
      const failures = [];
      const io = {
        env: { SLACK_WEBHOOK_URL: WEBHOOK },
        fetch: slack,
        now: () => NOW,
        stdout: () => {},
        stderr: (text) => failures.push(text),
      };
      assert.equal(await spendEnded(argv, io), 0, failures.join('\n'));
      assert.equal(posted.length, 1);
      assert.ok(posted[0].text.includes('the picker chose nothing to write'), posted[0].text);
      assert.ok(posted[0].text.includes(GOVERNANCE), posted[0].text);
    } finally {
      ended.cleanup();
    }
  });
});
