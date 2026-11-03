import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { HOLD_LABEL } from './pr-classify.mjs';
import { WORKFLOW } from './pr-watch.mjs';
import { REPAIR_STATEMENTS } from './pr-watch-repair.mjs';
import { OUTCOMES } from './repair-outcome.mjs';
import { human, lastCommitBy } from './fixtures/pr-classify-helpers.mjs';
import { withNoChecksAtAll } from './fixtures/pr-watch.mjs';
import {
  DEFAULT_TOKEN,
  PAT,
  callOf,
  green,
  harness,
  ledgerRecord,
  readJson,
  slackMessageOf,
  spentAttempts,
  writtenNames,
} from './fixtures/pr-watch-harness.mjs';

const REPOSITORY_URL = 'https://github.test/meshin-co/website';
const REPAIR_RUN_URL = `${REPOSITORY_URL}/actions/runs/555`;
const PULL_REQUEST_URL = `${REPOSITORY_URL}/pull/72`;

const STATEMENTS = {
  unrepairable:
    "the gate's findings cannot be repaired by rewriting the entry, or the rewrite could not be made to pass the repair's own checks",
  'no-convergence': 'the same rule failed on the same path twice, or the attempt cap is spent',
  'spend-ceiling': 'the monthly spend ceiling is reached, so no model was called',
  credential: 'the vendor key is missing or was refused',
  failed: 'the repair job failed before it could finish',
};

const FILED_AS = {
  unrepairable: 'unrepairable',
  'no-convergence': 'no-convergence',
  'spend-ceiling': 'spend-ceiling',
  credential: 'credential',
  failed: 'hard-stop',
};

const REQUESTS = { unrepairable: 1, 'no-convergence': 2, 'spend-ceiling': 2, credential: 2, failed: 1 };

const detailOf = (outcome, { run = REPAIR_RUN_URL, pullRequest = PULL_REQUEST_URL } = {}) =>
  [
    `The repair of pull request #72 ended as ${outcome}: ${STATEMENTS[outcome]}.`,
    ...(run === null ? [] : [`Repair run: ${run}`]),
    `Pull request: ${pullRequest}`,
  ].join('\n');

const afterRepair = (outcome, options = {}) => harness({ bundle: green(), afterRepair: outcome, ...options });
const repairedOnce = (bundle = green()) => harness({ bundle, afterRepair: 'repaired' });

test('the statements are those of the outcomes that stop the loop, one fixed sentence each', () => {
  assert.deepEqual(REPAIR_STATEMENTS, STATEMENTS);
  assert.deepEqual(
    Object.keys(STATEMENTS).toSorted(),
    OUTCOMES.filter((outcome) => !['repaired', 'stale'].includes(outcome)).toSorted()
  );
});

for (const outcome of Object.keys(STATEMENTS)) {
  test(`a repair that ended as ${outcome} raises one ${FILED_AS[outcome]} escalation that says only the fixed statement and the repair run`, async () => {
    const { run, calls, requests, ledgerPath } = await afterRepair(outcome);
    const { action, result } = await run();
    const ledger = readJson(ledgerPath);
    const title = `Autowriter pull request #72: ${STATEMENTS[outcome]}`;
    const [issue] = requests;

    assert.equal(result.verdict, 'escalate');
    assert.equal(action, 'escalated');
    assert.equal(ledger.escalations.length, 1);
    assert.equal(ledger.escalations[0].kind, FILED_AS[outcome]);
    assert.equal(ledger.escalations[0].title, title);
    assert.equal(ledger.escalations[0].detail, detailOf(outcome));
    assert.equal(ledger.verdict.state, 'escalated');
    assert.equal(issue.body.title, title);
    assert.ok(issue.body.body.startsWith(`${detailOf(outcome)}\n\n---\n`), issue.body.body);
    assert.equal(requests.length, REQUESTS[outcome]);
    assert.deepEqual(writtenNames(calls), ['putLedger']);
  });
}

test('the escalation after a repair is recorded on the pull request branch by the bot, keeping what the ledger held', async () => {
  const stored = ledgerRecord({ attempts: spentAttempts });
  const { run, calls } = await afterRepair('no-convergence', { ledger: stored });
  await run();
  const [, token, push] = callOf(calls, 'putLedger');
  const pushed = JSON.parse(push.text);

  assert.equal(token, PAT);
  assert.equal(push.branch, 'autowriter/a-slug');
  assert.equal(push.blobSha, stored.blobSha);
  assert.equal(pushed.attempts.length, spentAttempts.length);
  assert.equal(pushed.verdict.state, 'escalated');
});

test('the repair run link follows the server and run the workflow names', async () => {
  const { run, env, ledgerPath } = await afterRepair('failed');
  env.GITHUB_SERVER_URL = 'https://git.example.test';
  env.GITHUB_RUN_ID = '9001';
  await run();

  assert.match(
    readJson(ledgerPath).escalations[0].detail,
    /Repair run: https:\/\/git\.example\.test\/meshin-co\/website\/actions\/runs\/9001/
  );
});

test('a repair run the workflow does not name is left out of the finding, and no run id is made up', async () => {
  const { run, env, ledgerPath } = await afterRepair('failed');
  delete env.GITHUB_RUN_ID;
  await run();

  assert.equal(readJson(ledgerPath).escalations[0].detail, detailOf('failed', { run: null }));
});

