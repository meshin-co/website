import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CLAIM_LIFETIME_DAYS } from './autowriter-claim-store.mjs';
import { validateClaim } from './autowriter-claims.mjs';
import { validateLedger } from './autowriter-ledger.mjs';
import { familyOf, filingProblems, recordPath } from './record-layout.mjs';
import { buildRun } from './topic-entries.mjs';

const NOW = new Date('2026-11-02T07:00:00.000Z');
const RUN_ID = '2026-11-02-1';
const REPORT_PATH = 'audits/search-demand.md';
const DAY_MS = 86_400_000;

const report = {
  measured: '2026-11-01',
  windowStart: '2026-08-01',
  windowEnd: '2026-10-30',
  property: 'sc-domain:meshin.co',
  generatedFrom: 'b5d0639',
  queries: [],
  prompts: [],
};

const POST_ROW = {
  '#': '2',
  Prompt: 'fractional CAIO vs full-time CAIO cost',
  'Must win': '/faq/why-hire-a-fractional-officer-instead-of-a-full-time-head-of-ai',
  Impressions: 'unproven',
  Position: '-',
  'Carried by': '-',
};

const TERM_ROW = {
  Query: 'what is ai literacy',
  Impressions: '5',
  Clicks: '0',
  Position: '42.5',
  CTR: '0.0%',
  Page: '/glossary',
  Prompts: '8',
};

const post = {
  format: 'article',
  topic: {
    format: 'article',
    subject: null,
    title: 'Fractional CAIO vs full-time CAIO cost',
    slug: 'fractional-caio-vs-full-time-caio-cost',
    query: 'fractional caio vs full-time caio cost',
  },
  prompt: { number: 2, text: 'fractional CAIO vs full-time CAIO cost' },
  demand: { impressions: 0, position: null },
  table: 'Buyer prompts',
  row: POST_ROW,
  choice: 'Choice: signal 2, prompt 2, unproven, 0 impressions in the window to 2026-10-30',
};

const term = {
  format: 'term',
  topic: {
    format: 'term',
    subject: 'AI literacy',
    title: 'What is AI literacy?',
    slug: 'ai-literacy',
    query: 'ai literacy',
  },
  prompt: { number: 8, text: 'EU AI Act obligations for deployers small business' },
  demand: { impressions: 5, position: 42.5 },
  table: 'Queries',
  row: TERM_ROW,
  choice: 'Choice: signal 3, "what is ai literacy", 5 impressions at position 42.5, measured 2026-11-01',
};

const refused = {
  title: 'How to put evals for AI agents into CI',
  reason: 'register-owner',
  against: '/glossary/evals',
  detail: 'the query "how to put evals for ai agents into ci" names the concept "Evals"',
};

const decisionOf = (extra = {}) => ({
  decision: 'write',
  choice: post.choice,
  reason: null,
  entries: [post, term],
  strengthen: null,
  advisories: [],
  refusals: [],
  concepts: { named: [] },
  proposals: [],
  trail: [],
  ...extra,
});

const runAt = (decision, now) => buildRun({ decision, report, runId: RUN_ID, now, reportPath: REPORT_PATH });
const run = (decision) => runAt(decision, NOW);

test('every claim of a run carries the one run id, is claimed, and expires after the claim lifetime', () => {
  assert.equal(CLAIM_LIFETIME_DAYS, 14);
  const { claims } = run(decisionOf());
  assert.equal(claims.length, 2);
  for (const { claim } of claims) {
    assert.equal(claim.runId, RUN_ID);
    assert.equal(claim.status, 'claimed');
    assert.equal(claim.claimedAt, '2026-11-02T07:00:00.000Z');
    assert.equal(claim.expiresAt, '2026-11-16T07:00:00.000Z');
    assert.equal(Date.parse(claim.expiresAt) - Date.parse(claim.claimedAt), CLAIM_LIFETIME_DAYS * DAY_MS);
    assert.deepEqual(validateClaim(claim), []);
  }
});

