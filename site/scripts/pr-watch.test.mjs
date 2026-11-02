import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { HOLD_LABEL } from './pr-classify.mjs';
import { SECRET, TICK_ENVIRONMENT, TICK_MINUTES, WORKFLOW, WatchError } from './pr-watch.mjs';
import {
  DEFAULT_TOKEN,
  PAT,
  callOf,
  cancelled,
  green,
  harness,
  queued,
  readJson,
  written,
  writtenNames,
} from './fixtures/pr-watch-harness.mjs';

test('a missing token fails before any request and names the secret', async () => {
  const { run, calls, env } = await harness({ bundle: green() });
  delete env[SECRET];

  await assert.rejects(run(), (error) => error instanceof WatchError && error.message.includes(SECRET));
  assert.deepEqual(calls, []);
});

test('a token that is only whitespace counts as missing', async () => {
  const { run, calls, env } = await harness({ bundle: green() });
  env[SECRET] = '  \n';

  await assert.rejects(run(), /AUTOWRITER_PAT/);
  assert.deepEqual(calls, []);
});

test('reads use the default token, and the merge and the successor use the bot token', async () => {
  const merged = await harness({ bundle: green() });
  await merged.run();
  const waiting = await harness({ bundle: queued(green()) });
  await waiting.run();

  assert.deepEqual(merged.calls[0], ['readSnapshot', DEFAULT_TOKEN, 72]);
  assert.equal(callOf(merged.calls, 'merge')[1], PAT);
  assert.equal(callOf(waiting.calls, 'dispatch')[1], PAT);
});

test('green checks after the window merge the head that was judged, once, then record the debt and dispatch nothing', async () => {
  const bundle = green();
  const { run, calls } = await harness({ bundle });
  const { action } = await run();

  assert.equal(action, 'merged');
  assert.deepEqual(writtenNames(calls), ['merge', 'putLedger']);
  assert.deepEqual(callOf(calls, 'merge')[2], { number: 72, head: bundle.pullRequest.head.sha });
});

test('a merge that finds the head moved is a stale read, so a successor is dispatched instead', async () => {
  const merge = { merged: false, reason: 'head-moved', message: 'Head branch was modified' };
  const { run, calls } = await harness({ bundle: green(), merge });
  const { action } = await run();

  assert.equal(action, 'successor');
  assert.deepEqual(writtenNames(calls), ['merge', 'dispatch']);
});

test('a merge GitHub refuses is escalated as a hard stop and only the ledger is written after it', async () => {
  const merge = { merged: false, reason: 'refused', message: 'Pull Request is not mergeable' };
  const { run, calls, requests, ledgerPath } = await harness({ bundle: green(), merge });
  const { action } = await run();

  assert.equal(action, 'escalated');
  assert.equal(readJson(ledgerPath).escalations[0].kind, 'hard-stop');
  assert.match(requests[0].body.body, /Pull Request is not mergeable/);
  assert.deepEqual(writtenNames(calls), ['merge', 'putLedger']);
});

test('checks that are not settled dispatch one successor with the pull request and an empty observation', async () => {
  const { run, calls } = await harness({ bundle: queued(green()) });
  const { action } = await run();

  assert.equal(action, 'successor');
  assert.deepEqual(written(calls), [
    ['dispatch', PAT, { workflow: WORKFLOW, ref: 'main', inputs: { pr: '72', observed: '' } }],
  ]);
});

test('the observation of an inconclusive cancellation is handed to the successor', async () => {
  const { run, calls } = await harness({ bundle: cancelled(green()) });
  await run();
  const [, , { inputs }] = callOf(calls, 'dispatch');

  assert.match(inputs.observed, /^cancelled:[0-9a-f]{40}:\d+:1$/);
});

test('green checks inside the quarantine window dispatch a successor and do not merge', async () => {
  const { run, calls } = await harness({ bundle: green(), hours: 1 });
  const { action, result } = await run();

  assert.equal(action, 'successor');
  assert.equal(result.reason, 'quarantine');
  assert.equal(
    calls.some(([name]) => name === 'merge'),
    false
  );
});

test('the tick environment is checked before a successor, and a problem with it stops the chain loudly', async () => {
  const tick = 'the environment autowriter-tick has no wait timer';
  const { run, calls } = await harness({ bundle: green(), hours: 1, tick });

  await assert.rejects(run(), /no wait timer/);
  assert.deepEqual(callOf(calls, 'tickProblem').slice(2), [{ environment: TICK_ENVIRONMENT, minutes: TICK_MINUTES }]);
  assert.equal(
    calls.some(([name]) => name === 'dispatch'),
    false
  );
});

test('a successor needs the branch that holds the workflow, and says so when it is unknown', async () => {
  const { run, calls, env } = await harness({ bundle: queued(green()) });
  delete env.GITHUB_REF_NAME;

  await assert.rejects(run(), /GITHUB_REF_NAME/);
  assert.deepEqual(written(calls), []);
});

test('a pull request held by a human is left alone: no write, no issue, no ledger', async () => {
  const pullRequestPatch = { labels: [{ name: HOLD_LABEL }] };
  const { run, calls, requests, ledgerPath } = await harness({ bundle: green(), hours: 40, pullRequestPatch });
  const { action, result } = await run();

  assert.equal(action, 'stopped');
  assert.equal(result.reason, 'hold-label');
  assert.deepEqual(written(calls), []);
  assert.deepEqual(requests, []);
  assert.equal(existsSync(ledgerPath), false);
});

test('a pull request that is already merged ends the chain without a write', async () => {
  const pullRequestPatch = { merged: true, state: 'closed' };
  const { run, calls, requests } = await harness({ bundle: green(), hours: 40, pullRequestPatch });
  const { action, result } = await run();

  assert.equal(action, 'stopped');
  assert.equal(result.verdict, 'done');
  assert.deepEqual(written(calls), []);
  assert.deepEqual(requests, []);
});

test('the step summary names the verdict, the reason and the head judged', async () => {
  const bundle = green();
  const { run, summary } = await harness({ bundle });
  await run();
  const text = readFileSync(summary, 'utf8');

  assert.match(text, /merge/);
  assert.match(text, /green-after-quarantine/);
  assert.match(text, new RegExp(bundle.pullRequest.head.sha));
});

test('the step summary is still written when the action fails, and it says so', async () => {
  const tick = 'the environment autowriter-tick has no wait timer';
  const { run, summary } = await harness({ bundle: queued(green()), tick });

  await assert.rejects(run(), /no wait timer/);
  assert.match(readFileSync(summary, 'utf8'), /failed/);
});
