import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';

import { newClaim } from './autowriter-claim-store.mjs';
import { newLedger } from './autowriter-ledger.mjs';
import { COLLECTION_OF } from './entry-prose.mjs';
import { recordPath } from './record-layout.mjs';
import { DRAFT_ORDER, openRun } from './write-open.mjs';

const roots = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

const NOW = new Date('2026-11-02T06:00:00Z');

export const postClaim = (overrides = {}) => ({
  ...newClaim({
    slug: 'agent-identity-in-production',
    title: 'How to give an AI agent its own identity',
    format: 'article',
    query: 'ai agent identity',
    demand: { impressions: 0, position: null },
    prompt: { number: 9, text: 'how do i give an ai agent an identity' },
    runId: 'run-1',
    now: NOW,
  }),
  ...overrides,
});

export const termClaim = (overrides = {}) => ({
  ...newClaim({
    slug: 'what-is-an-ai-management-system',
    title: 'What is an AI management system?',
    format: 'term',
    query: 'ai management system',
    demand: { impressions: 11, position: 91.8 },
    prompt: { number: 9, text: 'how do i give an ai agent an identity' },
    runId: 'run-1',
    now: NOW,
  }),
  ...overrides,
});

const put = (root, path, value) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), `${JSON.stringify(value, null, 2)}\n`);
};

const claimPathOf = (claim) => recordPath('claim', claim.slug, claim.claimedAt);
const ledgerPathOf = (claim) => recordPath('ledger', claim.slug, claim.claimedAt);

const entryFor = (claim) => ({
  claimPath: claimPathOf(claim),
  claim,
  row: { '#': '9', Prompt: claim.prompt.text },
  table: claim.format === 'term' ? 'Queries' : 'Buyer prompts',
  choice: 'Choice: signal 2',
});

const decisionFor = (claims, overrides = {}) => ({
  schema: 1,
  decision: 'write',
  ledgerPath: ledgerPathOf(claims[0]),
  entries: claims.map(entryFor),
  report: {
    path: 'audits/search-demand.md',
    measured: '2026-11-01',
    windowStart: '2026-08-01',
    windowEnd: '2026-10-30',
  },
  refusals: [],
  ...overrides,
});

function world({ claims = [postClaim(), termClaim()], ledger = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'write-open-'));
  roots.push(root);
  for (const claim of claims) put(root, claimPathOf(claim), claim);
  if (ledger)
    put(root, ledgerPathOf(claims[0]), newLedger({ slug: claims[0].slug, runId: 'run-1', pullRequest: null }));
  return root;
}

const files = (root) =>
  readdirSync(root, { recursive: true })
    .filter((name) => statSync(join(root, name)).isFile())
    .sort();

function refusal(root, decision) {
  const before = files(root);
  try {
    openRun({ repoRoot: root, decision });
  } catch (error) {
    assert.deepEqual(files(root), before);
    return error;
  }
  return assert.fail('the decision was accepted');
}

test('a post and a term open together, article first, and the post anchors the run', () => {
  const root = world();
  const run = openRun({ repoRoot: root, decision: decisionFor([postClaim(), termClaim()]) });
  assert.deepEqual(
    run.entries.map(({ claim }) => claim.format),
    ['article', 'term']
  );
  assert.deepEqual(
    run.entries.map(({ anchor }) => anchor),
    [true, false]
  );
  assert.equal(run.ledgerPath, ledgerPathOf(postClaim()));
  assert.ok(run.ledger, 'the run opened no ledger');
  assert.equal(run.ledger.slug, 'agent-identity-in-production');
  assert.equal(run.runId, 'run-1');
});

test('the entry is chosen by its own format, not by its place in the file', () => {
  const root = world();
  const reversed = { ...decisionFor([postClaim(), termClaim()]) };
  reversed.entries.reverse();
  const run = openRun({ repoRoot: root, decision: reversed });
  assert.deepEqual(
    run.entries.map(({ claim }) => claim.format),
    ['article', 'term']
  );
  assert.equal(run.entries[0].anchor, true);
});

test('a term-only run is a valid decision and the term is its anchor', () => {
  const claims = [termClaim()];
  const root = world({ claims });
  const run = openRun({ repoRoot: root, decision: decisionFor(claims) });
  assert.equal(run.entries.length, 1);
  assert.equal(run.entries[0].anchor, true);
  assert.equal(run.ledgerPath, ledgerPathOf(termClaim()));
});

