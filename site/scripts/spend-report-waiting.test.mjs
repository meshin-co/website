import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { spendReportFindings } from './autowriter-spend-rules.mjs';
import {
  GENERATED_AT,
  REVISION,
  claimOf,
  claimPath,
  filesOf,
  ledgerOf,
  mergedLedger,
  recordOf,
  writingCall,
} from './fixtures/spend-report-corpus.mjs';
import { createScene, ledgerOf as sceneLedger, recordOf as sceneRecord } from './fixtures/spend-scene.mjs';
import { spendReportFile } from './spend-report.mjs';
import { corpusOf, reportModel } from './spend-report-model.mjs';
import { reportMarkdown, reportText } from './spend-report-text.mjs';
import { spendMessage } from './spend-slack.mjs';
import { readLedgers } from './spend-sources.mjs';

const SLUG = 'circuit-breaker';
const DRAFT = writingCall({ tag: 'draft' });
const SPENT_MICRO = 27000;
const HELD_UNTIL = '2026-11-16T09:00:00.000Z';
const LAPSED = { claimedAt: '2026-10-01T09:00:00.000Z', expiresAt: '2026-10-15T09:00:00.000Z' };
const STATUS = { month: '2026-11', spentMicro: 54_000, ceilingUsd: 25 };
const NO_LINKS = { run: null, pullRequest: null, entries: {} };

const pending = () => ledgerOf({ slug: SLUG, calls: [DRAFT] });
const held = () => claimOf({ slug: SLUG });
const modelOf = (parts) => reportModel(corpusOf(filesOf(parts)), { at: GENERATED_AT });
const slugsOf = (sentences) => sentences.map((sentence) => sentence.split(':')[0]);

const WAITING = `${SLUG}: its ledger records a generation of 0.027 USD (verdict: open) and no generation record names it yet; its claim holds the topic until ${HELD_UNTIL}, so the record is still expected`;
const WARNING = `${SLUG}: its ledger records a generation of 0.027 USD (verdict: open) but no generation record names this ledger, so no entry is counted for it`;

const STILL_A_WARNING = {
  'no claim at all': { ledgers: [pending()] },
  'a claim whose hold has ended': { ledgers: [pending()], claims: [claimOf({ slug: SLUG, ...LAPSED })] },
  'a claim of another run': { ledgers: [pending()], claims: [claimOf({ slug: SLUG, runId: 'run-2' })] },
  'an abandoned claim': { ledgers: [pending()], claims: [claimOf({ slug: SLUG, status: 'abandoned' })] },
  'a claim that says written while no record is in the tree': {
    ledgers: [pending()],
    claims: [claimOf({ slug: SLUG, status: 'written' })],
  },
  'a ledger whose verdict is merged': { ledgers: [mergedLedger(pending())], claims: [held()] },
};

test('a ledger with no record whose claim still holds the topic is waiting, and no warning is raised for it', () => {
  const model = modelOf({ ledgers: [pending()], claims: [held()] });
  assert.deepEqual(model.warnings, []);
  assert.deepEqual(model.waiting, [WAITING]);
  assert.deepEqual(model.notes, []);
});

test('moving that ledger out of the warnings moves no money: every figure is the one it had as a warning', () => {
  const waiting = modelOf({ ledgers: [pending()], claims: [held()] });
  const warned = modelOf({ ledgers: [pending()] });
  assert.deepEqual(warned.warnings, [WARNING]);
  assert.deepEqual(waiting.paidAllTime, warned.paidAllTime);
  assert.deepEqual(waiting.thisMonth, warned.thisMonth);
  assert.equal(waiting.paidAllTime.unmatchedMicro, SPENT_MICRO);
  assert.equal(waiting.paidAllTime.totalMicro, SPENT_MICRO);
  assert.equal(waiting.waitingMicro, SPENT_MICRO);
  assert.equal(warned.waitingMicro, 0);
});

