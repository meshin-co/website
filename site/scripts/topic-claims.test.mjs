import assert from 'node:assert/strict';
import { test } from 'node:test';

import { claimRefusal } from './topic-claims.mjs';

const SUFFIX = ' — meshin.co';
const NOW = new Date('2026-11-02T07:00:00.000Z');
const LIVE = '2026-11-15T07:00:00.000Z';
const LAPSED = '2026-11-01T07:00:00.000Z';

const generated = [
  { family: 'term', route: '/glossary/ai-system', title: 'What is an AI system? — meshin.co' },
  {
    family: 'faq-answer',
    route: '/faq/are-models-trained-on-our-customer-data',
    title: 'Are models trained on our customer data? — meshin.co',
  },
];

const filed = (slug, extra = {}) => ({
  path: 'audits/autowriter/claims/' + slug + '.json',
  claim: {
    schema: 1,
    slug,
    title: 'What is a card?',
    format: 'term',
    query: 'card',
    demand: { impressions: 0, position: null },
    prompt: { number: 7, text: 'what is a card' },
    runId: '1',
    status: 'claimed',
    claimedAt: '2026-11-01T07:00:00.000Z',
    expiresAt: LIVE,
    ...extra,
  },
});

const refuse = (topic, held = {}) =>
  claimRefusal({
    topic: { slug: 'a-new-slug', ...topic },
    claims: held.claims ?? [],
    ledgerSlugs: held.ledgerSlugs ?? [],
    generated,
    suffix: SUFFIX,
    now: NOW,
  });

test('a title that is already a title of the generated layer is refused naming the page that owns it', () => {
  assert.deepEqual(refuse({ title: 'what is an AI system' }), {
    reason: 'title-collision',
    against: 'What is an AI system? — meshin.co',
    detail:
      'title "what is an AI system" is already the title of /glossary/ai-system in the generated layer of docs/SEMANTIC-CORE.md ("What is an AI system? — meshin.co")',
  });
});

test('case, punctuation, accents and an apostrophe do not hide a title', () => {
  assert.equal(refuse({ title: 'WHAT IS AN  AI-SYSTEM!!' }).reason, 'title-collision');
  assert.equal(refuse({ title: 'Are models trained on our custömer data' }).reason, 'title-collision');
  assert.equal(refuse({ title: 'Are model’s trained on our customer data?' }).reason, 'title-collision');
});

test('a title an unexpired claim holds is refused naming that claim', () => {
  const open = filed('what-is-a-card');
  assert.deepEqual(refuse({ title: 'what is a card' }, { claims: [open] }), {
    reason: 'title-collision',
    against: 'What is a card?',
    detail: 'title "what is a card" is also claimed by audits/autowriter/claims/what-is-a-card.json',
  });
});

test('a claim whose entry was written holds its title for good, even after its expiry', () => {
  const written = filed('what-is-a-ledger', { title: 'What is a ledger?', status: 'written', expiresAt: LAPSED });
  assert.equal(refuse({ title: 'WHAT IS A LEDGER' }, { claims: [written] }).against, 'What is a ledger?');
});

test('a slug an unexpired claim holds is refused even under a new title', () => {
  const open = filed('a-new-slug', { title: 'Another title entirely' });
  assert.deepEqual(refuse({ title: 'A different title' }, { claims: [open] }), {
    reason: 'slug-held',
    against: 'audits/autowriter/claims/a-new-slug.json',
    detail:
      'slug "a-new-slug" is held by audits/autowriter/claims/a-new-slug.json (claimed until 2026-11-15T07:00:00.000Z)',
  });
});

test('a slug a written claim holds is refused and the detail says it was written', () => {
  const written = filed('a-new-slug', { status: 'written', expiresAt: LAPSED });
  assert.match(refuse({ title: 'A different title' }, { claims: [written] }).detail, /\(written\)$/);
});

test('a lapsed claim holds neither its title nor its slug', () => {
  const lapsed = filed('a-new-slug', { title: 'What is a ledger?', expiresAt: LAPSED });
  assert.equal(refuse({ title: 'what is a ledger' }, { claims: [lapsed] }), null);
});

test('a slug that already has a ledger is refused, because an earlier run owns the record of it', () => {
  assert.deepEqual(refuse({ title: 'A fresh title' }, { ledgerSlugs: ['a-new-slug'] }), {
    reason: 'slug-held',
    against: 'audits/autowriter/a-new-slug.json',
    detail:
      'slug "a-new-slug" already has the ledger audits/autowriter/a-new-slug.json, so an earlier run owns it; remove the ledger to try the topic again',
  });
});

test('the generated layer is asked first, then the claims by title, then the claims by slug, then the ledgers', () => {
  const held = { claims: [filed('a-new-slug', { title: 'What is an AI system?' })], ledgerSlugs: ['a-new-slug'] };
  assert.equal(refuse({ title: 'What is an AI system?' }, held).detail.includes('generated layer'), true);
  assert.match(
    refuse({ title: 'What is a card?' }, { ...held, claims: [filed('a-new-slug')] }).detail,
    /is also claimed by/
  );
  assert.match(refuse({ title: 'Another one' }, held).detail, /is held by/);
  assert.match(refuse({ title: 'Another one' }, { ledgerSlugs: ['a-new-slug'] }).detail, /already has the ledger/);
});

test('a title nothing holds on a slug nothing holds is not refused', () => {
  assert.equal(
    refuse({ title: 'What is a data steward?' }, { claims: [filed('other-slug')], ledgerSlugs: ['x'] }),
    null
  );
  assert.equal(refuse({ title: 'What is a data steward?' }), null);
});