test('a claim carries the slug, title, format, query, demand and prompt of its entry', () => {
  const { claims } = run(decisionOf());
  assert.deepEqual(claims[0].claim, {
    schema: 1,
    slug: 'fractional-caio-vs-full-time-caio-cost',
    title: 'Fractional CAIO vs full-time CAIO cost',
    format: 'article',
    query: 'fractional caio vs full-time caio cost',
    demand: { impressions: 0, position: null },
    prompt: { number: 2, text: 'fractional CAIO vs full-time CAIO cost' },
    runId: RUN_ID,
    status: 'claimed',
    claimedAt: '2026-11-02T07:00:00.000Z',
    expiresAt: '2026-11-16T07:00:00.000Z',
  });
  assert.deepEqual(claims[1].claim, {
    schema: 1,
    slug: 'ai-literacy',
    title: 'What is AI literacy?',
    format: 'term',
    query: 'ai literacy',
    demand: { impressions: 5, position: 42.5 },
    prompt: { number: 8, text: 'EU AI Act obligations for deployers small business' },
    runId: RUN_ID,
    status: 'claimed',
    claimedAt: '2026-11-02T07:00:00.000Z',
    expiresAt: '2026-11-16T07:00:00.000Z',
  });
});

test('a claim file is named for its slug inside the month of its claim, in the order of the entries', () => {
  const { claims } = run(decisionOf());
  assert.deepEqual(
    claims.map(({ claimPath }) => claimPath),
    [
      'audits/autowriter/claims/2026/11/fractional-caio-vs-full-time-caio-cost.json',
      'audits/autowriter/claims/2026/11/ai-literacy.json',
    ]
  );
  for (const { claimPath, claim } of claims) assert.equal(claimPath, recordPath('claim', claim.slug, claim.claimedAt));
});

test('the ledger belongs to the post: its file is named for the post slug and it starts open with no pull request', () => {
  const { claims, ledgerPath, ledger } = run(decisionOf());
  assert.equal(ledgerPath, 'audits/autowriter/2026/11/fractional-caio-vs-full-time-caio-cost.json');
  assert.equal(ledgerPath, recordPath('ledger', ledger.slug, claims[0].claim.claimedAt));
  assert.deepEqual(ledger, {
    schema: 1,
    slug: 'fractional-caio-vs-full-time-caio-cost',
    runId: RUN_ID,
    pullRequest: null,
    attempts: [],
    spend: { tokens: { input: 0, output: 0 }, costUsd: 0 },
    verdict: { state: 'open', reason: null, decidedAt: null },
    escalations: [],
  });
  assert.deepEqual(validateLedger(ledger), []);
  assert.equal(Object.hasOwn(ledger, 'refusals'), false);
});

test('the month of a claim is the UTC month of the instant it was claimed, and the ledger follows the post', () => {
  const instants = [
    ['2026-10-31T23:59:59.999Z', '2026/10'],
    ['2026-11-01T00:00:00.000Z', '2026/11'],
    ['2027-01-01T00:00:00.000Z', '2027/01'],
  ];
  for (const [instant, month] of instants) {
    const { claims, ledgerPath, file } = runAt(decisionOf(), new Date(instant));
    assert.deepEqual(
      claims.map(({ claimPath }) => claimPath),
      [
        `audits/autowriter/claims/${month}/fractional-caio-vs-full-time-caio-cost.json`,
        `audits/autowriter/claims/${month}/ai-literacy.json`,
      ],
      instant
    );
    assert.equal(ledgerPath, `audits/autowriter/${month}/fractional-caio-vs-full-time-caio-cost.json`, instant);
    assert.equal(file.ledgerPath, ledgerPath, instant);
  }
});

test('the paths of a run are the paths the layout files its records under, in the month of their claim', () => {
  const { claims, ledgerPath } = run(decisionOf());
  const paths = [ledgerPath, ...claims.map(({ claimPath }) => claimPath)];
  assert.deepEqual(paths.map(familyOf), ['ledger', 'claim', 'claim']);
  assert.deepEqual(filingProblems({ paths, claims: claims.map(({ claim }) => claim) }), []);
});

