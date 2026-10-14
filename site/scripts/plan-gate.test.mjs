import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  browsersMissingFromCi,
  changeDirectories,
  staleGateDeclarations,
  unwaivableGates,
  gatesCitedButUndefined,
  gatesMissingFromCi,
  knownGapRows,
  knownGapsFindings,
  pendingChangeFindings,
  summaryLine,
} from './plan-gate.mjs';

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

test('every gap row is counted, the malformed one too, and never the header or the separator', () => {
  const markdown = [
    '| id | claim | why it is not closed | owner | opened |',
    '| --- | --- | --- | --- | --- |',
    '| G1 | a claim | a reason | owner | 2026-09-23 |',
    '| G2 | a claim | a reason | 2026-09-23 |',
  ].join('\n');
  assert.deepEqual(
    knownGapRows(markdown).map(([id]) => id),
    ['G1', 'G2']
  );
});

const CHANGES = {
  active: ['10-harness-integrity', '11-launch'],
  archived: ['2026-10-13-01-initialization', '2026-10-13-09-editorial-pass-every-text'],
};

const pendingRules = (entry, changes = CHANGES) =>
  pendingChangeFindings([{ gate: 'gate:visual', reason: 'no specimen yet', ...entry }], changes).map(
    ({ rule }) => rule
  );

test('a pending entry naming a change that does not exist is a finding, so a typo cannot park a debt for ever', () => {
  assert.deepEqual(pendingRules({ change: '99-nowhere' }), ['pending-specimen-unknown-change']);
});

test('a pending entry whose change is archived is a finding, because the specimen is then overdue', () => {
  assert.deepEqual(pendingRules({ change: '01-initialization' }), ['pending-specimen-change-archived']);
});

test('a pending entry whose change is still open is quiet, whether the change is in flight or parked', () => {
  assert.deepEqual(pendingRules({ change: '10-harness-integrity' }), []);
  assert.deepEqual(pendingRules({ change: '11-launch' }), []);
});

test('a change is matched by its whole name, never by its number or its slug alone', () => {
  assert.deepEqual(pendingRules({ change: '10' }), ['pending-specimen-unknown-change']);
  assert.deepEqual(pendingRules({ change: 'launch' }), ['pending-specimen-unknown-change']);
  assert.deepEqual(pendingRules({ change: 'initialization' }), ['pending-specimen-unknown-change']);
});

test('an entry that still names a phase instead of a change is a finding, because the phase files are gone', () => {
  assert.deepEqual(pendingRules({ phase: 'phase-5' }), ['pending-specimen-unknown-change']);
});

test('an archived change stays overdue when an open folder of the same name comes back', () => {
  const reopened = { active: ['01-initialization'], archived: ['2026-10-13-01-initialization'] };
  assert.deepEqual(pendingRules({ change: '01-initialization' }, reopened), ['pending-specimen-change-archived']);
});

test('a pending entry with no reason is a finding, because a debt nobody explains is a waiver', () => {
  assert.deepEqual(pendingRules({ change: '11-launch', reason: ' ' }), ['pending-specimen-no-reason']);
  assert.deepEqual(pendingRules({ change: '11-launch', reason: undefined }), ['pending-specimen-no-reason']);
});

test('every pending entry is judged, not only the first', () => {
  const findings = pendingChangeFindings(
    [
      { gate: 'gate:a', change: '99-nowhere', reason: 'x' },
      { gate: 'gate:b', change: '01-initialization', reason: 'x' },
    ],
    CHANGES
  );
  assert.deepEqual(
    findings.map(({ rule }) => rule),
    ['pending-specimen-unknown-change', 'pending-specimen-change-archived']
  );
});

test('the change tree lists the open changes and the archived ones, never the archive folder or a loose file', () => {
  const root = mkdtempSync(join(tmpdir(), 'plan-gate-changes-'));
  try {
    mkdirSync(join(root, '10-open'));
    mkdirSync(join(root, 'archive', '2026-01-01-01-closed'), { recursive: true });
    writeFileSync(join(root, 'notes.md'), '');
    writeFileSync(join(root, 'archive', '.gitkeep'), '');
    assert.deepEqual(changeDirectories(root), { active: ['10-open'], archived: ['2026-01-01-01-closed'] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a harness-integrity gate cannot be waived out of CI by a sentence', () => {
  assert.deepEqual(unwaivableGates({ 'gate:lh': 'the matrix runs it per shard' }), []);
  assert.deepEqual(unwaivableGates({ 'gate:spec': 'slow on my laptop' }), ['gate:spec']);
  assert.deepEqual(unwaivableGates({ 'gate:docs': 'a', 'test:smoke': 'b', 'audit:polish': 'c' }).sort(), [
    'gate:docs',
    'test:smoke',
  ]);
});

test('the summary names what the gate read: the scripts held to ci.yml, the gap rows and the pending specimens', () => {
  assert.equal(
    summaryLine({ scripts: 31, workflows: 2, gapRows: 32, pending: 0, findings: 0 }),
    'plan: 31 scripts checked against 2 workflows, 32 gap rows, 0 pending specimens, 0 findings'
  );
});
