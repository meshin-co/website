import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import { parse } from 'yaml';

import { spendReportFindings } from './autowriter-spend-rules.mjs';
import {
  GENERATED_AT,
  escalatedLedger,
  filesOf,
  ledgerOf,
  recordOf,
  writingCall,
} from './fixtures/spend-report-corpus.mjs';
import { REPORT_PATH, reportText } from './spend-report-text.mjs';

const WORKFLOW = parse(
  readFileSync(resolve(import.meta.dirname, '..', '..', '.github', 'workflows', 'write-daily.yml'), 'utf8')
);
const STEPS = WORKFLOW.jobs.write.steps;
const REVISION = 'abc1234';

const failedRunSteps = () => STEPS.filter((step) => /steps\.write\.outcome\s*==\s*'failure'/.test(step.if ?? ''));
const commitStep = () => failedRunSteps().find(({ run = '' }) => run.includes('commit-to-main.mjs'));
const escalateStep = () => failedRunSteps().find(({ run = '' }) => run.includes('escalate-run.mjs'));

test('the commit of a failed write holds the report beside the ledger, so main does not go red on the spend it records', () => {
  const step = commitStep();
  assert.ok(step, 'no step commits the ledger of a failed write');
  assert.match(step.run, /--path "\$\(jq -r \.ledgerPath "\$DECISION_FILE"\)"/);
  assert.ok(step.run.includes(`--path ${REPORT_PATH}`), step.run);
});

test('the report is regenerated after the escalation and before the commit, because it names the verdict the ledger ends on', () => {
  const step = commitStep();
  const regenerated = step.run.indexOf('scripts/spend-report.mjs');
  assert.notEqual(regenerated, -1, 'the commit step never regenerates the report');
  assert.ok(regenerated < step.run.indexOf('commit-to-main.mjs'), 'the report is regenerated after it is committed');
  assert.ok(STEPS.indexOf(escalateStep()) < STEPS.indexOf(step), 'the ledger is committed before it is escalated');
});

test('a ledger committed alone leaves the committed report stale, and the regenerated report is what the gate accepts', () => {
  const call = writingCall({ input: 12000, output: 3000, tag: 'draft' });
  const post = recordOf({ slug: 'a-post', at: '2026-11-02T07:00:00.000Z', calls: [call] });
  const counted = ledgerOf({ slug: 'a-post', calls: post.calls });
  const failed = escalatedLedger(ledgerOf({ slug: 'lost-post', calls: [call] }));
  const committed = reportText(filesOf({ ledgers: [counted], records: [post] }), REVISION, GENERATED_AT);
  const landed = filesOf({ ledgers: [counted, failed], records: [post] });

  assert.deepEqual(
    spendReportFindings({ ...landed, committed }).map(({ rule }) => rule),
    ['spend-report-differs']
  );
  assert.deepEqual(spendReportFindings({ ...landed, committed: reportText(landed, REVISION, GENERATED_AT) }), []);
});