test('the refusals of the walk ride in the ledger and in the decision file, and the ledger still validates', () => {
  const { ledger, file } = run(decisionOf({ refusals: [refused] }));
  assert.deepEqual(ledger.refusals, [refused]);
  assert.deepEqual(validateLedger(ledger), []);
  assert.deepEqual(file.refusals, [refused]);
});

test('a run with no refusal still names an empty refusals list in the decision file', () => {
  assert.deepEqual(run(decisionOf()).file.refusals, []);
});

test('the decision file holds exactly the keys the writer reads', () => {
  const { file } = run(decisionOf());
  assert.deepEqual(Object.keys(file).sort(), ['decision', 'entries', 'ledgerPath', 'refusals', 'report', 'schema']);
  assert.equal(file.schema, 1);
  assert.equal(file.decision, 'write');
  assert.equal(file.ledgerPath, 'audits/autowriter/2026/11/fractional-caio-vs-full-time-caio-cost.json');
});

test('each entry of the decision file names its claim file and claim, its report row, its table and its choice line', () => {
  const { claims, file } = run(decisionOf());
  assert.equal(file.entries.length, 2);
  for (const entry of file.entries) {
    assert.deepEqual(Object.keys(entry).sort(), ['choice', 'claim', 'claimPath', 'row', 'table']);
  }
  assert.deepEqual(file.entries[0], {
    claimPath: claims[0].claimPath,
    claim: claims[0].claim,
    row: POST_ROW,
    table: 'Buyer prompts',
    choice: post.choice,
  });
  assert.deepEqual(file.entries[1], {
    claimPath: claims[1].claimPath,
    claim: claims[1].claim,
    row: TERM_ROW,
    table: 'Queries',
    choice: term.choice,
  });
});

test('the first entry of the decision file is the article', () => {
  const { file } = run(decisionOf());
  assert.equal(file.entries[0].claim.format, 'article');
  assert.equal(file.entries[1].claim.format, 'term');
});

test('the report block of the decision file names the report and the measurement it holds', () => {
  const { file } = run(decisionOf());
  assert.deepEqual(file.report, {
    path: 'audits/search-demand.md',
    measured: '2026-11-01',
    windowStart: '2026-08-01',
    windowEnd: '2026-10-30',
    property: 'sc-domain:meshin.co',
    generatedFrom: 'b5d0639',
  });
});

test('a post alone gives one claim and one entry', () => {
  const { claims, file } = run(decisionOf({ entries: [post] }));
  assert.equal(claims.length, 1);
  assert.equal(file.entries.length, 1);
  assert.equal(file.entries[0].claim.slug, 'fractional-caio-vs-full-time-caio-cost');
});

test('the decision file is plain JSON that survives being written and read back', () => {
  const { file } = run(decisionOf({ refusals: [refused] }));
  assert.deepEqual(JSON.parse(JSON.stringify(file)), file);
});

test('building a run leaves the decision as it was, and the claims share no object with it', () => {
  const decision = decisionOf({ refusals: [refused] });
  const before = structuredClone(decision);
  const { claims } = run(decision);
  claims[0].claim.demand.impressions = 99;
  claims[1].claim.prompt.text = 'changed';
  assert.deepEqual(decision, before);
});

test('a decision that is not a write is refused, naming what it is', () => {
  for (const decision of ['strengthen', 'none']) {
    assert.throws(() => run(decisionOf({ decision, entries: [] })), new RegExp('a ' + decision + ' decision'));
  }
});

test('a write decision with no entry is refused', () => {
  assert.throws(() => run(decisionOf({ entries: [] })), /no entry/);
});

test('a decision whose first entry is not the article is refused, because the ledger is named for the post', () => {
  assert.throws(() => run(decisionOf({ entries: [term, post] })), /first entry .* term/);
});