test('several terms may share a run with one post', () => {
  const second = termClaim({ slug: 'what-is-an-ai-impact-assessment', title: 'What is an AI impact assessment?' });
  const claims = [postClaim(), termClaim(), second];
  const root = world({ claims });
  const run = openRun({ repoRoot: root, decision: decisionFor(claims) });
  assert.deepEqual(
    run.entries.map(({ claim }) => claim.slug),
    ['agent-identity-in-production', 'what-is-an-ai-management-system', 'what-is-an-ai-impact-assessment']
  );
});

test('a missing ledger is created open with the run id, not written', () => {
  const root = world({ ledger: false });
  const run = openRun({ repoRoot: root, decision: decisionFor([postClaim(), termClaim()]) });
  assert.ok(run.ledger, 'the run opened no ledger');
  assert.equal(run.ledger.runId, 'run-1');
  assert.equal(run.ledger.verdict.state, 'open');
  assert.deepEqual(run.ledger.attempts, []);
  assert.equal(files(root).includes(ledgerPathOf(postClaim())), false);
});

test('the drafting order names exactly the formats the writer can write', () => {
  assert.deepEqual([...DRAFT_ORDER].sort(), Object.keys(COLLECTION_OF).sort());
});

test('a decision of another schema version is refused', () => {
  const root = world();
  const error = refusal(root, { ...decisionFor([postClaim()]), schema: 2 });
  assert.equal(error.kind, 'decision');
  assert.match(error.message, /schema 2/);
});

test('a decision with no entries is refused', () => {
  const error = refusal(world(), { ...decisionFor([postClaim()]), entries: [] });
  assert.equal(error.kind, 'decision');
  assert.match(error.message, /no entries/);
});

test('a claim file that is missing fails naming its path', () => {
  const root = world({ claims: [postClaim()] });
  const error = refusal(root, decisionFor([postClaim(), termClaim()]));
  assert.equal(error.kind, 'claim');
  assert.ok(error.message.includes(claimPathOf(termClaim())));
});

test('the file read is the one the decision names, not the copy embedded in the decision', () => {
  const root = world({ claims: [postClaim({ status: 'written' })] });
  const error = refusal(root, decisionFor([postClaim()]));
  assert.equal(error.kind, 'claim');
  assert.match(error.message, /written/);
});

test('a claim file that disagrees with the decision about the slug is refused, naming both', () => {
  const root = world();
  const decision = decisionFor([postClaim(), termClaim()]);
  decision.entries[1].claim = termClaim({ slug: 'what-is-an-ai-impact-assessment' });
  const error = refusal(root, decision);
  assert.equal(error.kind, 'claim');
  assert.match(error.message, /what-is-an-ai-impact-assessment/);
  assert.match(error.message, /what-is-an-ai-management-system/);
});

test('a format the writer does not write is refused naming the format it was handed', () => {
  const claim = postClaim({ format: 'faq-answer' });
  const root = world({ claims: [claim] });
  const error = refusal(root, decisionFor([claim]));
  assert.equal(error.kind, 'claim');
  assert.match(error.message, /"faq-answer"/);
  assert.match(error.message, /article, term/);
});

test('two posts in one run are refused', () => {
  const second = postClaim({ slug: 'another-post' });
  const root = world({ claims: [postClaim(), second] });
  const error = refusal(root, decisionFor([postClaim(), second]));
  assert.equal(error.kind, 'decision');
  assert.match(error.message, /article/);
});

test('the same slug twice is refused', () => {
  const root = world();
  const decision = decisionFor([postClaim(), postClaim()]);
  decision.entries[1] = entryFor(termClaim({ slug: 'agent-identity-in-production' }));
  const error = refusal(root, decision);
  assert.equal(error.kind, 'decision');
});

test('a ledger path that belongs to none of the entries is refused', () => {
  const root = world();
  const error = refusal(root, {
    ...decisionFor([postClaim(), termClaim()]),
    ledgerPath: recordPath('ledger', 'someone-else', NOW),
  });
  assert.equal(error.kind, 'decision');
  assert.match(error.message, /someone-else/);
});

