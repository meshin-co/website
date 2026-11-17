import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { specMirrors } from '../src/utils/spec-artefacts.mjs';
import { gateReport } from './agent-interfaces-gate.mjs';

const NONE_DECLARED = { declared: 0, compared: 0, skipped: [], problems: [] };
const COMPARED = { declared: 1, compared: 1, skipped: [], problems: [] };
const SKIP_REASON = 'no checkout at /x, which mirror.json declares as ../x';
const NOT_COMPARED = {
  declared: 1,
  compared: 0,
  skipped: [{ file: 'src/data/spec/zz-1.0/vectors.json', reason: SKIP_REASON }],
  problems: [],
};

function specTree(t, { path }) {
  const root = mkdtempSync(join(tmpdir(), 'agent-interfaces-report-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const folder = join(root, 'src/data/spec/zz-1.0');
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'vectors.json'), 'abc');
  writeFileSync(join(folder, 'mirror.json'), JSON.stringify({ 'vectors.json': { checkout: 'upstream', path } }));
  mkdirSync(join(root, 'upstream/fixtures'), { recursive: true });
  writeFileSync(join(root, 'upstream/fixtures/vectors.json'), 'abc');
  return root;
}

test('no finding and every mirror compared passes, and the counts come before the verdict', () => {
  assert.deepEqual(gateReport([], COMPARED), {
    failed: false,
    lines: ['  mirrors: 1 declared, 1 compared, 0 not compared', 'agents: 0 findings'],
  });
});

test('a mirror that was not compared passes, and the output says plainly that nothing was compared and why', () => {
  assert.deepEqual(gateReport([], NOT_COMPARED), {
    failed: false,
    lines: [
      '  mirrors: 1 declared, 0 compared, 1 not compared; nothing was compared with an upstream file',
      `  not compared: src/data/spec/zz-1.0/vectors.json: ${SKIP_REASON}`,
      'agents: 0 findings',
    ],
  });
});

test('a tree that declares no mirror passes, and the output says that none is declared', () => {
  assert.deepEqual(gateReport([], NONE_DECLARED), {
    failed: false,
    lines: ['  mirrors: none declared', 'agents: 0 findings'],
  });
});

test('a mirror problem is a finding: it fails the gate and is counted after the findings of the built tree', () => {
  const problem =
    'src/data/spec/zz-1.0: /c holds no p, so f cannot be compared with it: the layout of that checkout moved';
  const report = gateReport(['robots.txt: no Content-Signal'], {
    declared: 1,
    compared: 0,
    skipped: [],
    problems: [problem],
  });
  assert.equal(report.failed, true);
  assert.deepEqual(report.lines, [
    '  robots.txt: no Content-Signal',
    `  ${problem}`,
    '  mirrors: 1 declared, 0 compared, 1 not compared; nothing was compared with an upstream file',
    'agents: 2 findings',
  ]);
});

test('a finding of the built tree fails the gate whatever the mirrors say', () => {
  assert.equal(gateReport(['robots.txt: no Content-Signal'], COMPARED).failed, true);
});

test('a wrong path with the checkout present turns the gate red', (t) => {
  const report = gateReport([], specMirrors({ root: specTree(t, { path: 'fixtures/vector.json' }) }));
  assert.equal(report.failed, true);
  assert.match(report.lines[0], /^ {2}src\/data\/spec\/zz-1\.0: .* holds no fixtures\/vector\.json/);
  assert.match(report.lines[0], /the layout of that checkout moved/);
  assert.equal(report.lines.at(-1), 'agents: 1 findings');
});

test('the right path with the checkout present passes, and the comparison is counted', (t) => {
  const report = gateReport([], specMirrors({ root: specTree(t, { path: 'fixtures/vectors.json' }) }));
  assert.deepEqual(report, {
    failed: false,
    lines: ['  mirrors: 1 declared, 1 compared, 0 not compared', 'agents: 0 findings'],
  });
});
