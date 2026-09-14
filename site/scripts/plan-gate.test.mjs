import assert from 'node:assert/strict';
import { test } from 'node:test';

import { statusFindings, indexFindings, parseStatus } from './plan-gate.mjs';

test('the status is read from the filename, not from prose', () => {
  assert.equal(parseStatus('phase-5-launch.next.md'), 'next');
  assert.equal(parseStatus('phase-4.6-answer-engine-hardening.done.md'), 'done');
  assert.equal(parseStatus('phase-9-whatever.md'), null);
});

test('an unknown status word is refused', () => {
  assert.deepEqual(
    statusFindings([{ file: 'phase-1-x.finished.md', status: 'finished' }]).map((f) => f.rule),
    ['unknown-status']
  );
});

test('two active phases fail, because only one thing is in flight', () => {
  const findings = statusFindings([
    { file: 'a.active.md', status: 'active' },
    { file: 'b.active.md', status: 'active' },
  ]);
  assert.deepEqual(
    findings.map((f) => f.rule),
    ['multiple-active']
  );
});

test('two next phases fail for the same reason', () => {
  const findings = statusFindings([
    { file: 'a.next.md', status: 'next' },
    { file: 'b.next.md', status: 'next' },
  ]);
  assert.deepEqual(
    findings.map((f) => f.rule),
    ['multiple-next']
  );
});

test('a normal board with one next and the rest done passes', () => {
  assert.deepEqual(
    statusFindings([
      { file: 'a.done.md', status: 'done' },
      { file: 'b.next.md', status: 'next' },
      { file: 'c.planned.md', status: 'planned' },
    ]),
    []
  );
});

test('a phase file the index never lists is reported', () => {
  const findings = indexFindings({ listed: ['a.done.md'], present: ['a.done.md', 'b.next.md'] });
  assert.deepEqual(
    findings.map((f) => f.rule),
    ['unlisted-phase']
  );
});

test('an index row pointing at a file that does not exist is reported', () => {
  const findings = indexFindings({ listed: ['a.done.md', 'gone.done.md'], present: ['a.done.md'] });
  assert.deepEqual(
    findings.map((f) => f.rule),
    ['missing-phase']
  );
});

test('a matching index and directory passes', () => {
  assert.deepEqual(indexFindings({ listed: ['a.done.md'], present: ['a.done.md'] }), []);
});
