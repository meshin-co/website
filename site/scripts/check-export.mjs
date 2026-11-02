import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { exportEngine } from './export-engine.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { trackedFiles } from './run-partition-gate.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
const OUTPUT_LINES = 15;
const DEFAULT_IO = { out: (line) => console.log(line), err: (line) => console.error(line) };

export const BUILD_STEPS = [
  { name: 'assets:logo', command: 'npm', args: ['run', 'assets:logo'] },
  { name: 'assets:og-default', command: 'npm', args: ['run', 'assets:og-default'] },
  { name: 'astro build', command: 'npx', args: ['astro', 'build'] },
];

const lastLines = (text) =>
  text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .slice(-OUTPUT_LINES);

function runStep({ command, args }, cwd) {
  const { status, stdout, stderr, error } = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  return { status, error, output: lastLines(`${stdout}\n${stderr}`) };
}

function buildCopy({ root, files, steps, target }) {
  const dependencies = join(root, 'site', 'node_modules');
  if (!existsSync(dependencies)) {
    const detail = 'run npm ci in site/ first; the copy borrows the dependencies of the source tree';
    return { findings: [{ rule: 'dependencies-missing', where: 'site/node_modules', detail }], steps: [] };
  }
  const { refusals } = exportEngine({ root, target, files });
  if (refusals.length > 0) {
    return { findings: refusals.map((detail) => ({ rule: 'export-refused', where: root, detail })), steps: [] };
  }
  symlinkSync(dependencies, join(target, 'site', 'node_modules'), 'dir');

  const ran = [];
  for (const step of steps) {
    const started = performance.now();
    const { status, error, output } = runStep(step, join(target, 'site'));
    ran.push({ name: step.name, seconds: (performance.now() - started) / 1000 });
    if (status !== 0) {
      const detail = `exit ${status ?? error?.message ?? 'by signal'}`;
      return { findings: [{ rule: 'step-failed', where: step.name, detail, output }], steps: ran };
    }
  }
  return { findings: [], steps: ran };
}

export function checkExport({ root, files = trackedFiles(root), steps = BUILD_STEPS, keep = false }) {
  const workspace = mkdtempSync(join(tmpdir(), 'export-check-'));
  const target = join(workspace, 'copy');
  try {
    return { target, ...buildCopy({ root, files, steps, target }) };
  } finally {
    if (!keep) rmSync(workspace, { recursive: true, force: true });
  }
}

function options(argv) {
  const { values } = parseArgs({
    args: argv,
    options: { root: { type: 'string' }, keep: { type: 'boolean' } },
    strict: true,
  });
  return { root: values.root === undefined ? REPOSITORY_ROOT : resolve(values.root), keep: values.keep === true };
}

export function main(argv, io = DEFAULT_IO, steps = BUILD_STEPS) {
  let parsed;
  try {
    parsed = options(argv);
  } catch (error) {
    io.err(`export check: ${error.message}\nusage: node scripts/check-export.mjs [--root <repository>] [--keep]`);
    return 2;
  }
  const result = checkExport({ ...parsed, steps });
  if (result.findings.length > 0) {
    for (const { rule, where, detail, output = [] } of result.findings) {
      io.err(`EXPORT ${rule} ${where}: ${detail}`);
      for (const line of output) io.err(`  ${line}`);
    }
    if (parsed.keep) io.err(`export check: the copy was kept at ${result.target}`);
    return 1;
  }
  const total = result.steps.reduce((sum, { seconds }) => sum + seconds, 0);
  const timings = result.steps.map(({ name, seconds }) => `${name} ${seconds.toFixed(1)}s`).join(', ');
  io.out(`export check: the exported copy built in ${total.toFixed(1)}s (${timings})`);
  return 0;
}

if (invokedDirectly(import.meta.filename, process.argv[1])) process.exitCode = main(process.argv.slice(2));
