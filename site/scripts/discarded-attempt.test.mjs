import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import { autowriterReport } from './autowriter-gate.mjs';
import { isHolding } from './autowriter-claims.mjs';
import { validateLedger } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { filesOf } from './fixtures/spend-report-corpus.mjs';
import { harness, withScene } from './fixtures/spend-run.mjs';
import { ledgerOf } from './fixtures/spend-scene.mjs';
import { recordPath } from './record-layout.mjs';
import { ceilingStatus } from './spend-ceiling.mjs';
import { corpusOf, reportModel } from './spend-report-model.mjs';
import { claimRefusal } from './topic-claims.mjs';

const REPO = resolve(import.meta.dirname, '..', '..');
const CORE = readFileSync(join(REPO, 'docs/SEMANTIC-CORE.md'), 'utf8');
const WORKFLOW = readFileSync(join(REPO, '.github/workflows/ci.yml'), 'utf8');
const SUFFIX = ' — meshin.co';
const SLUG = 'discarded-post';
const CLAIMED_AT = '2026-11-02T20:27:43.937Z';
const DECIDED_AT = '2026-11-02T22:36:46.000Z';
const REASON = 'the owner closed the pull request unmerged';
const COST_USD = 0.022748;

const discarded = () => ({
  ...ledgerOf({ slug: SLUG, generationUsd: COST_USD }),
  pullRequest: 78,
  verdict: { state: 'discarded', reason: REASON, decidedAt: DECIDED_AT },
});
const claim = (extra = {}) => ({
  schema: 1,
  slug: SLUG,
  title: 'A discarded post',
  format: 'article',
  query: 'a discarded post',
  demand: { impressions: 0, position: null },
  prompt: { number: 2, text: 'A discarded post' },
  runId: '1',
  status: 'claimed',
  claimedAt: CLAIMED_AT,
  expiresAt: '2026-11-16T20:27:43.937Z',
  ...extra,
});
const problemsOf = (ledger) => validateLedger(ledger).map(describeProblem);
const filed = (family, value) => ({ path: recordPath(family, SLUG, CLAIMED_AT), text: JSON.stringify(value) });

test('a discarded attempt keeps the spend of its generation and needs no escalation to be decided', () => {
  assert.deepEqual(problemsOf(discarded()), []);
  assert.deepEqual(discarded().escalations, []);
});

for (const [name, verdict, expected] of [
  [
    'no reason',
    { state: 'discarded', reason: null, decidedAt: DECIDED_AT },
    'verdict.reason must say why the run is discarded',
  ],
  [
    'no time',
    { state: 'discarded', reason: REASON, decidedAt: null },
    'verdict.decidedAt must be an instant once the verdict is discarded',
  ],
]) {
  test(`a discarded verdict with ${name} is refused naming the field`, () => {
    const problems = problemsOf({ ...discarded(), verdict });
    assert.ok(problems.includes(expected), problems.join(' | '));
  });
}

test(
  'the ceiling counts a discarded attempt from its ledger alone, in the month it was decided',
  withScene((scene) => {
    scene.putLedger(discarded());
    scene.commit();
    const november = new Date('2026-11-10T09:00:00.000Z');
    assert.equal(ceilingStatus({ repoRoot: scene.root, now: november }).spentMicro, 22_748);
    assert.equal(ceilingStatus({ repoRoot: scene.root, now: new Date('2026-12-02T00:00:00.000Z') }).spentMicro, 0);
  })
);

test(
  'with its branch gone the line of the ceiling still counts the ledger, and says no record was read',
  withScene(async (scene) => {
    scene.putLedger(discarded());
    scene.commit();
    const run = harness(scene);
    assert.equal(await run.run(), 0);
    assert.deepEqual(
      run.out.map((line) => JSON.parse(line)),
      [{ month: '2026-11', spentUsd: COST_USD, ceilingUsd: 25, reached: false, notice: 'none', ledgers: 1, records: 0 }]
    );
    assert.deepEqual(run.err, []);
  })
);

test('the report names a discarded attempt in its own words as a note, counts no entry for it and says who counts the cost', () => {
  const model = reportModel(corpusOf(filesOf({ ledgers: [discarded()] })));
  assert.equal(model.empty, true);
  assert.deepEqual(model.warnings, []);
  assert.deepEqual(model.notes, [
    `${SLUG}: a person discarded this attempt on 2026-11-02 and its generation record went with it, so no entry is counted for it and its cost cannot be checked against a record; its ledger records ${COST_USD} USD for the generation, and the monthly spend ceiling counts that cost`,
  ]);
});

test('the gate finds nothing in a discarded attempt and the claim whose hold ended with it, and counts that claim lapsed', () => {
  const lapsed = claim({ expiresAt: DECIDED_AT });
  const { findings, counts } = autowriterReport({
    ledgers: [filed('ledger', discarded())],
    claims: [filed('claim', lapsed)],
    core: CORE,
    workflow: WORKFLOW,
    suffix: SUFFIX,
    now: new Date('2026-11-03T00:00:00.000Z'),
  });
  assert.deepEqual(findings, []);
  assert.equal(counts.lapsed, 1);
});

test('a claim stops holding at the instant its expiry was brought forward to, and not a millisecond before', () => {
  const lapsed = claim({ expiresAt: DECIDED_AT });
  assert.equal(isHolding(lapsed, new Date(Date.parse(DECIDED_AT) - 1)), true);
  assert.equal(isHolding(lapsed, new Date(DECIDED_AT)), false);
});

test('the lapse frees the claim, but the ledger of a discarded attempt still holds its slug, so its spend stays on the books', () => {
  const topic = { title: 'A discarded post', slug: SLUG };
  const ledgerPath = recordPath('ledger', SLUG, CLAIMED_AT);
  const held = {
    claims: [{ path: recordPath('claim', SLUG, CLAIMED_AT), claim: claim({ expiresAt: DECIDED_AT }) }],
    generated: [],
    suffix: SUFFIX,
    now: new Date('2026-11-03T00:00:00.000Z'),
  };
  assert.equal(claimRefusal({ ...held, topic, ledgerPaths: [] }), null);
  assert.equal(claimRefusal({ ...held, topic, ledgerPaths: [ledgerPath] }).reason, 'slug-held');
  assert.equal(claimRefusal({ ...held, topic, ledgerPaths: [ledgerPath] }).against, ledgerPath);
});