test('with no server named the finding names the pull request by its number and leaves out the repair run', async () => {
  const { run, env, ledgerPath } = await afterRepair('failed');
  delete env.GITHUB_SERVER_URL;
  await run();

  assert.equal(readJson(ledgerPath).escalations[0].detail, detailOf('failed', { run: null, pullRequest: '#72' }));
});

test('the Slack message of an escalation after a repair shows the repair run and the pull request as links', async () => {
  const { run, requests } = await afterRepair('no-convergence');
  await run();
  const { text } = slackMessageOf(requests);
  const links = `\nRepair run: <${REPAIR_RUN_URL}|run 555>\nPull request: <${PULL_REQUEST_URL}|#72>\n`;

  assert.ok(text.includes(links), text);
});

test('an escalation that needs Slack and has no webhook still records the ledger, then fails the job', async () => {
  const { run, calls, ledgerPath } = await afterRepair('credential', { slack: false });

  await assert.rejects(run(), /was not delivered/);
  assert.equal(readJson(ledgerPath).escalations[0].kind, 'credential');
  assert.deepEqual(writtenNames(calls), ['putLedger']);
});

for (const outcome of ['repaired', 'stale']) {
  test(`a repair that ended as ${outcome} dispatches the successor with nothing observed, and escalates nothing`, async () => {
    const { run, calls, requests } = await afterRepair(outcome);
    const { action, result } = await run();

    assert.equal(action, 'successor');
    assert.equal(result.reason, outcome);
    assert.deepEqual(callOf(calls, 'dispatch'), [
      'dispatch',
      PAT,
      { workflow: WORKFLOW, ref: 'main', inputs: { pr: '72', observed: '' } },
    ]);
    assert.deepEqual(writtenNames(calls), ['dispatch']);
    assert.deepEqual(requests, []);
  });
}

test('after a repair the snapshot is read fresh with the read token, once, and the checks of the new head are not asked for', async () => {
  const { run, calls } = await repairedOnce(withNoChecksAtAll(green()));
  const { action } = await run();

  assert.equal(action, 'successor');
  assert.deepEqual(
    calls.map(([name]) => name),
    ['readSnapshot', 'tickProblem', 'dispatch']
  );
  assert.deepEqual(calls[0], ['readSnapshot', DEFAULT_TOKEN, 72]);
});

test('no repair outcome merges, records a debt or reads a tree', async () => {
  for (const outcome of OUTCOMES) {
    const { run, calls } = await afterRepair(outcome);
    await run();

    for (const name of ['merge', 'readTree', 'readLedgerAt'])
      assert.equal(
        calls.some(([called]) => called === name),
        false,
        `${outcome} called ${name}`
      );
  }
});

test('a tick environment with a problem stops the chain after a repair, loudly and without a successor', async () => {
  const { run, calls } = await afterRepair('repaired', { tick: 'the environment autowriter-tick has no wait timer' });

  await assert.rejects(run(), /no wait timer/);
  assert.equal(
    calls.some(([name]) => name === 'dispatch'),
    false
  );
});

const OWNED = {
  'a hold label': { pullRequestPatch: { labels: [{ name: HOLD_LABEL }] } },
  'a closed pull request': { pullRequestPatch: { state: 'closed' } },
  'a merged pull request': { pullRequestPatch: { state: 'closed', merged: true } },
  'a draft': { pullRequestPatch: { draft: true } },
  'a commit by a person': { commits: lastCommitBy(green(), human) },
  'a ledger a person decided': {
    ledger: ledgerRecord({
      verdict: { state: 'stopped', reason: 'a person stopped it', decidedAt: '2026-11-02T08:00:00.000Z' },
    }),
  },
};

for (const [name, options] of Object.entries(OWNED)) {
  test(`${name} is a pull request a person owns, so no repair outcome escalates it or chains a successor`, async () => {
    for (const outcome of OUTCOMES) {
      const { run, calls, requests, summary } = await afterRepair(outcome, options);
      const { action } = await run();

      assert.equal(action, 'stopped', `${name} after ${outcome}`);
      assert.deepEqual(writtenNames(calls), [], `${name} after ${outcome}`);
      assert.deepEqual(requests, [], `${name} after ${outcome}`);
      assert.match(readFileSync(summary, 'utf8'), /\| Action \| `stopped` \|/);
    }
  });
}

test('a commit list that has not caught up with the push is ignored, so the outcome is still acted on', async () => {
  const head = { ...green().pullRequest.head, ref: 'autowriter/a-slug', sha: 'c'.repeat(40) };
  const chained = await afterRepair('repaired', { pullRequestPatch: { head } });
  const stopped = await afterRepair('no-convergence', { pullRequestPatch: { head } });

  assert.equal((await chained.run()).action, 'successor');
  assert.equal((await stopped.run()).action, 'escalated');
});

test('the step summary names what was done after the repair', async () => {
  const { run, summary } = await repairedOnce();
  await run();
  const text = readFileSync(summary, 'utf8');

  assert.match(text, /\| Verdict \| `unsettled` \|/);
  assert.match(text, /\| Reason \| `repaired` \|/);
  assert.match(text, /\| Action \| `successor` \|/);
});

test('a repair outcome never asks the workflow for another repair', async () => {
  for (const outcome of OUTCOMES) {
    const { run, outputs } = await afterRepair(outcome, { slack: true });
    await run();

    assert.equal(readFileSync(outputs, 'utf8'), 'repair=false\n', outcome);
  }
});