for (const [name, parts] of Object.entries(STILL_A_WARNING)) {
  test(`${name} is still a warning and its spend is counted, because nothing says a record is on its way`, () => {
    const model = modelOf(parts);
    assert.deepEqual(slugsOf(model.warnings), [SLUG]);
    assert.deepEqual(model.waiting, []);
    assert.equal(model.waitingMicro, 0);
    assert.equal(model.paidAllTime.unmatchedMicro, SPENT_MICRO);
  });
}

test('the file lists the waiting ledger under its own heading with its spend, and has no Warnings heading', () => {
  const markdown = reportMarkdown(modelOf({ ledgers: [pending()], claims: [held()] }));
  const headings = markdown.split('\n').filter((line) => line.startsWith('## '));
  assert.equal(headings.at(-1), '## Waiting for a record');
  assert.ok(!headings.includes('## Warnings'));
  assert.ok(markdown.includes(`- ${WAITING}`));
  assert.match(markdown, /Together they cost 0\.027 USD/);
  assert.match(markdown, /no person has to act/);
});

test('the Slack message counts no warning for a waiting ledger and still reports its spend', () => {
  const post = recordOf({ slug: 'a-post', at: '2026-11-02T07:00:00.000Z', calls: [DRAFT] });
  const model = modelOf({
    ledgers: [pending(), ledgerOf({ slug: 'a-post', calls: [DRAFT] })],
    records: [post],
    claims: [held()],
  });
  const { text } = spendMessage({ model, rows: model.rows, status: STATUS, links: NO_LINKS });
  assert.match(text, /Warnings: 0 \(/);
  assert.doesNotMatch(text, new RegExp(SLUG));
  assert.match(text, /spend with no generation record 0\.027 USD/);
});

test('the gate regenerates the report with the claims, so a report written without them is refused', () => {
  const files = filesOf({ ledgers: [pending()], claims: [held()] });
  const committed = reportText(files, REVISION, GENERATED_AT);
  assert.deepEqual(spendReportFindings({ ...files, committed }), []);
  const blind = reportText({ ledgers: files.ledgers, records: files.records }, REVISION, GENERATED_AT);
  assert.deepEqual(
    spendReportFindings({ ...files, committed: blind }).map(({ rule }) => rule),
    ['spend-report-differs']
  );
});

const withScene = (body) => async () => {
  const scene = createScene();
  try {
    await body(scene);
  } finally {
    scene.cleanup();
  }
};

test(
  'a ledger on main whose record exists only on an open branch is waiting, and a ledger whose record exists nowhere warns',
  withScene((scene) => {
    const at = '2026-11-03T09:00:00.000Z';
    const onBranch = 'on-an-open-branch';
    const nowhere = 'nowhere';
    const claims = [claimOf({ slug: onBranch, runId: '1' }), claimOf({ slug: nowhere, runId: '1', ...LAPSED })];
    scene.putLedger(sceneLedger({ slug: onBranch, generationUsd: 0.027 }));
    scene.putLedger(sceneLedger({ slug: nowhere, generationUsd: 0.027 }));
    for (const claim of claims) scene.put(claimPath(claim), claim);
    scene.commit('claim');
    scene.asRemote(`autowriter/${onBranch}`, (branch) =>
      branch.putRecord(sceneRecord({ slug: onBranch, generatedAt: at, usd: 0.027 }))
    );
    const { model } = spendReportFile({ repoRoot: scene.root, revision: REVISION, at });
    assert.deepEqual(slugsOf(model.waiting), [onBranch]);
    assert.deepEqual(slugsOf(model.warnings), [nowhere]);
    assert.equal(model.waitingMicro, SPENT_MICRO);
    assert.equal(model.paidAllTime.unmatchedMicro, 2 * SPENT_MICRO);
    const sawRecord = Object.fromEntries(
      readLedgers({ repoRoot: scene.root }).map(({ ledger, record }) => [ledger.slug, record !== null])
    );
    assert.deepEqual(sawRecord, { [onBranch]: true, [nowhere]: false });
  })
);
