import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { checkExport, main } from './check-export.mjs';
import { gitAt } from './fixtures/diff-repo.mjs';
import { writeScene } from './fixtures/export-scene.mjs';

const scratch = (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'check-export-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

function repository(t, options) {
  const root = scratch(t);
  const files = writeScene(root, options);
  mkdirSync(join(root, 'site', 'node_modules'), { recursive: true });
  return { root, files };
}

const step = (name, source) => ({ name, command: process.execPath, args: ['-e', source] });

test('every step runs inside the exported copy, which borrows the source dependencies and is gone afterwards', (t) => {
  const { root, files } = repository(t);
  const probe = step(
    'probe',
    "const fs = require('node:fs'); process.exit(fs.existsSync('../engine-export.json') && fs.existsSync('node_modules') ? 0 : 7)"
  );
  const result = checkExport({ root, files, steps: [probe] });
  assert.deepEqual(result.findings, []);
  assert.deepEqual(
    result.steps.map(({ name }) => name),
    ['probe']
  );
  assert.equal(existsSync(result.target), false);
});

test('a failing step stops the run and is reported with its name, its status and the end of its output', (t) => {
  const { root, files } = repository(t);
  const steps = [
    step('first', "console.log('built fine')"),
    step('second', "console.error('Could not resolve ~/data/home.mjs'); process.exit(3)"),
    step('third', 'process.exit(0)'),
  ];
  const result = checkExport({ root, files, steps });
  assert.deepEqual(
    result.steps.map(({ name }) => name),
    ['first', 'second']
  );
  assert.equal(result.findings.length, 1);
  const [finding] = result.findings;
  assert.equal(finding.rule, 'step-failed');
  assert.equal(finding.where, 'second');
  assert.match(finding.detail, /exit 3/);
  assert.ok(finding.output.some((line) => line.includes('Could not resolve ~/data/home.mjs')));
});

test('an export the exporter refuses runs no step and carries the refusal', (t) => {
  const { root, files } = repository(t, { extra: { 'mystery.bin': 'x' } });
  const result = checkExport({ root, files, steps: [step('never', 'process.exit(9)')] });
  assert.deepEqual(result.steps, []);
  assert.equal(result.findings[0].rule, 'export-refused');
  assert.match(result.findings[0].detail, /unclassified mystery\.bin/);
});

test('a source without installed dependencies is reported and nothing is built', (t) => {
  const root = scratch(t);
  const files = writeScene(root);
  const result = checkExport({ root, files, steps: [step('never', 'process.exit(9)')] });
  assert.deepEqual(result.steps, []);
  assert.equal(result.findings[0].rule, 'dependencies-missing');
  assert.match(result.findings[0].detail, /npm ci/);
});

const gitRepository = (t) => {
  const { root } = repository(t);
  gitAt(root, 'init', '--quiet', '--initial-branch=main');
  gitAt(root, 'add', '-A');
  return root;
};

const capture = () => {
  const lines = { out: [], err: [] };
  return { lines, io: { out: (line) => lines.out.push(line), err: (line) => lines.err.push(line) } };
};

test('the command exits 0 and says how long the copy took to build', (t) => {
  const root = gitRepository(t);
  const { lines, io } = capture();
  assert.equal(main(['--root', root], io, [step('ok', 'process.exit(0)')]), 0);
  assert.match(lines.out.join('\n'), /export check: the exported copy built in [0-9.]+s \(ok [0-9.]+s\)/);
  assert.deepEqual(lines.err, []);
});

test('the command prints one line per finding with the end of the output under it and exits 1', (t) => {
  const root = gitRepository(t);
  const { lines, io } = capture();
  assert.equal(main(['--root', root], io, [step('astro build', "console.error('no such file'); process.exit(1)")]), 1);
  const text = lines.err.join('\n');
  assert.match(text, /EXPORT step-failed astro build: exit 1/);
  assert.match(text, / {2}no such file/);
});
