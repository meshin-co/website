import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
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
  summaryLine,
  tasksFindings,
  vacuityFindings,
} from './spec-gate.mjs';

const repo = resolve(process.argv[2] ?? '..');
const root = join(repo, 'openspec');
const cli = join(repo, 'site', 'node_modules', '.bin', 'openspec');
const env = { ...process.env, OPENSPEC_TELEMETRY: '0', OPENSPEC_NO_UPDATE_CHECK: '1' };

const git = (args, fallback = '') => {
  try {
    return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    return fallback;
  }
};

const directories = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    : [];

const walkSpecs = (dir, prefix = '') => {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...walkSpecs(join(dir, entry.name), relative));
    else if (entry.name === 'spec.md') found.push(prefix);
  }
  return found;
};

const readSpecs = () => {
  const specsRoot = join(root, 'specs');
  if (!existsSync(specsRoot)) return [];
  return walkSpecs(specsRoot)
    .filter(Boolean)
    .map((capability) => ({
      capability,
      ...parseSpec(readFileSync(join(specsRoot, capability, 'spec.md'), 'utf8')),
    }));
};

const sidecar = (dir) => {
  const file = join(dir, '.openspec.yaml');
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const blocked = text.match(/^blocked:\s*(.+)$/m);
  const risk = text.match(/\bR\d{1,3}\b/);
  return {
    skipSpecs: /^skip_specs:\s*true\s*$/m.test(text),
    blocked: blocked ? blocked[1].trim() : '',
    risk: risk ? risk[0] : '',
  };
};

const taskState = (dir) => {
  const file = join(dir, 'tasks.md');
  if (!existsSync(file)) return { hasTasks: false, ticked: 0, calibration: false };
  const text = readFileSync(file, 'utf8');
  return {
    hasTasks: true,
    ticked: (text.match(/^- \[x\]/gim) ?? []).length,
    calibration: /^##\s+\d+\.\s+Calibration Gate\s*$/im.test(text),
  };
};

const changeModel = (dir, name, archived) => ({ name, archived, ...sidecar(dir), ...taskState(dir) });

const changed = changedFiles({ git, range: process.env.SPEC_GATE_RANGE });

const validate = (args) => {
  try {
    return JSON.parse(execFileSync(cli, args, { cwd: repo, encoding: 'utf8', env, stdio: ['pipe', 'pipe', 'pipe'] }));
  } catch (error) {
    const out = error.stdout?.toString() ?? '';
    if (out.trim().startsWith('{')) return JSON.parse(out);
    throw error;
  }
};

const lockedRows = () => {
  const file = join(repo, 'docs/plan/reference/locked-decisions.md');
  if (!existsSync(file)) return new Set();
  return new Set(
    (readFileSync(file, 'utf8').match(/^\|\s*(L\d{1,3})\s*\|/gm) ?? []).map((row) => row.match(/L\d{1,3}/)[0])
  );
};

const specs = readSpecs();
const activeNames = directories(join(root, 'changes')).filter((name) => name !== 'archive');
const archivedNames = directories(join(root, 'changes', 'archive'));
const active = activeNames.map((name) => changeModel(join(root, 'changes', name), name, false));
const archived = archivedNames.map((name) => changeModel(join(root, 'changes', 'archive', name), name, true));

const all = validate(['validate', '--all', '--strict', '--json']);
const archivedReport = validate(['validate', '--archived', '--json']);
const cliSpecs = all.items.filter((item) => item.type === 'spec').length;

const invalid = [...all.items, ...archivedReport.items]
  .filter((item) => item.valid === false)
  .map((item) => `validate ${item.type} ${item.id}: ${(item.issues ?? []).map((issue) => issue.message).join('; ')}`);

const censusFile = join(root, 'CENSUS.json');
const committedCensus = existsSync(censusFile) ? JSON.parse(readFileSync(censusFile, 'utf8')) : null;
const indexFile = join(root, 'INDEX.md');
const committedIndex = existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : '';

const findings = [
  ...invalid,
  ...vacuityFindings({ cliSpecs, walkedSpecs: specs.length, items: all.items.length + archivedReport.items.length }),
  ...(committedCensus
    ? censusFindings(committedCensus, censusFromSpecs(specs))
    : ['census-missing-file: openspec/CENSUS.json is not committed']),
  ...(committedIndex === indexFromSpecs(specs) ? [] : ['index-drift: openspec/INDEX.md differs from a regeneration']),
  ...changeNameFindings(activeNames, archivedNames),
  ...tasksFindings(active),
  ...skipSpecsFindings([...active, ...archived]),
  ...singleActiveFindings(active),
  ...calibrationFindings({ changed, changes: active }),
  ...lockedRowFindings(specs, lockedRows()),
];

for (const finding of findings) console.log(finding);
console.log('');
console.log(
  summaryLine({
    specs: specs.length,
    requirements: specs.reduce((total, spec) => total + spec.requirements.length, 0),
    active: active.length,
    archived: archived.length,
    calibration: `${changed.length} files in range`,
    findings: findings.length,
  })
);

process.exit(findings.length === 0 ? 0 : 1);
