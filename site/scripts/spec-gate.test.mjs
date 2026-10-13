import assert from 'node:assert/strict';
import test from 'node:test';

import {
  builtByteFiles,
  calibrationFindings,
  changedFiles,
  censusFindings,
  censusFromSpecs,
  changeNameFindings,
  indexFromSpecs,
  lockedRowFindings,
  parseSpec,
  singleActiveFindings,
  skipSpecsFindings,
  tasksFindings,
  vacuityFindings,
} from './spec-gate.mjs';

const specText = (purpose, requirements) =>
  [
    '# x Specification',
    '',
    '## Purpose',
    purpose,
    '',
    '## Requirements',
    ...requirements.flatMap((name) => [
      `### Requirement: ${name}`,
      'It SHALL hold.',
      '',
      '#### Scenario: broken',
      '- **WHEN** x',
      '- **THEN** y',
      '',
    ]),
  ].join('\n');

const spec = (capability, purpose, requirements) => ({ capability, ...parseSpec(specText(purpose, requirements)) });

test('a spec yields its first purpose sentence and its requirement names in file order', () => {
  const parsed = parseSpec(
    specText('Governs budgets. Measured from the build.', ['A route stays under the cap', 'Fonts are measured'])
  );
  assert.equal(parsed.purpose, 'Governs budgets.');
  assert.deepEqual(parsed.requirements, ['A route stays under the cap', 'Fonts are measured']);
});

test('the census records requirement names, so an equal-count substitution is still a change', () => {
  const before = censusFromSpecs([spec('delivery/budgets', 'Governs budgets.', ['A route stays under the cap'])]);
  const after = censusFromSpecs([spec('delivery/budgets', 'Governs budgets.', ['A route is checked somehow'])]);
  assert.deepEqual(before, { 'delivery/budgets': ['A route stays under the cap'] });
  assert.equal(censusFindings(before, after).length, 1);
  assert.equal(censusFindings(before, before).length, 0);
});

test('a capability that disappears from the tree is a census finding, not a silent pass', () => {
  const committed = {
    'delivery/budgets': ['A route stays under the cap'],
    'content/gate': ['A post carries a source'],
  };
  const walked = { 'delivery/budgets': ['A route stays under the cap'] };
  const findings = censusFindings(committed, walked);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /content\/gate/);
});

test('the index is one line per capability taken from the purpose, so it cannot drift silently', () => {
  const index = indexFromSpecs([
    spec('delivery/budgets', 'Governs the byte budgets. Second sentence.', ['A route stays under the cap']),
    spec('content/gate', 'Governs what a post must carry.', ['A post carries a source']),
  ]);
  assert.match(index, /- \[content\/gate\]\(specs\/content\/gate\/spec\.md\) — Governs what a post must carry\./);
  assert.ok(!index.includes('Second sentence.'));
});

test('a validator that reports fewer specs than the tree holds is a disagreement, not a pass', () => {
  assert.equal(vacuityFindings({ cliSpecs: 10, walkedSpecs: 10, specItems: 10 }).length, 0);
  assert.equal(vacuityFindings({ cliSpecs: 9, walkedSpecs: 10, specItems: 9 }).length, 1);
});

test('an active change is numbered from ten up, with a unique prefix, so it cannot collide with a phase bucket', () => {
  assert.equal(changeNameFindings(['10-launch', '20-growth'], []).length, 0);
  assert.equal(changeNameFindings(['9-launch'], []).length, 1);
  assert.equal(changeNameFindings(['10-launch', '10-other'], []).length, 1);
  assert.equal(changeNameFindings([], ['2026-10-13-10-phase-0']).length, 0);
  assert.equal(changeNameFindings([], ['phase-0-initialization']).length, 1);
});

test('an active change without a task list cannot owe anything, so the gate refuses it', () => {
  assert.equal(tasksFindings([{ name: '10-launch', hasTasks: true }]).length, 0);
  assert.equal(tasksFindings([{ name: '10-launch', hasTasks: false }]).length, 1);
});

test('a change cannot both opt out of spec validation and carry a delta', () => {
  assert.equal(skipSpecsFindings([{ name: '10-tooling', archived: false, skipSpecs: true, deltas: 0 }]).length, 0);
  assert.equal(skipSpecsFindings([{ name: '10-tooling', archived: false, skipSpecs: true, deltas: 1 }]).length, 1);
  assert.equal(skipSpecsFindings([{ name: '10-tooling', archived: false, skipSpecs: false, deltas: 1 }]).length, 0);
  assert.equal(
    skipSpecsFindings([{ name: '2026-10-13-01-phase-0', archived: true, skipSpecs: true, deltas: 2 }]).length,
    0
  );
});

test('a validator run that saw no specs is vacuous even when it saw changes', () => {
  assert.equal(vacuityFindings({ cliSpecs: 0, walkedSpecs: 0, specItems: 0 }).length, 1);
  assert.equal(vacuityFindings({ cliSpecs: 10, walkedSpecs: 10, specItems: 10 }).length, 0);
});

test('a second unblocked change breaks the one-at-a-time rule the plan tree used to enforce', () => {
  const rows = new Set(['G22']);
  const blocked = { name: '20-launch', blocked: 'G22: owner access to DNS', ticked: 0, risk: 'R3' };
  assert.equal(singleActiveFindings([{ name: '10-work', ticked: 2 }, blocked], rows).length, 0);
  assert.equal(
    singleActiveFindings(
      [
        { name: '10-work', ticked: 2 },
        { name: '20-other', ticked: 0 },
      ],
      rows
    ).length,
    1
  );
});