test('a claim file that is not where its slug lives is refused naming the path', () => {
  const root = world();
  put(root, 'audits/elsewhere/what-is-an-ai-management-system.json', termClaim());
  const decision = decisionFor([postClaim(), termClaim()]);
  decision.entries[1].claimPath = 'audits/elsewhere/what-is-an-ai-management-system.json';
  const error = refusal(root, decision);
  assert.equal(error.kind, 'decision');
  assert.match(error.message, /audits\/elsewhere\//);
  assert.ok(error.message.includes(claimPathOf(termClaim())), error.message);
});

test('claims of different runs cannot be written together', () => {
  const root = world({ claims: [postClaim(), termClaim({ runId: 'run-2' })] });
  const error = refusal(root, decisionFor([postClaim(), termClaim({ runId: 'run-2' })]));
  assert.equal(error.kind, 'decision');
  assert.match(error.message, /run-2/);
});

const LAST_OF_OCTOBER = '2026-10-31T23:59:59.999Z';

test('a claim filed flat is refused, and the refusal names the month path the writer reads', () => {
  const root = world({ claims: [postClaim()] });
  const flat = `audits/autowriter/claims/${termClaim().slug}.json`;
  put(root, flat, termClaim());
  const decision = decisionFor([postClaim(), termClaim()]);
  decision.entries[1].claimPath = flat;
  const error = refusal(root, decision);
  assert.equal(error.kind, 'decision');
  assert.ok(error.message.includes(flat), error.message);
  assert.ok(error.message.includes(claimPathOf(termClaim())), error.message);
});

test('a ledger named flat is refused, and the refusal names the month path of the ledger', () => {
  const root = world();
  const flat = `audits/autowriter/${postClaim().slug}.json`;
  put(root, flat, newLedger({ slug: postClaim().slug, runId: 'run-1', pullRequest: null }));
  const error = refusal(root, { ...decisionFor([postClaim(), termClaim()]), ledgerPath: flat });
  assert.equal(error.kind, 'decision');
  assert.ok(error.message.includes(flat), error.message);
  assert.ok(error.message.includes(ledgerPathOf(postClaim())), error.message);
});

test('the ledger opened is the one filed in the month of the claim, and a flat ledger of the slug is never read', () => {
  const claims = [postClaim()];
  const root = world({ claims, ledger: false });
  const filed = newLedger({ slug: claims[0].slug, runId: 'run-1', pullRequest: 12 });
  put(root, ledgerPathOf(claims[0]), filed);
  put(root, `audits/autowriter/${claims[0].slug}.json`, { ...filed, pullRequest: 99 });
  const run = openRun({ repoRoot: root, decision: decisionFor(claims) });
  assert.equal(run.ledgerPath, ledgerPathOf(claims[0]));
  assert.equal(run.ledger.pullRequest, 12);
});

test('the UTC month of the claim files the claim and the ledger, so a claim of the last second of October opens', () => {
  const claims = [postClaim({ claimedAt: LAST_OF_OCTOBER }), termClaim({ claimedAt: LAST_OF_OCTOBER })];
  const root = world({ claims });
  const run = openRun({ repoRoot: root, decision: decisionFor(claims) });
  assert.equal(run.ledgerPath, 'audits/autowriter/2026/10/agent-identity-in-production.json');
  assert.deepEqual(
    run.entries.map(({ claim }) => claim.slug),
    ['agent-identity-in-production', 'what-is-an-ai-management-system']
  );
  assert.ok(files(root).includes('audits/autowriter/claims/2026/10/agent-identity-in-production.json'));
  assert.ok(files(root).includes('audits/autowriter/claims/2026/10/what-is-an-ai-management-system.json'));
});

test('a claim named under the month of the run instead of the month it was claimed is refused naming the right month', () => {
  const claims = [postClaim({ claimedAt: LAST_OF_OCTOBER })];
  const root = world({ claims });
  const november = recordPath('claim', claims[0].slug, NOW);
  put(root, november, claims[0]);
  const decision = decisionFor(claims);
  decision.entries[0].claimPath = november;
  const error = refusal(root, decision);
  assert.equal(error.kind, 'decision');
  assert.ok(error.message.includes(november), error.message);
  assert.ok(
    error.message.includes('audits/autowriter/claims/2026/10/agent-identity-in-production.json'),
    error.message
  );
});
