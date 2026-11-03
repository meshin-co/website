import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  RESUME_WAYS,
  ledgerText,
  ledgerWithResume,
  newLedger,
  validateLedger,
  verdictInForce,
  writeLedger,
} from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';

const DECIDED_AT = '2026-11-03T11:09:44.265Z';

const resume = (extra = {}) => ({
  at: '2026-11-03T12:30:00.000Z',
  by: 'main-change',
  mainSha: 'c'.repeat(40),
  failedJobs: ['cheap-gates'],
  ...extra,
});

const escalated = () => ({
  ...newLedger({ slug: 'a-slug', runId: '41', pullRequest: 84 }),
  verdict: { state: 'escalated', reason: 'a job that is not a content gate failed', decidedAt: DECIDED_AT },
  escalations: [
    {
      id: 'esc-1',
      kind: 'unrepairable',
      title: 'a job that is not a content gate failed',
      detail: 'The watcher judged head aa: escalate, not-a-content-gate.',
      raisedAt: DECIDED_AT,
      receipts: [{ channel: 'issue', attemptedAt: DECIDED_AT, delivered: true, status: 201, issue: 85, error: null }],
    },
  ],
});

const withResumes = (...resumes) => ({ ...escalated(), resumes });
const problemsOf = (ledger) => validateLedger(ledger).map(describeProblem);

test('the ways a pull request is resumed are the three the design names', () => {
  assert.deepEqual(RESUME_WAYS, ['main-change', 'approval-held', 'owner']);
});

const IN_FORCE = [
  ['no resume at all', escalated()],
  ['a resume before the decision', withResumes(resume({ at: '2026-11-03T11:00:00.000Z' }))],
  ['a resume at the very instant of the decision', withResumes(resume({ at: DECIDED_AT }))],
  ['a resume that writes no milliseconds, inside the same second', withResumes(resume({ at: '2026-11-03T11:09:44Z' }))],
];

for (const [name, ledger] of IN_FORCE) {
  test(`a verdict stays in force with ${name}`, () => {
    assert.equal(verdictInForce(ledger), true);
  });
}

const SUPERSEDED = [
  ['a resume one millisecond after the decision', withResumes(resume({ at: '2026-11-03T11:09:44.266Z' }))],
  ['a resume a day after the decision', withResumes(resume({ at: '2026-11-04T11:09:44.265Z' }))],
  [
    'one late resume among earlier ones',
    withResumes(resume({ at: '2026-11-01T00:00:00.000Z' }), resume({ at: '2026-11-03T12:00:00.000Z' })),
  ],
  ['a resume the next whole second, with no milliseconds', withResumes(resume({ at: '2026-11-03T11:09:45Z' }))],
];

for (const [name, ledger] of SUPERSEDED) {
  test(`a verdict is no longer in force with ${name}`, () => {
    assert.equal(verdictInForce(ledger), false);
  });
}

test('an open verdict has no decision to supersede, so it is in force whatever the resumes say', () => {
  const open = newLedger({ slug: 'a-slug', runId: '41', pullRequest: 84 });

  assert.equal(verdictInForce(open), true);
  assert.equal(verdictInForce({ ...open, resumes: [resume()] }), true);
});

test('a ledger with a resume added is a new ledger: the old one is untouched, the entry is last, and it validates', () => {
  const before = withResumes(resume({ at: '2026-11-01T00:00:00.000Z' }));
  const after = ledgerWithResume(before, resume({ at: '2026-11-04T00:00:00.000Z', by: 'owner', mainSha: null }));

  assert.equal(before.resumes.length, 1);
  assert.equal(after.resumes.length, 2);
  assert.deepEqual(after.resumes[0], before.resumes[0]);
  assert.equal(after.resumes.at(-1).by, 'owner');
  assert.deepEqual(problemsOf(after), []);
  assert.equal(verdictInForce(after), false);
});

test('a ledger that never had resumes gets a list of one, and every other field is carried over', () => {
  const after = ledgerWithResume(escalated(), resume());

  assert.deepEqual(after.resumes, [resume()]);
  assert.deepEqual({ ...after, resumes: undefined }, { ...escalated(), resumes: undefined });
});

test('the text of a ledger is the text writeLedger puts on disk, so a commit made from it holds the same bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'ledger-text-'));
  try {
    const path = join(root, 'a-slug.json');
    const ledger = withResumes(resume());
    writeLedger(path, ledger);

    assert.equal(ledgerText(path, ledger), readFileSync(path, 'utf8'));
    assert.ok(ledgerText(path, ledger).endsWith('}\n'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the text of a ledger the schema refuses is refused with the same error, and the file name is checked too', () => {
  const path = join(tmpdir(), 'a-slug.json');

  assert.throws(() => ledgerText(path, withResumes(resume({ by: 'schedule' }))), /resumes\[0\]\.by must be one of/);
  assert.throws(
    () => ledgerText(join(tmpdir(), 'other.json'), escalated()),
    /slug a-slug does not match the file name/
  );
});
