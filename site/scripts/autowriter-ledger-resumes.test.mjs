import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { newLedger, readLedger, validateLedger, writeLedger } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { capture } from './fixtures/resume-world.mjs';
import { recordFiles, recordPath } from './record-layout.mjs';

const MAIN_SHA = 'c'.repeat(40);
const DECIDED_AT = '2026-11-03T11:09:44.265Z';
const RESUMED_AT = '2026-11-03T12:30:00.000Z';

const resume = (extra = {}) => ({
  at: RESUMED_AT,
  by: 'main-change',
  mainSha: MAIN_SHA,
  failedJobs: ['cheap-gates', 'visual-and-axe (1)'],
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
const withoutField = (name) => Object.fromEntries(Object.entries(resume()).filter(([key]) => key !== name));

test('a ledger that has been resumed is valid, and a ledger that never was has no resumes and stays valid', () => {
  assert.deepEqual(problemsOf(withResumes(resume())), []);
  assert.deepEqual(problemsOf(withResumes()), []);
  assert.deepEqual(problemsOf(escalated()), []);
});

test('the ledger of pull request 84 as GitHub served it stays valid, and so does the same ledger once resumed', () => {
  const { ledger } = capture('escalated-pull-request');

  assert.equal(ledger.escalations.length, 1);
  assert.deepEqual(problemsOf(ledger), []);
  assert.deepEqual(problemsOf({ ...ledger, resumes: [resume({ at: '2026-11-04T09:00:00.000Z' })] }), []);
});

const filedLedger = (slug) => recordPath('ledger', slug, DECIDED_AT);
const problemsFiled = (root) =>
  recordFiles(root, 'ledger').map((file) => [file, problemsOf(JSON.parse(readFileSync(join(root, file), 'utf8')))]);

test('a scan finds the ledgers filed in a tree, reads one resumed and one never resumed as valid, and names the file with a bad resume', () => {
  const root = mkdtempSync(join(tmpdir(), 'ledger-resumes-'));
  try {
    const never = { ...escalated(), slug: 'a-never-resumed-slug' };
    const resumed = { ...withResumes(resume()), slug: 'a-resumed-slug' };
    for (const ledger of [never, resumed]) writeLedger(join(root, filedLedger(ledger.slug)), ledger);

    assert.deepEqual(problemsFiled(root), [
      [filedLedger(never.slug), []],
      [filedLedger(resumed.slug), []],
    ]);

    const bad = { ...withResumes(resume({ by: 'schedule' })), slug: 'a-bad-resume-slug' };
    writeFileSync(join(root, filedLedger(bad.slug)), JSON.stringify(bad));

    assert.deepEqual(problemsFiled(root), [
      [filedLedger(bad.slug), ['resumes[0].by must be one of "main-change", "approval-held", "owner"']],
      [filedLedger(never.slug), []],
      [filedLedger(resumed.slug), []],
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('every way a pull request is resumed is a valid entry, with or without a main commit and failed jobs', () => {
  for (const by of ['main-change', 'approval-held', 'owner']) {
    assert.deepEqual(problemsOf(withResumes(resume({ by }))), [], by);
  }
  assert.deepEqual(problemsOf(withResumes(resume({ by: 'owner', mainSha: null, failedJobs: [] }))), []);
});

const DEFECTS = [
  ['resumes that is not a list', { ...escalated(), resumes: resume() }, 'resumes must be of type array'],
  ['an entry with an unknown field', withResumes(resume({ note: 'x' })), 'resumes[0].note has an unexpected key'],
  ['an entry with no instant', withResumes(withoutField('at')), 'resumes[0].at is required'],
  ['an entry with no way', withResumes(withoutField('by')), 'resumes[0].by is required'],
  ['an entry with no main commit field', withResumes(withoutField('mainSha')), 'resumes[0].mainSha is required'],
  ['an entry with no failed jobs field', withResumes(withoutField('failedJobs')), 'resumes[0].failedJobs is required'],
  [
    'an instant that is not on the calendar',
    withResumes(resume({ at: '2026-02-31T00:00:00.000Z' })),
    'resumes[0].at must be a real calendar instant, got "2026-02-31T00:00:00.000Z"',
  ],
  [
    'an instant with no zone',
    withResumes(resume({ at: '2026-11-03T12:30:00' })),
    'resumes[0].at must match pattern ^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{1,3})?Z$',
  ],
  [
    'a way that is not one of the three',
    withResumes(resume({ by: 'schedule' })),
    'resumes[0].by must be one of "main-change", "approval-held", "owner"',
  ],
  [
    'a main commit that is not a full hash',
    withResumes(resume({ mainSha: 'e8874d4' })),
    'resumes[0].mainSha must match at least one of the allowed schemas',
  ],
  [
    'a job name that is blank',
    withResumes(resume({ failedJobs: [' '] })),
    'resumes[0].failedJobs[0] must match pattern \\S',
  ],
  [
    'failed jobs that are not a list',
    withResumes(resume({ failedJobs: 'build' })),
    'resumes[0].failedJobs must be of type array',
  ],
  [
    'the second entry wrong when the first is fine',
    withResumes(resume(), resume({ by: 'weekly' })),
    'resumes[1].by must be one of "main-change", "approval-held", "owner"',
  ],
];

for (const [name, ledger, expected] of DEFECTS) {
  test(`a ledger with ${name} is refused, naming the field`, () => {
    assert.ok(problemsOf(ledger).includes(expected), problemsOf(ledger).join(' | '));
  });
}

test('the calendar rule runs on every resume, so a bad instant in the second entry is found at its index', () => {
  const ledger = withResumes(resume(), resume({ at: '2026-13-01T00:00:00.000Z' }));

  assert.deepEqual(problemsOf(ledger), [
    'resumes[1].at must be a real calendar instant, got "2026-13-01T00:00:00.000Z"',
  ]);
});

test('a written ledger keeps its resumes, in order, and reads back equal', () => {
  const root = mkdtempSync(join(tmpdir(), 'ledger-resumes-'));
  try {
    const path = join(root, 'a-slug.json');
    const ledger = withResumes(resume(), resume({ at: '2026-11-04T08:00:00.000Z', by: 'owner', mainSha: null }));
    writeLedger(path, ledger);

    assert.deepEqual(readLedger(path), ledger);
    assert.deepEqual(
      JSON.parse(readFileSync(path, 'utf8')).resumes.map(({ by }) => by),
      ['main-change', 'owner']
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a ledger with a bad resume is refused before a byte is written', () => {
  const root = mkdtempSync(join(tmpdir(), 'ledger-resumes-'));
  try {
    const path = join(root, 'a-slug.json');

    assert.throws(
      () => writeLedger(path, withResumes(resume({ by: 'schedule' }))),
      /does not match the ledger schema: resumes\[0\]\.by must be one of/
    );
    assert.equal(existsSync(path), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
