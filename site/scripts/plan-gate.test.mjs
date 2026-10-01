import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  browsersMissingFromCi,
  staleGateDeclarations,
  gatesCitedButUndefined,
  gatesMissingFromCi,
  indexFindings,
  knownGapsFindings,
  parseStatus,
  pendingPhaseFindings,
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

test('a declared reason of true, 1 or a blank string does not excuse the gate, only a non-empty trimmed string does', () => {
  assert.deepEqual(gatesMissingFromCi({ 'gate:lh': 'x' }, '', { 'gate:lh': true }), ['gate:lh']);
  assert.deepEqual(gatesMissingFromCi({ 'gate:lh': 'x' }, '', { 'gate:lh': 1 }), ['gate:lh']);
  assert.deepEqual(gatesMissingFromCi({ 'gate:lh': 'x' }, '', { 'gate:lh': ' ' }), ['gate:lh']);
  assert.deepEqual(gatesMissingFromCi({ 'gate:lh': 'x' }, '', { 'gate:lh': 'because reasons' }), []);
});

test('a gate named only in a YAML comment line is not treated as wired', () => {
  const workflow = '# run: npm run gate:one\njobs:\n  x:\n    steps:\n      - run: npm run gate:two\n';
  assert.deepEqual(gatesMissingFromCi({ 'gate:one': 'x', 'gate:two': 'y' }, workflow), ['gate:one']);
});

test('test:smoke is checked even without the gate: prefix, because L36 names it explicitly', () => {
  assert.deepEqual(gatesMissingFromCi({ 'test:smoke': 'node mutation-smoke.mjs' }, ''), ['test:smoke']);
  assert.deepEqual(gatesMissingFromCi({ 'test:smoke': 'node mutation-smoke.mjs' }, '- run: npm run test:smoke'), []);
});

test('a script whose documented output lands under audits/ is checked even without the gate: prefix', () => {
  const scripts = { 'audit:prelaunch': 'node run-pre-launch.mjs', 'assets:gaps': 'node generate-gaps.mjs' };
  const readme =
    '| `run-pre-launch.mjs` | `audit:prelaunch` | `audits/phase-5/pre-launch.md`, all 24 checklist sections |\n' +
    '| `generate-gaps.mjs` | `assets:gaps` | `audits/phase-4.7/gaps.md` from the ledger and the registers |\n';
  assert.deepEqual(gatesMissingFromCi(scripts, '', {}, readme).sort(), ['assets:gaps', 'audit:prelaunch']);
  assert.deepEqual(gatesMissingFromCi(scripts, '- run: npm run audit:prelaunch', {}, readme), ['assets:gaps']);
});

test('a script documented outside audits/ is left alone even if it lacks the gate: prefix', () => {
  const scripts = { 'assets:robots': 'node gen-robots.mjs' };
  const readme = '| `gen-robots.mjs` | `assets:robots` | `public/robots.txt` |\n';
  assert.deepEqual(gatesMissingFromCi(scripts, '', {}, readme), []);
});

test('every npx playwright install line must list a browser a project needs, not just the first one', () => {
  const config = "use: devices['Desktop Safari']";
  assert.deepEqual(
    browsersMissingFromCi(config, [
      'npx playwright install --with-deps chromium webkit firefox',
      'npx playwright install --with-deps chromium firefox',
    ]),
    ['webkit']
  );
  assert.deepEqual(
    browsersMissingFromCi(config, [
      'npx playwright install --with-deps chromium webkit firefox',
      'npx playwright install --with-deps chromium webkit firefox',
    ]),
    []
  );
});

test('an explicit browserName literal is caught even when no Desktop device name is present', () => {
  const config = "use: { browserName: 'webkit' }";
  assert.deepEqual(browsersMissingFromCi(config, 'npx playwright install --with-deps chromium'), ['webkit']);
});

