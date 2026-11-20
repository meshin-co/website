import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resumableReasonOf, resumeDecision } from './pr-resume.mjs';
import {
  NOW,
  OWN_COMMITS,
  codeCommitAfter,
  realLedger,
  watcherDetail,
  withLastEscalation,
} from './fixtures/resume-world.mjs';

const escalatedAs = (kind, reason) => withLastEscalation(realLedger(), { kind, detail: watcherDetail(reason) });
const decide = (ledger, forced = false) =>
  resumeDecision({ ledger, commitsOnBranch: OWN_COMMITS, mainChanges: [codeCommitAfter()], forced, now: NOW });

const CANCELLED_RUN_ESCALATIONS = [
  ['hard-stop', 'inconclusive-cancel'],
  ['no-convergence', 'rerun-cap'],
];

for (const [kind, reason] of CANCELLED_RUN_ESCALATIONS) {
  test(`an escalation for ${reason} does not resume by itself, whatever main did since`, () => {
    const ledger = escalatedAs(kind, reason);

    assert.equal(resumableReasonOf(ledger), null);
    assert.deepEqual(decide(ledger), { resume: false, reason: 'not-resumable-kind' });
  });

  test(`only the owner clears an escalation for ${reason}, by forcing the resume`, () => {
    assert.deepEqual(decide(escalatedAs(kind, reason), true), { resume: true, by: 'owner' });
  });
}
