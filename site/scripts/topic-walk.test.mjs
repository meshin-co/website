import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LAPSED_AT, claimed, inputsFor, prompt, provenPrompt, reportOf, sourcesOf } from './fixtures/topic-inputs.mjs';
import { walkPosts } from './topic-walk.mjs';

const PILOTS = prompt(9, 'why do AI pilots fail to reach production');
const HANDOVER = prompt(15, 'how to hand over AI leadership to internal team');
const EVALS = prompt(11, 'how to put evals for AI agents into CI');
const NOUN = prompt(7, 'AI acceptable use policy template');
const MODEL_CARD = prompt(3, 'what is a model card');
const TOO_LONG = prompt(1, 'who is a fractional chief AI officer for a 100-person SaaS company');

const walk = (prompts, extra = {}) => walkPosts(inputsFor(reportOf(prompts), extra));
const outcomes = ({ trail }) => trail.map(({ number, outcome }) => [number, outcome]);

test('the first unproven prompt that passes every check is chosen, with its topic and its report row', () => {
  const result = walk([NOUN, PILOTS]);
  assert.equal(result.chosen.candidate.number, 7);
  assert.deepEqual(result.chosen.candidate.row, NOUN.cells);
  assert.deepEqual(result.chosen.topic, {
    format: 'article',
    subject: null,
    title: 'AI acceptable use policy template',
    slug: 'ai-acceptable-use-policy-template',
    query: 'ai acceptable use policy template',
  });
  assert.deepEqual(result.trail, [
    { arm: 'post', number: 7, outcome: 'chosen', detail: 'AI acceptable use policy template' },
  ]);
});

test('the walk stops at the prompt it chose, so the prompts after it leave no step', () => {
  assert.deepEqual(outcomes(walk([PILOTS, HANDOVER, EVALS])), [[9, 'chosen']]);
});

test('prompts are walked in the order the core numbers them, whatever the order of the report', () => {
  assert.equal(walk([HANDOVER, PILOTS]).chosen.candidate.number, 9);
});

test('a proven prompt is never examined', () => {
  const result = walk([provenPrompt(9, PILOTS.prompt), HANDOVER]);
  assert.deepEqual(outcomes(result), [[15, 'chosen']]);
});

test('a retired prompt is skipped without a refusal or an advisory, and the walk goes on', () => {
  const retired = prompt(4, 'fractional AI officer Israel');
  const result = walk([retired, PILOTS], { promptSources: sourcesOf({ 4: { retired: true } }) });
  assert.deepEqual(outcomes(result), [
    [4, 'retired'],
    [9, 'chosen'],
  ]);
  assert.equal(result.chosen.candidate.number, 9);
  assert.deepEqual(result.refusals, []);
  assert.deepEqual(result.advisories, []);
  assert.deepEqual(result.trail[0], { arm: 'post', number: 4, outcome: 'retired' });
});

test('a prompt the core does not know has no route and is not retired', () => {
  assert.equal(walk([PILOTS], { promptSources: sourcesOf({ 3: { retired: true } }) }).chosen.candidate.number, 9);
});

test('a definitional prompt is left to the term arm: no refusal, no advisory, and the walk goes on', () => {
  const result = walk([MODEL_CARD, PILOTS]);
  assert.deepEqual(outcomes(result), [
    [3, 'definition'],
    [9, 'chosen'],
  ]);
  assert.deepEqual(result.refusals, []);
  assert.deepEqual(result.advisories, []);
});

test('a definition is refused as a definition before its concept is looked at', () => {
  const register = prompt(4, 'what is an AI register');
  assert.deepEqual(outcomes(walk([register, PILOTS])), [
    [4, 'definition'],
    [9, 'chosen'],
  ]);
  assert.deepEqual(walk([register, PILOTS]).refusals, []);
});

test('a definition that does not fit a title is refused for its length, like any other prompt', () => {
  const long = prompt(5, 'what is ' + 'a'.repeat(80));
  assert.deepEqual(outcomes(walk([long, PILOTS])), [
    [5, 'title-too-long'],
    [9, 'chosen'],
  ]);
});

test('a retired prompt is skipped as retired even when it is worded as a definition', () => {
  const result = walk([MODEL_CARD, PILOTS], { promptSources: sourcesOf({ 3: { retired: true } }) });
  assert.deepEqual(outcomes(result)[0], [3, 'retired']);
});

test('a title longer than the room is refused, and so is a prompt that has no slug', () => {
  const symbols = prompt(5, '???');
  const result = walk([TOO_LONG, symbols, PILOTS]);
  assert.deepEqual(outcomes(result), [
    [1, 'title-too-long'],
    [5, 'no-slug'],
    [9, 'chosen'],
  ]);
  assert.deepEqual(result.refusals, []);
  assert.deepEqual(result.advisories, []);
});