test('a mobile device name still names its engine by substring, so Mobile Safari is caught', () => {
  const config = "use: devices['Mobile Safari']";
  assert.deepEqual(browsersMissingFromCi(config, 'npx playwright install --with-deps chromium'), ['webkit']);
});

test('a known-gaps row needs both a non-empty reason and a unique id', () => {
  const header = '| id | claim | why it is not closed | owner | opened |\n| --- | --- | --- | --- | --- |\n';
  assert.deepEqual(knownGapsFindings(header + '| G1 | x happens | because y | TODO(owner) | 2026-09-22 |\n'), []);
  assert.deepEqual(
    knownGapsFindings(header + '| G1 | x happens |  | TODO(owner) | 2026-09-22 |\n').map((f) => f.rule),
    ['known-gap-empty-reason']
  );
  const duplicateIds =
    header +
    '| G1 | x happens | because y | TODO(owner) | 2026-09-22 |\n' +
    '| G1 | z happens | because w | TODO(owner) | 2026-09-22 |\n';
  assert.deepEqual(
    knownGapsFindings(duplicateIds).map((f) => f.rule),
    ['known-gap-duplicate-id']
  );
});

test('a known-gap row with the wrong cell count is reported, because a silently skipped row is an unchecked gap', () => {
  const markdown = [
    '| id | claim | why it is not closed | owner | opened |',
    '| --- | --- | --- | --- | --- |',
    '| G1 | a claim | a reason | owner | 2026-09-23 |',
    '| G2 | a claim | a reason | 2026-09-23 |',
  ].join('\n');
  assert.deepEqual(
    knownGapsFindings(markdown).map(({ rule }) => rule),
    ['known-gap-malformed-row']
  );
});

const PHASE_FILES = [
  'phase-4.5a-machine-layer-every-surface-complete.done.md',
  'phase-5.1-harness-integrity-and-geo-features.active.md',
  'phase-5-launch.next.md',
];

const pendingRules = (entry, files = PHASE_FILES) =>
  pendingPhaseFindings([{ gate: 'gate:visual', reason: 'no specimen yet', ...entry }], files).map(({ rule }) => rule);

test('a pending entry naming a phase that does not exist is a finding, so a typo cannot park a debt for ever', () => {
  assert.deepEqual(pendingRules({ phase: 'phase-99' }), ['pending-specimen-unknown-phase']);
});

test('a pending entry whose phase is already done is a finding, because the specimen is then overdue', () => {
  assert.deepEqual(pendingRules({ phase: 'phase-4.5a' }), ['pending-specimen-phase-done']);
});

test('a pending entry whose phase is still open is quiet, whether the phase is active or next', () => {
  assert.deepEqual(pendingRules({ phase: 'phase-5.1' }), []);
  assert.deepEqual(pendingRules({ phase: 'phase-5' }), []);
});

test('a phase id matches its own file and never a sibling that shares its prefix', () => {
  const siblingsOnly = ['phase-4.5a-machine-layer-every-surface-complete.done.md'];
  assert.deepEqual(pendingRules({ phase: 'phase-4' }, siblingsOnly), ['pending-specimen-unknown-phase']);
});

test('a pending entry with no reason is a finding, because a debt nobody explains is a waiver', () => {
  assert.deepEqual(pendingRules({ phase: 'phase-5', reason: ' ' }), ['pending-specimen-no-reason']);
  assert.deepEqual(pendingRules({ phase: 'phase-5', reason: undefined }), ['pending-specimen-no-reason']);
});

test('every pending entry is judged, not only the first', () => {
  const findings = pendingPhaseFindings(
    [
      { gate: 'gate:a', phase: 'phase-99', reason: 'x' },
      { gate: 'gate:b', phase: 'phase-4.5a', reason: 'x' },
    ],
    PHASE_FILES
  );
  assert.deepEqual(
    findings.map(({ rule }) => rule),
    ['pending-specimen-unknown-phase', 'pending-specimen-phase-done']
  );
});
