import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AGENTIC,
  GOVERNANCE,
  QUERY_ACCEPTED,
  QUERY_OTHER,
  QUERY_REGISTER,
  answerWith,
  modelRequests,
  promptOf,
  proposalScene,
} from './fixtures/proposal-scene.mjs';
import {
  ROUTES,
  completed,
  errorBody,
  modelList,
  refused,
  reply,
  response,
  truncated,
  usageOf,
} from './fixtures/writer-vendors.mjs';
import { callTotals } from './generation-record.mjs';
import { proposeTopic } from './topic-proposal.mjs';
import { WriterError } from './writer-error.mjs';

const run = ({ decision, inputs, adapter }) => proposeTopic({ decision, inputs, adapter });
const failing = (build) => () => reply(build());
const serverError = () => reply(errorBody(), 500);
const cutOff = () => reply(truncated());
const stepsOf = (decision) => decision.trail.map(({ category, outcome }) => [category, outcome]);
const rejection = async (scene) => {
  try {
    await run(scene);
  } catch (error) {
    return error;
  }
  return assert.fail('the proposals were expected to abort');
};
const CACHE_WRITE = () => reply(response({ usage: usageOf(12000, 800, { cache_write_tokens: 7000 }) }));
const NO_SPEND = { tokens: { input: 0, output: 0 }, costUsd: 0 };

test('a vendor failure is a failed attempt, not billed, and the next attempt asks the same question again', async () => {
  const scene = proposalScene({ answers: [serverError, answerWith(QUERY_ACCEPTED)] });
  const { decision, calls } = await run(scene);
  assert.equal(decision.decision, 'write');
  assert.deepEqual(stepsOf(decision), [
    [GOVERNANCE, 'proposal-failed'],
    [GOVERNANCE, 'chosen'],
  ]);
  const [failed] = decision.trail;
  assert.equal(failed.detail, 'openai answered HTTP 500');
  assert.equal(Object.hasOwn(failed, 'query'), false);
  assert.equal(calls.length, 1);
  const [first, second] = modelRequests(scene.sent).map(promptOf);
  assert.equal(second, first);
});

test('an output failure is a failed attempt whose billed call is still recorded as a topic call', async () => {
  const scene = proposalScene({ answers: [cutOff, answerWith(QUERY_ACCEPTED)] });
  const { decision, calls } = await run(scene);
  assert.equal(decision.decision, 'write');
  assert.equal(decision.trail[0].outcome, 'proposal-failed');
  assert.match(decision.trail[0].detail, /max_output_tokens/);
  assert.deepEqual(
    calls.map(({ role, stopReason }) => [role, stopReason]),
    [
      ['topic', 'max_output_tokens'],
      ['topic', 'completed'],
    ]
  );
  assert.deepEqual(decision.entries[0].proposal, { calls });
});

test('a model that refuses to answer is a failed attempt too, and its call is billed', async () => {
  const scene = proposalScene({ answers: [failing(() => refused()), answerWith(QUERY_ACCEPTED)] });
  const { decision, calls } = await run(scene);
  assert.equal(decision.trail[0].outcome, 'proposal-failed');
  assert.match(decision.trail[0].detail, /refused to answer/);
  assert.equal(calls.length, 2);
});

test('every attempt failing leaves a none decision that names the failures, and the billed calls are returned', async () => {
  const scene = proposalScene({ answers: [cutOff] });
  const { decision, calls } = await run(scene);
  assert.equal(decision.decision, 'none');
  assert.deepEqual(stepsOf(decision), [
    [GOVERNANCE, 'proposal-failed'],
    [GOVERNANCE, 'proposal-failed'],
    [AGENTIC, 'proposal-failed'],
    [AGENTIC, 'proposal-failed'],
  ]);
  assert.ok(decision.reason.includes(`${GOVERNANCE} (proposal-failed, proposal-failed)`), decision.reason);
  assert.deepEqual(decision.refusals, []);
  assert.equal(calls.length, 4);
  assert.equal(callTotals(calls).costUsd, 0.0208);
});

