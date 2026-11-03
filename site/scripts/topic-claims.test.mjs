import assert from 'node:assert/strict';
import { test } from 'node:test';

import { recordPath } from './record-layout.mjs';
import { claimRefusal } from './topic-claims.mjs';

const SUFFIX = ' — meshin.co';
const NOW = new Date('2026-11-02T07:00:00.000Z');
const CLAIMED = '2026-11-01T07:00:00.000Z';
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

const filed = (slug, extra = {}) => {
  const claim = {
    schema: 1,
    slug,
    title: 'What is a card?',
    format: 'term',
    query: 'card',
    demand: { impressions: 0, position: null },
    prompt: { number: 7, text: 'what is a card' },
    runId: '1',
    status: 'claimed',
    claimedAt: CLAIMED,
    expiresAt: LIVE,
    ...extra,
  };
  return { path: recordPath('claim', slug, claim.claimedAt), claim };
};

const ledgerOf = (slug) => recordPath('ledger', slug, CLAIMED);

const refuse = (topic, held = {}) =>
  claimRefusal({
    topic: { slug: 'a-new-slug', ...topic },
    claims: held.claims ?? [],
    ledgerPaths: held.ledgerPaths ?? [],
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
    detail: 'title "what is a card" is also claimed by ' + recordPath('claim', 'what-is-a-card', CLAIMED),
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
    against: recordPath('claim', 'a-new-slug', CLAIMED),
    detail: `slug "a-new-slug" is held by ${recordPath('claim', 'a-new-slug', CLAIMED)} (claimed until 2026-11-15T07:00:00.000Z)`,
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
  const ledger = ledgerOf('a-new-slug');
  assert.deepEqual(refuse({ title: 'A fresh title' }, { ledgerPaths: [ledger] }), {
    reason: 'slug-held',
    against: ledger,
    detail: `slug "a-new-slug" already has the ledger ${ledger}, so an earlier run owns it and the topic cannot be tried again yet; no procedure frees a slug safely, and removing the ledger is not one, because it records spend that the monthly spend ceiling counts`,
  });
});

test('the refusal of a held slug never tells anyone to remove or delete the ledger', () => {
  const { detail } = refuse({ title: 'A fresh title' }, { ledgerPaths: [ledgerOf('a-new-slug')] });
  assert.doesNotMatch(detail, /remove the ledger to|delete the ledger to|then remove|then delete/i);
  assert.match(detail, /removing the ledger is not one/);
});

test('a ledger holds its slug at whatever depth it is filed, and the refusal names that file', () => {
  const filedAs = [
    'audits/autowriter/a-new-slug.json',
    ledgerOf('a-new-slug'),
    'audits/autowriter/2026/11/extra/a-new-slug.json',
  ];
  for (const path of filedAs) {
    const found = refuse({ title: 'A fresh title' }, { ledgerPaths: [ledgerOf('another-slug'), path] });
    assert.equal(found.reason, 'slug-held', path);
    assert.equal(found.against, path);
    assert.ok(found.detail.includes(`already has the ledger ${path},`), found.detail);
  }
});

test('a claim holds its slug from the month it was made in, and the refusal names that file', () => {
  const october = filed('a-new-slug', { claimedAt: '2026-10-25T07:00:00.000Z' });
  const found = refuse({ title: 'A different title' }, { claims: [october] });
  assert.equal(found.reason, 'slug-held');
  assert.equal(found.against, 'audits/autowriter/claims/2026/10/a-new-slug.json');
});

test('the generated layer is asked first, then the claims by title, then the claims by slug, then the ledgers', () => {
  const held = {
    claims: [filed('a-new-slug', { title: 'What is an AI system?' })],
    ledgerPaths: [ledgerOf('a-new-slug')],
  };
  assert.equal(refuse({ title: 'What is an AI system?' }, held).detail.includes('generated layer'), true);
  assert.match(
    refuse({ title: 'What is a card?' }, { ...held, claims: [filed('a-new-slug')] }).detail,
    /is also claimed by/
  );
  assert.match(refuse({ title: 'Another one' }, held).detail, /is held by/);
  assert.match(
    refuse({ title: 'Another one' }, { ledgerPaths: [ledgerOf('a-new-slug')] }).detail,
    /already has the ledger/
  );
});

test('a title nothing holds on a slug nothing holds is not refused', () => {
  assert.equal(
    refuse(
      { title: 'What is a data steward?' },
      { claims: [filed('other-slug')], ledgerPaths: [ledgerOf('x'), ledgerOf('not-a-new-slug')] }
    ),
    null
  );
  assert.equal(refuse({ title: 'What is a data steward?' }), null);
});