test('a prompt that names a concept the register owns is recorded, offered as an advisory, and the walk goes on', () => {
  const result = walk([EVALS, HANDOVER]);
  assert.equal(result.chosen.candidate.number, 15);
  assert.deepEqual(result.refusals, [
    {
      title: 'How to put evals for AI agents into CI',
      reason: 'register-owner',
      against: '/glossary/evals',
      detail:
        'the query "how to put evals for ai agents into ci" names the concept "Evals", which the concept register of docs/SEMANTIC-CORE.md assigns to /glossary/evals',
    },
  ]);
  assert.deepEqual(result.advisories, [
    {
      source: 'register-owner',
      route: '/glossary/evals',
      query: 'how to put evals for AI agents into CI',
      number: 11,
      impressions: 0,
      position: null,
      reason:
        'prompt 11 is unproven and the query "how to put evals for ai agents into ci" names the concept "Evals", which the concept register of docs/SEMANTIC-CORE.md assigns to /glossary/evals',
      choice:
        'Choice: signal 2, prompt 11, unproven, 0 impressions in the window to 2026-10-30; strengthens /glossary/evals',
    },
  ]);
  assert.equal(result.trail[0].outcome, 'register-owner');
  assert.match(result.trail[0].detail, /^the query "how to put evals/);
});

test('a prompt already served in its own format by one of its routes is recorded and offered as an advisory', () => {
  const promptSources = sourcesOf({
    9: { routes: ['/blog/why-your-ai-pilot-never-reached-production'] },
    15: { routes: ['/faq/how-does-the-retainer-end', '/services/fractional-caio-retainer'] },
  });
  const result = walk([PILOTS, HANDOVER], { promptSources });
  assert.deepEqual(outcomes(result), [
    [9, 'family-served'],
    [15, 'chosen'],
  ]);
  assert.deepEqual(
    result.refusals.map(({ reason, against }) => [reason, against]),
    [['family-served', '/blog/why-your-ai-pilot-never-reached-production']]
  );
  assert.deepEqual(
    result.advisories.map(({ source, route, number }) => [source, route, number]),
    [['family-served', '/blog/why-your-ai-pilot-never-reached-production', 9]]
  );
});

test('a slug that would publish at a route the layer already lists is recorded and is no advisory', () => {
  const generated = [
    { family: 'article', route: '/blog/why-do-ai-pilots-fail-to-reach-production', title: 'Another title — meshin.co' },
  ];
  const result = walk([PILOTS, HANDOVER], { generated });
  assert.deepEqual(outcomes(result), [
    [9, 'route-exists'],
    [15, 'chosen'],
  ]);
  assert.equal(result.refusals[0].reason, 'route-exists');
  assert.equal(result.refusals[0].against, '/blog/why-do-ai-pilots-fail-to-reach-production');
  assert.deepEqual(result.advisories, []);
});

test('a title the generated layer already carries is recorded, and the next prompt is taken', () => {
  const generated = [
    { family: 'article', route: '/blog/older-url', title: 'Why do AI pilots fail to reach production? — meshin.co' },
  ];
  const result = walk([PILOTS, HANDOVER], { generated });
  assert.equal(result.chosen.candidate.number, 15);
  assert.deepEqual(result.refusals, [
    {
      title: 'Why do AI pilots fail to reach production?',
      reason: 'title-collision',
      against: 'Why do AI pilots fail to reach production? — meshin.co',
      detail:
        'title "Why do AI pilots fail to reach production?" is already the title of /blog/older-url in the generated layer of docs/SEMANTIC-CORE.md ("Why do AI pilots fail to reach production? — meshin.co")',
    },
  ]);
  assert.deepEqual(result.advisories, []);
});

test('a title an unexpired claim holds is recorded, and a claim that lapsed holds nothing', () => {
  const holder = claimed('older-slug', 'WHY DO AI PILOTS FAIL TO REACH PRODUCTION');
  const held = walk([PILOTS, HANDOVER], { claims: [holder] });
  assert.equal(held.chosen.candidate.number, 15);
  assert.deepEqual(
    held.refusals.map(({ reason, against }) => [reason, against]),
    [['title-collision', 'WHY DO AI PILOTS FAIL TO REACH PRODUCTION']]
  );
  const lapsed = claimed('older-slug', 'WHY DO AI PILOTS FAIL TO REACH PRODUCTION', { expiresAt: LAPSED_AT });
  const free = walk([PILOTS, HANDOVER], { claims: [lapsed] });
  assert.equal(free.chosen.candidate.number, 9);
  assert.deepEqual(free.refusals, []);
});

test('a slug a claim holds under another title, and a slug that already has a ledger, are recorded as held', () => {
  const holder = claimed('why-do-ai-pilots-fail-to-reach-production', 'Another title entirely');
  const byClaim = walk([PILOTS, HANDOVER], { claims: [holder] });
  assert.equal(byClaim.chosen.candidate.number, 15);
  assert.equal(byClaim.refusals[0].reason, 'slug-held');
  const byLedger = walk([PILOTS, HANDOVER], { ledgerSlugs: ['why-do-ai-pilots-fail-to-reach-production'] });
  assert.equal(byLedger.chosen.candidate.number, 15);
  assert.equal(byLedger.refusals[0].reason, 'slug-held');
  assert.equal(byLedger.refusals[0].against, 'audits/autowriter/why-do-ai-pilots-fail-to-reach-production.json');
});

test('every prompt refused leaves one step and nothing is chosen', () => {
  const result = walk([MODEL_CARD, EVALS, TOO_LONG]);
  assert.equal(result.chosen, null);
  assert.deepEqual(outcomes(result), [
    [1, 'title-too-long'],
    [3, 'definition'],
    [11, 'register-owner'],
  ]);
});

test('a report with no prompt gives an empty walk', () => {
  assert.deepEqual(walk([]), { chosen: null, trail: [], refusals: [], advisories: [] });
});