test('a blocked change that is being worked on is active, whatever its sidecar says', () => {
  const working = { name: '20-launch', blocked: 'owner access', ticked: 3, risk: 'R3' };
  assert.equal(singleActiveFindings([{ name: '10-work', ticked: 1 }, working]).length, 1);
});

test('the built-byte surface covers shipped client scripts and the budget file, not only src', () => {
  const changed = [
    'site/public/search/index-model.mjs',
    'site/budgets.json',
    'docs/PRD.md',
    'openspec/specs/delivery/budgets/spec.md',
  ];
  assert.deepEqual(builtByteFiles(changed), ['site/public/search/index-model.mjs', 'site/budgets.json']);
});

test('a change that moves built bytes owes a calibration group; a prose change does not', () => {
  const touching = { changed: ['site/src/pages/index.astro'], changes: [{ name: '10-work', calibration: false }] };
  assert.equal(calibrationFindings(touching).length, 1);
  assert.equal(calibrationFindings({ ...touching, changes: [{ name: '10-work', calibration: true }] }).length, 0);
  assert.equal(
    calibrationFindings({ changed: ['docs/PRD.md'], changes: [{ name: '10-work', calibration: false }] }).length,
    0
  );
});

test('an empty range is reported only when a range was named, because a clean checkout has nothing to judge', () => {
  const inFlight = [{ name: '10-work', calibration: false }];
  const named = calibrationFindings({ changed: [], changes: inFlight, rangeWasNamed: true });
  assert.equal(named.length, 1);
  assert.match(named[0], /no files/);
  assert.deepEqual(calibrationFindings({ changed: [], changes: inFlight, rangeWasNamed: false }), []);
  assert.deepEqual(calibrationFindings({ changed: [], changes: [], rangeWasNamed: true }), []);
});

test('a requirement citing a locked row that does not exist is a dead citation', () => {
  const specs = [spec('delivery/budgets', 'Governs budgets.', ['A route stays under the cap'])];
  specs[0].lockedRows = ['L13'];
  assert.equal(lockedRowFindings(specs, new Set(['L13'])).length, 0);
  assert.equal(lockedRowFindings(specs, new Set(['L12'])).length, 1);
});

test('two requirements claiming the same locked row means one of them is not the row owner', () => {
  const a = spec('delivery/budgets', 'Governs budgets.', ['A route stays under the cap']);
  const b = spec('content/gate', 'Governs posts.', ['A post carries a source']);
  a.lockedRows = ['L13'];
  b.lockedRows = ['L13'];
  assert.equal(lockedRowFindings([a, b], new Set(['L13'])).length, 1);
});

test('an explicit range wins, and otherwise committed, working and untracked files are merged once', () => {
  const calls = [];
  const git = (args) => {
    const call = args.join(' ');
    calls.push(call);
    if (call === 'diff --name-only x..y') return 'ranged.md\n';
    if (call === 'merge-base HEAD origin/main') return 'base1\n';
    if (call === 'diff --name-only base1..HEAD') return 'a.md\nb.md\n';
    if (call === 'diff --name-only HEAD') return 'b.md\n';
    return 'c.md\n';
  };
  assert.deepEqual(changedFiles({ git, range: 'x..y' }), ['ranged.md']);
  assert.deepEqual(calls, ['diff --name-only x..y']);
  assert.deepEqual(changedFiles({ git }), ['a.md', 'b.md', 'c.md']);
});

test('a range that resolves to nothing yields no files rather than a blank entry', () => {
  const git = (args) => (args[0] === 'merge-base' ? 'base1\n' : '\n  \n');
  assert.deepEqual(changedFiles({ git }), []);
  assert.deepEqual(changedFiles({ git: () => '' }), []);
});

test('an unusable range falls back to the merge base rather than judging nothing', () => {
  const resolved = [];
  const git = (args) => {
    const call = args.join(' ');
    resolved.push(call);
    if (call.startsWith('diff --name-only 0000000')) return null;
    if (call === 'merge-base HEAD origin/main') return 'base1\n';
    if (call === 'diff --name-only base1..HEAD') return 'fallback.md\n';
    return '';
  };
  assert.deepEqual(changedFiles({ git, range: '0000000000000000000000000000000000000000..abc1234' }), ['fallback.md']);
  assert.ok(resolved.includes('merge-base HEAD origin/main'));

  const failing = (args) => {
    const call = args.join(' ');
    if (call === 'diff --name-only gone..HEAD') return null;
    if (call === 'merge-base HEAD origin/main') return 'base1\n';
    if (call === 'diff --name-only base1..HEAD') return 'fallback.md\n';
    return '';
  };
  assert.deepEqual(changedFiles({ git: failing, range: 'gone..HEAD' }), ['fallback.md']);
});

test('a blocked change escapes the single-active rule only by citing a gap row that exists', () => {
  const rows = new Set(['G21']);
  const flight = { name: '10-one', blocked: null, ticked: 1 };
  const parked = { name: '11-two', blocked: 'G21 keeps this parked', ticked: 0 };
  assert.deepEqual(singleActiveFindings([flight, parked], rows), []);
  assert.equal(singleActiveFindings([flight, { ...parked, blocked: 'waiting for a quiet week' }], rows).length, 1);
  assert.equal(singleActiveFindings([flight, { ...parked, blocked: 'G99 does not exist' }], rows).length, 1);
  assert.equal(singleActiveFindings([flight, { ...parked, ticked: 2 }], rows).length, 1);
});
