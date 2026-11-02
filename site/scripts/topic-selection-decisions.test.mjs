import assert from 'node:assert/strict';
import { test } from 'node:test';

import { inputsFor, prompt, provenPrompt, query, reportOf, sourcesOf } from './fixtures/topic-inputs.mjs';
import { selectTopic } from './topic-selection.mjs';

const EVALS = prompt(11, 'how to put evals for AI agents into CI');
const MORE_EVALS = prompt(12, 'how to score evals for AI agents');
const MODEL_CARD = prompt(3, 'what is a model card');
const TOO_LONG = prompt(1, 'who is a fractional chief AI officer for a 100-person SaaS company');
const RETIRED = prompt(4, 'fractional AI officer Israel');
const GOVERNANCE = query('ai governance', 6, 21.5, ['/glossary/ai-governance'], [4]);
const OWNED_TERM = query('what is an ai register', 9, 50, ['/glossary/ai-register'], [6]);
const SHADOW = query('what is shadow ai', 12, 44, ['/glossary']);

const select = (prompts, queries = [], extra = {}) => selectTopic(inputsFor(reportOf(prompts, queries), extra));

test('with no post possible the first advisory is the decision, and nothing is claimed', () => {
  const decision = select([EVALS]);
  assert.equal(decision.decision, 'strengthen');
  assert.equal(
    decision.choice,
    'Choice: signal 2, prompt 11, unproven, 0 impressions in the window to 2026-10-30; strengthens /glossary/evals'
  );
  assert.equal(decision.reason, null);
  assert.deepEqual(decision.entries, []);
  assert.deepEqual(decision.advisories, []);
  assert.deepEqual(decision.strengthen, {
    source: 'register-owner',
    route: '/glossary/evals',
    query: 'how to put evals for AI agents into CI',
    number: 11,
    impressions: 0,
    position: null,
    reason:
      'prompt 11 is unproven and the query "how to put evals for ai agents into ci" names the concept "Evals", which the concept register of docs/SEMANTIC-CORE.md assigns to /glossary/evals',
  });
  assert.equal(decision.refusals.length, 1);
});

test('the strengthen decision keeps the advisories that come after the first, so a human sees every one', () => {
  const decision = select([EVALS, MORE_EVALS]);
  assert.equal(decision.decision, 'strengthen');
  assert.equal(decision.strengthen.number, 11);
  assert.deepEqual(
    decision.advisories.map(({ number }) => number),
    [12]
  );
});

test('a measured row in the band comes before a refused prompt as the strengthen decision', () => {
  const decision = select([EVALS], [GOVERNANCE]);
  assert.equal(decision.decision, 'strengthen');
  assert.equal(
    decision.choice,
    'Choice: signal 1, "ai governance", 6 impressions at position 21.5, measured 2026-11-01'
  );
  assert.equal(decision.strengthen.source, 'measured');
  assert.equal(decision.strengthen.route, '/glossary/ai-governance');
  assert.equal(decision.strengthen.number, 4);
  assert.match(
    decision.strengthen.reason,
    /^query "ai governance" has 6 impressions at position 21\.5 over 2026-08-01 to 2026-10-30, inside positions 8 to 30/
  );
  assert.deepEqual(
    decision.advisories.map(({ number }) => number),
    [11]
  );
  assert.deepEqual(decision.entries, []);
});

test('a refused term is the strengthen decision when no prompt and no measured row offers one', () => {
  const decision = select([], [OWNED_TERM]);
  assert.equal(decision.decision, 'strengthen');
  assert.equal(
    decision.choice,
    'Choice: signal 3, "what is an ai register", 9 impressions at position 50.0, measured 2026-11-01; strengthens /glossary/ai-register'
  );
  assert.equal(decision.strengthen.number, 6);
  assert.deepEqual(decision.entries, []);
});

test('with nothing to claim and nothing to strengthen the decision is none, and the reason counts what was examined', () => {
  const inputs = inputsFor(reportOf([TOO_LONG, MODEL_CARD, RETIRED], [query('meshin', 1, 7, ['/'])]), {
    promptSources: sourcesOf({ 4: { retired: true } }),
  });
  const decision = selectTopic(inputs);
  assert.equal(decision.decision, 'none');
  assert.equal(decision.choice, null);
  assert.equal(
    decision.reason,
    'No candidate. Strengthen: 0 of 1 query row between positions 8 and 30 with an impression; better than 8: 1 (nearest "meshin" at position 7.0); worse than 30: 0. ' +
      'Write: 3 unproven prompts examined; retired prompt: 1; a definition, left to the term arm: 1; title too long for a page: 1.'
  );
  assert.equal(decision.strengthen, null);
  assert.deepEqual(decision.entries, []);
  assert.deepEqual(decision.advisories, []);
  assert.deepEqual(
    decision.trail.map(({ number, outcome }) => [number, outcome]),
    [
      [1, 'title-too-long'],
      [3, 'definition'],
      [4, 'retired'],
    ]
  );
});

test('the empty report gives none with a reason that says the report holds nothing to choose from', () => {
  const decision = select([]);
  assert.equal(decision.decision, 'none');
  assert.equal(decision.reason, 'The report holds no query and no buyer prompt, so there is nothing to choose from.');
  assert.deepEqual(decision.trail, []);
  assert.deepEqual(decision.proposals, []);
  assert.deepEqual(decision.concepts, { named: [] });
});

test('a report whose prompts are all proven says so instead of counting zero examined', () => {
  const decision = select([provenPrompt(1, 'a')]);
  assert.equal(decision.decision, 'none');
  assert.equal(
    decision.reason,
    'No candidate. Strengthen: the report lists no query row. Write: no prompt is unproven.'
  );
});

test('terms are never written without a post, however high the cap and however many concepts are missing', () => {
  for (const settings of [
    { termArm: true, termCap: 5 },
    { termArm: false, termCap: 5 },
  ]) {
    const decision = select([TOO_LONG], [SHADOW], { settings });
    assert.equal(decision.decision, 'none');
    assert.deepEqual(decision.entries, []);
    assert.deepEqual(decision.concepts, { named: [] });
    assert.deepEqual(
      decision.trail.map(({ arm, outcome }) => [arm, outcome]),
      [
        ['post', 'title-too-long'],
        ['term', 'chosen'],
      ]
    );
  }
});

test('the proposals of the report come with every kind of decision', () => {
  const unnamed = query('how to write an ai policy', 3, 40, ['/']);
  const proposals = [{ query: 'how to write an ai policy', impressions: 3, position: 40, page: '/' }];
  assert.deepEqual(select([EVALS], [unnamed]).proposals, proposals);
  assert.deepEqual(select([TOO_LONG], [unnamed]).proposals, proposals);
  assert.deepEqual(select([prompt(9, 'why do AI pilots fail')], [unnamed]).proposals, proposals);
});
