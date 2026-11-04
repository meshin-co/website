import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CATEGORIES } from './entry-limits.mjs';
import {
  EARLIER_RUN_AT,
  GENERATED,
  LAPSED_AT,
  SUFFIX,
  categoryClaimed,
  claimed,
  inputsFor,
  published,
  reportOf,
} from './fixtures/topic-inputs.mjs';
import { recordPath } from './record-layout.mjs';
import { categoryEntry } from './topic-selection.mjs';

const [GOVERNANCE, AGENTIC] = CATEGORIES;
const PROPOSAL = { calls: [{ role: 'topic', attempt: 1 }] };

const propose = (query, extra = {}, category = GOVERNANCE) =>
  categoryEntry({ category, query, proposal: PROPOSAL, ...inputsFor(reportOf([]), extra) });
const refusedAs = (query, extra) => propose(query, extra).refusal;

test('a specific query becomes a category entry: an article with no prompt, no demand and no report row', () => {
  const { entry, refusal } = propose('how to write an ai incident runbook');
  assert.equal(refusal, undefined);
  assert.deepEqual(entry, {
    format: 'article',
    topic: {
      format: 'article',
      subject: null,
      title: 'How to write an AI incident runbook',
      slug: 'how-to-write-an-ai-incident-runbook',
      query: 'how to write an ai incident runbook',
    },
    demand: { impressions: 0, position: null },
    table: null,
    row: null,
    choice:
      'Choice: category governance, no article yet; no unproven prompt or weak query survived, so the rotation chose it',
    origin: 'category',
    category: GOVERNANCE,
    proposal: PROPOSAL,
  });
  assert.equal(Object.hasOwn(entry, 'prompt'), false);
  assert.equal(Object.hasOwn(entry, 'weakness'), false);
});

test('the title is the query with its first letter raised, a question mark when it asks, and the casing of the register', () => {
  assert.equal(
    propose('why do ai pilots stall in procurement').entry.topic.title,
    'Why do AI pilots stall in procurement?'
  );
  assert.equal(propose('How to staff an AI review board').entry.topic.title, 'How to staff an AI review board');
});

test('the proposal rides on the entry exactly as it was given, with every call of the pick', () => {
  const { entry } = propose('how to write an ai incident runbook');
  assert.deepEqual(entry.proposal, { calls: [{ role: 'topic', attempt: 1 }] });
  const none = categoryEntry({
    category: GOVERNANCE,
    query: 'how to write an ai incident runbook',
    ...inputsFor(reportOf([])),
  });
  assert.equal(none.entry.proposal, undefined);
});

test('the choice line counts the articles of the category and names the newest day, claims in flight included', () => {
  const posts = [
    published('older', 'Older governance article', { category: GOVERNANCE, publishDate: '2026-09-08' }),
    published('newer', 'Newer governance article', { category: GOVERNANCE, publishDate: '2026-10-12' }),
    published('other', 'Another category entirely', { category: AGENTIC, publishDate: '2026-10-30' }),
  ];
  const why = 'no unproven prompt or weak query survived, so the rotation chose it';
  assert.equal(
    propose('how to write an ai incident runbook', { posts }).entry.choice,
    `Choice: category governance, 2 articles, newest 2026-10-12; ${why}`
  );
  const inFlight = categoryClaimed('first-run', 'First run', GOVERNANCE);
  assert.equal(
    propose('how to write an ai incident runbook', { posts, claims: [inFlight] }).entry.choice,
    `Choice: category governance, 3 articles, newest 2026-11-01; ${why}`
  );
  assert.equal(
    propose('how to write an ai incident runbook', { posts }, AGENTIC).entry.choice,
    `Choice: category agentic-architecture, 1 article, newest 2026-10-30; ${why}`
  );
});

test('the category needs no place in the configured rotation to get an entry', () => {
  const { entry } = propose('how to write an ai incident runbook', { rotation: [] }, AGENTIC);
  assert.equal(entry.category, AGENTIC);
});

test('a definition is no article: it is a format mismatch with nothing for the ledger, whatever else is wrong with it', () => {
  const refusal = refusedAs('what is a model card');
  assert.deepEqual(refusal, {
    outcome: 'format-mismatch',
    detail:
      'the query "what is a model card" asks for the definition of "model card", which is a glossary entry, not an article',
    ledger: null,
  });
  assert.equal(
    refusedAs('what is an eval', { claims: [claimed('eval', 'What is an eval?')] }).outcome,
    'format-mismatch'
  );
});

test('a query too long for a page title, and a query with nothing to make a slug of, are refused with a reason to show', () => {
  const long = refusedAs(`how to ${'a'.repeat(120)}`);
  assert.equal(long.outcome, 'title-too-long');
  assert.equal(long.ledger, null);
  assert.match(long.detail, /^the query "how to a+" would make a title longer than a page title has room for$/);
  const blank = refusedAs('日本語は何ですか?');
  assert.deepEqual(blank, {
    outcome: 'no-slug',
    detail: 'the query "日本語は何ですか?" has no letter or digit a slug could be made from',
    ledger: null,
  });
});

test('a query that names a register concept is refused for the ledger, with the route that owns the concept', () => {
  const refusal = refusedAs('how to put evals into ci');
  assert.equal(refusal.outcome, 'register-owner');
  assert.deepEqual(refusal.ledger, {
    title: 'How to put evals into ci',
    reason: 'register-owner',
    against: '/glossary/evals',
    detail: refusal.detail,
  });
  assert.equal(
    refusal.detail,
    'the query "how to put evals into ci" names the concept "Evals", which the concept register of docs/SEMANTIC-CORE.md assigns to /glossary/evals'
  );
});

