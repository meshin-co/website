import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  browsersMissingFromCi,
  staleGateDeclarations,
  gatesCitedButUndefined,
  gatesMissingFromCi,
  indexFindings,
  parseStatus,
  statusFindings,
} from './plan-gate.mjs';

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

test('every gate script defined in package.json runs in CI, because L36 says a gate not in ci.yml is not a gate', () => {
  const missing = gatesMissingFromCi(
    { 'gate:one': 'node a.mjs', 'gate:two': 'node b.mjs', build: 'astro build' },
    'jobs:\n  x:\n    steps:\n      - run: npm run gate:one\n'
  );
  assert.deepEqual(missing, ['gate:two']);
});

test('a gate named nowhere in package.json but cited in the script index is reported as undefined', () => {
  const undefinedGates = gatesCitedButUndefined(
    { 'gate:one': 'node a.mjs' },
    '| `x.mjs` | `gate:ghost` | does a thing |'
  );
  assert.deepEqual(undefinedGates, ['gate:ghost']);
});

test('a gate both defined and wired is clean in both directions', () => {
  assert.deepEqual(gatesMissingFromCi({ 'gate:one': 'x' }, '- run: npm run gate:one'), []);
  assert.deepEqual(gatesCitedButUndefined({ 'gate:one': 'x' }, '| `a.mjs` | `gate:one` | y |'), []);
});

test('a playwright project whose browser CI never installs is reported, because the suite would die on first run', () => {
  const config =
    "projects: [{ name: 'desktop', use: devices['Desktop Chrome'] }, { name: 'webkit', use: devices['Desktop Safari'] }]";
  assert.deepEqual(browsersMissingFromCi(config, 'npx playwright install --with-deps chromium'), ['webkit']);
  assert.deepEqual(browsersMissingFromCi(config, 'npx playwright install --with-deps chromium webkit'), []);
});

test('a longer gate name does not satisfy a shorter one, because gate:lh:one is not gate:lh', () => {
  assert.deepEqual(gatesMissingFromCi({ 'gate:lh': 'x', 'gate:lh:one': 'y' }, '- run: npm run gate:lh:one'), [
    'gate:lh',
  ]);
});

test('a gate may be declared local-only with a reason, and then it is not a finding', () => {
  const declared = { 'gate:lh': 'the CI matrix runs gate:lh:one per shard' };
  assert.deepEqual(gatesMissingFromCi({ 'gate:lh': 'x' }, '', declared), []);
});

test('a declaration with an empty reason does not excuse the gate', () => {
  assert.deepEqual(gatesMissingFromCi({ 'gate:lh': 'x' }, '', { 'gate:lh': '' }), ['gate:lh']);
});

test('a declaration for a gate that does not exist is itself a finding', () => {
  assert.deepEqual(staleGateDeclarations({ 'gate:lh': 'x' }, { 'gate:ghost': 'gone' }), ['gate:ghost']);
});