test('failed and refused attempts mix: a vendor failure then a refusal in one category, then the next category', async () => {
  const answers = [serverError, answerWith(QUERY_REGISTER), answerWith(QUERY_OTHER)];
  const { decision } = await run(proposalScene({ answers }));
  assert.deepEqual(stepsOf(decision), [
    [GOVERNANCE, 'proposal-failed'],
    [GOVERNANCE, 'register-owner'],
    [AGENTIC, 'chosen'],
  ]);
});

for (const [name, text] of [
  ['no query field', '{"other":"x"}'],
  ['an empty query', '{"query":"  "}'],
  ['a query that is not text', '{"query":5}'],
]) {
  test(`an answer with ${name} is a failed attempt, and its call is billed`, async () => {
    const answers = [failing(() => completed({ text })), answerWith(QUERY_ACCEPTED)];
    const { decision, calls } = await run(proposalScene({ answers }));
    assert.equal(decision.trail[0].outcome, 'proposal-failed');
    assert.match(decision.trail[0].detail, /no query/);
    assert.equal(calls.length, 2);
  });
}

for (const [kind, routes] of [
  ['credential', { [ROUTES.models]: () => reply(errorBody(), 401) }],
  ['model', { [ROUTES.models]: () => reply(modelList({ ids: ['some-other-model'] })) }],
]) {
  test(`a ${kind} failure aborts the pick before anything is billed, carrying the spend so far`, async () => {
    const scene = proposalScene({ answers: [answerWith(QUERY_ACCEPTED)], routes });
    const error = await rejection(scene);
    assert.ok(error instanceof WriterError);
    assert.equal(error.kind, kind);
    assert.deepEqual(error.spend, NO_SPEND);
    assert.equal(modelRequests(scene.sent).length, 0);
  });
}

test('a price failure after one billed call aborts the pick, and the spend counts both calls', async () => {
  const scene = proposalScene({ answers: [answerWith(QUERY_REGISTER), CACHE_WRITE, answerWith(QUERY_OTHER)] });
  const error = await rejection(scene);
  assert.equal(error.kind, 'price');
  assert.equal(modelRequests(scene.sent).length, 2);
  assert.deepEqual(error.spend, { tokens: { input: 13200, output: 1600 }, costUsd: 0.0212 });
});

test('a config failure from the adapter aborts the pick', async () => {
  const scene = proposalScene({ answers: [answerWith(QUERY_ACCEPTED)] });
  const adapter = {
    ...scene.adapter,
    complete: async () => {
      throw new WriterError('config', 'the writer is not configured', { variables: ['WRITING_PROVIDER'] });
    },
  };
  const error = await rejection({ ...scene, adapter });
  assert.deepEqual([error.kind, error.variables, error.spend], ['config', ['WRITING_PROVIDER'], NO_SPEND]);
});

test('an error that is not a writer error passes through untouched', async () => {
  const scene = proposalScene({ answers: [answerWith(QUERY_ACCEPTED)] });
  const adapter = {
    ...scene.adapter,
    complete: async () => {
      throw new TypeError('a bug');
    },
  };
  const error = await rejection({ ...scene, adapter });
  assert.ok(error instanceof TypeError);
  assert.equal(Object.hasOwn(error, 'spend'), false);
});

test('a write decision, and a decision with no category to try, are refused', async () => {
  const written = (await run(proposalScene({ answers: [answerWith(QUERY_ACCEPTED)] }))).decision;
  const scene = proposalScene({ answers: [answerWith(QUERY_ACCEPTED)], rotation: [] });
  await assert.rejects(run({ ...scene, decision: written }), TypeError);
  await assert.rejects(run(scene), TypeError);
  assert.equal(modelRequests(scene.sent).length, 0);
});
