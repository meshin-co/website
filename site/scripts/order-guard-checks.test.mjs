import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';

import { FAMILIES, manifestFamilies, provesOf } from './mutation-smoke.mjs';
import { ORDER_CHECKS, loadOrderModules, runOrderCheck } from './order-guard-checks.mjs';

const SITE = resolve(import.meta.dirname, '..');
const NAME = 'order-refusal-is-terminal';
const FALLBACK = 'Why do AI pilots fail to reach production?';
const REAL = await loadOrderModules(SITE);
const real = REAL.selection.selectTopic;
const check = ORDER_CHECKS[NAME];

const withSelect = (selectTopic) => ({ ...REAL, selection: { ...REAL.selection, selectTopic } });
const whenRefused = (change) => (inputs) => {
  const decision = real(inputs);
  return decision.decision === 'none' ? change(decision, inputs) : decision;
};
const failing = (selectTopic, pattern) => {
  const result = check(withSelect(selectTopic));
  assert.equal(result.ok, false, result.reason);
  assert.match(result.reason, pattern);
};

test('the order guard has one check, and nothing else is named', () => {
  assert.deepEqual(Object.keys(ORDER_CHECKS), [NAME]);
  assert.equal(typeof check, 'function');
});

test('the check passes on the repository as it is, and says what it saw', async () => {
  const result = await runOrderCheck(NAME, SITE);
  assert.equal(result.ok, true, result.reason);
  assert.match(result.reason, /a refused order ends in none with no entry/);
  assert.ok(result.reason.includes(FALLBACK), result.reason);
});

test('a check that does not exist is an error, not a pass', async () => {
  await assert.rejects(runOrderCheck('order-nothing', SITE), /no order check named order-nothing/);
  await assert.rejects(runOrderCheck('constructor', SITE), /no order check named constructor/);
});

test('a check reads the modules of the tree it is given, so a missing tree is an error', async () => {
  await assert.rejects(runOrderCheck(NAME, resolve(SITE, 'no-such-tree')));
});

test('the check fails when a refused order gives a reason that does not name the order and its refusal', () => {
  failing(
    whenRefused((decision) => ({ ...decision, reason: 'No topic today.' })),
    /a refused order \(prompt 11\) gave a reason that does not name the order and its refusal/
  );
});

test('the check fails when a refused order still holds an entry', () => {
  failing(
    whenRefused((decision) => ({ ...decision, entries: [{ topic: { title: 'Held' }, origin: 'ordered' }] })),
    /a refused order \(prompt 11\) still holds 1 entry/
  );
});

test('the check fails when a build ignores the order and writes what the ladder would have written', () => {
  failing(
    (inputs) => real({ ...inputs, order: null }),
    /a refused order \(prompt 11\) ended in a write decision that writes "Why do AI pilots fail to reach production\?"/
  );
});

test('the check fails when a build falls back to the ladder only after the order was refused', () => {
  failing(
    whenRefused((_decision, inputs) => real({ ...inputs, order: null })),
    /a refused order \(prompt 11\) ended in a write decision that writes "Why do AI pilots fail to reach production\?"/
  );
});

test('the check fails when a refused order leaves a category rotation, because a model call would then write another topic', () => {
  failing(
    whenRefused((decision) => ({ ...decision, fallback: { categories: ['governance'] } })),
    /a refused order \(prompt 11\) left a category rotation for a model call to try/
  );
});

test('the check fails when a refused order still reports a strengthen, an advisory or a proposal', () => {
  const changes = [
    { strengthen: { route: '/x' } },
    { advisories: [{ route: '/x' }] },
    { proposals: [{ query: 'how to audit an ai vendor' }] },
  ];
  for (const change of changes) {
    failing(
      whenRefused((decision) => ({ ...decision, ...change })),
      /a refused order \(prompt 11\) still reported other topics/
    );
  }
});

test('the check fails when a refused order names the topic the ladder would have written', () => {
  failing(
    whenRefused((decision) => ({ ...decision, reason: decision.reason + ' ' + FALLBACK })),
    /a refused order \(prompt 11\) names "Why do AI pilots fail to reach production\?"/
  );
});

test('the check fails when a build exempts orders from the occupancy checks', () => {
  failing(
    (inputs) => real({ ...inputs, concepts: [], claims: [], posts: [] }),
    /a refused order \(prompt 11\) ended in a write decision that writes "How to put evals for AI agents into CI"/
  );
});

test('the check fails when a refused order by title falls back, though the order by number was refused', () => {
  failing(
    (inputs) => (inputs.order?.kind === 'title' ? real({ ...inputs, order: null }) : real(inputs)),
    /a refused order \("How to put evals into CI"\) ended in a write decision/
  );
});

test('the check fails when the scene offers no topic to fall back to, so a none could not prove the order was terminal', () => {
  failing(
    () => ({ decision: 'none', entries: [] }),
    /the scene offers no topic to fall back to: the ladder gave a none decision/
  );
});

test('the check fails when an order that passes every check is not the only entry written, or is not marked ordered', () => {
  const whenWritten = (change) => (inputs) => {
    const decision = real(inputs);
    return inputs.order && decision.decision === 'write' ? change(decision) : decision;
  };
  const doubled = whenWritten((decision) => ({ ...decision, entries: [...decision.entries, ...decision.entries] }));
  const unmarked = whenWritten(({ entries: [first, ...rest], ...decision }) => ({
    ...decision,
    entries: [{ ...first, origin: 'demand' }, ...rest],
  }));
  for (const build of [doubled, unmarked]) {
    failing(build, /an order that passes every check was not the only entry written, marked ordered/);
  }
});

test('the check passes again once the real function is back', () => {
  assert.equal(check(REAL).ok, true);
});

test('the check has one smoke family that proves pick:topic, and no other family names it', () => {
  const families = manifestFamilies(FAMILIES).filter(
    (family) => family.kind === 'pure' && family.check in ORDER_CHECKS
  );
  assert.deepEqual(
    families.map(({ check: name }) => name),
    [NAME]
  );
  assert.equal(provesOf(families[0]), 'pick:topic');
});

test('the smoke harness takes the check by name, and a bad check name stays refused', () => {
  assert.throws(
    () => manifestFamilies([{ id: 'x', kind: 'pure', proves: 'pick:topic', check: 'order-nothing' }]),
    /unknown check order-nothing/
  );
  assert.equal(manifestFamilies([{ id: 'x', kind: 'pure', proves: 'pick:topic', check: NAME }]).length, 1);
});