test('a route the generated layer lists, a title it holds, a title or a slug a claim holds and a ledger slug are refused', () => {
  const route = { family: 'article', route: '/blog/how-to-write-an-ai-incident-runbook', title: `Other${SUFFIX}` };
  assert.equal(
    refusedAs('how to write an ai incident runbook', { generated: [...GENERATED, route] }).outcome,
    'route-exists'
  );
  const title = { family: 'article', route: '/blog/older-url', title: `HOW TO WRITE AN AI INCIDENT RUNBOOK${SUFFIX}` };
  assert.equal(
    refusedAs('how to write an ai incident runbook', { generated: [...GENERATED, title] }).outcome,
    'title-collision'
  );
  const byTitle = [claimed('older', 'How to WRITE an AI incident runbook!')];
  assert.equal(refusedAs('how to write an ai incident runbook', { claims: byTitle }).outcome, 'title-collision');
  const bySlug = [claimed('how-to-write-an-ai-incident-runbook', 'Another title entirely')];
  assert.equal(refusedAs('how to write an ai incident runbook', { claims: bySlug }).outcome, 'slug-held');
  const ledgerPaths = [recordPath('ledger', 'how-to-write-an-ai-incident-runbook', EARLIER_RUN_AT)];
  const byLedger = refusedAs('how to write an ai incident runbook', { ledgerPaths });
  assert.equal(byLedger.outcome, 'slug-held');
  assert.equal(byLedger.ledger.against, ledgerPaths[0]);
});

test('a refusal for the ledger carries the same record the walks write, and the same sentence for the trail', () => {
  const refusal = refusedAs('how to write an ai incident runbook', {
    claims: [claimed('how-to-write-an-ai-incident-runbook', 'Another title entirely')],
  });
  assert.deepEqual(Object.keys(refusal).sort(), ['detail', 'ledger', 'outcome']);
  assert.deepEqual(Object.keys(refusal.ledger).sort(), ['against', 'detail', 'reason', 'title']);
  assert.equal(refusal.ledger.reason, refusal.outcome);
  assert.equal(refusal.ledger.detail, refusal.detail);
  assert.equal(refusal.ledger.title, 'How to write an AI incident runbook');
});

test('a claim that lapsed, and a term claim, hold nothing and make no repeat', () => {
  const lapsed = claimed('how-to-write-an-ai-incident-runbook', 'Runbook', { expiresAt: LAPSED_AT });
  assert.ok(propose('how to write an ai incident runbook', { claims: [lapsed] }).entry);
  const term = claimed('ai-incident-runbook', 'What is an AI incident runbook?', {
    format: 'term',
    query: 'ai incident runbook',
  });
  assert.ok(propose('how to write an ai incident runbook', { claims: [term] }).entry);
});

test('an article published on the same subject is refused as the same subject, naming its route', () => {
  const posts = [
    published('incident-runbook', 'An AI incident runbook for a small team', { query: 'ai incident runbook' }),
  ];
  const refusal = refusedAs('how to write an ai incident runbook', { posts });
  assert.equal(refusal.outcome, 'same-subject');
  assert.equal(refusal.ledger.reason, 'same-subject');
  assert.equal(refusal.ledger.against, '/blog/incident-runbook');
  assert.match(refusal.detail, /repeats \/blog\/incident-runbook \("An AI incident runbook for a small team"\)/);
});

test('an article claim in flight on the same subject is refused naming the claim file, the second run of one day included', () => {
  const inFlight = categoryClaimed('runbook-run', 'An AI incident runbook', GOVERNANCE, {
    query: 'ai incident runbook',
  });
  const refusal = refusedAs('how to write an ai incident runbook', { claims: [inFlight] }, GOVERNANCE);
  assert.equal(refusal.outcome, 'same-subject');
  assert.equal(refusal.ledger.against, inFlight.path);
});

test('a topic far enough from every article passes the guard, and the category of the other article does not matter', () => {
  const posts = [published('other', 'AI vendor due diligence questionnaire', { category: AGENTIC })];
  assert.ok(propose('how to write an ai incident runbook', { posts }).entry);
});

test('the checks run in a fixed order: format, register, claims, repeat', () => {
  const posts = [published('p', 'Putting evals into CI for agents')];
  const claims = [claimed('how-to-put-evals-into-ci', 'Held already')];
  assert.equal(refusedAs('what is an eval', { posts, claims }).outcome, 'format-mismatch');
  assert.equal(refusedAs('how to put evals into ci', { posts, claims }).outcome, 'register-owner');
  const sameSlug = [claimed('how-to-write-an-ai-policy', 'Held already')];
  const policyPosts = [published('policy', 'Writing an AI policy')];
  assert.equal(refusedAs('how to write an ai policy', { posts: policyPosts, claims: sameSlug }).outcome, 'slug-held');
  assert.equal(refusedAs('how to write an ai policy', { posts: policyPosts }).outcome, 'same-subject');
});

test('asking twice gives the same answer and leaves every input as it was', () => {
  const inputs = {
    category: GOVERNANCE,
    query: 'how to write an ai incident runbook',
    proposal: PROPOSAL,
    ...inputsFor(reportOf([]), {
      posts: [published('p', 'A post')],
      claims: [categoryClaimed('c', 'A claim', GOVERNANCE)],
    }),
  };
  const before = structuredClone(inputs);
  const first = categoryEntry(inputs);
  assert.deepEqual(categoryEntry(inputs), first);
  assert.deepEqual(inputs, before);
});
