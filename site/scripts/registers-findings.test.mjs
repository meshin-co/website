import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, test } from 'node:test';

import { parseGateFindings, recordGateFindings } from './gate-findings.mjs';
import { registerRecords } from './gate-records.mjs';
import { REGISTERS_BEGIN, REGISTERS_END, registerDriftFindings } from './registers.mjs';
import { knownRule, listRows } from './repair-kinds.mjs';

const GATE = 'gate:registers';
const FILE = 'gate-registers.json';
const DOC = 'docs/SEMANTIC-CORE.md';
const RUNNER = join(import.meta.dirname, 'generate-registers.mjs');
const REPAIR_DETAIL = 'run npm run assets:registers and commit the result';

const DRIFTED = `# Semantic core\n\n${REGISTERS_BEGIN}\n\nstale\n\n${REGISTERS_END}\n`;
const UNMARKED = '# Semantic core\n\nNo markers here.\n';

const PLANTED = {
  'registers-markers-missing': { found: () => registerDriftFindings(UNMARKED, 'block'), detail: DOC },
  'registers-drift': { found: () => registerDriftFindings(DRIFTED, 'block'), detail: REPAIR_DETAIL },
};

for (const [rule, { found, detail }] of Object.entries(PLANTED)) {
  test(`${rule} is emitted by the gate, recorded against the document, and known`, () => {
    const records = registerRecords(found());

    assert.deepEqual(records, [{ rule, subjects: [DOC], detail, excerpt: '' }]);
    assert.equal(knownRule({ gate: GATE, rule }), true, `${GATE} ${rule} is not a row of the repair table`);
  });
}

test('the gate source holds no rule id without a planted test above', () => {
  const source = readFileSync(join(import.meta.dirname, 'registers.mjs'), 'utf8');
  const emitted = [...new Set([...source.matchAll(/\brule: '([a-z0-9-]+)'/g)].map((match) => match[1]))];

  assert.equal(emitted.length, 2);
  assert.deepEqual(emitted.sort(), Object.keys(PLANTED).sort());
});

test('the repair table holds a row for every rule planted above and for no other rule of this gate', () => {
  const rules = listRows()
    .filter((row) => row.gate === GATE)
    .map((row) => row.rule);

  assert.deepEqual(rules.sort(), Object.keys(PLANTED).sort());
});

test('every record the gate can emit is accepted by the strict findings schema and parses back', () => {
  const directory = mkdtempSync(join(tmpdir(), 'registers-findings-write-'));
  try {
    const findings = Object.values(PLANTED).flatMap(({ found }) => registerRecords(found()));

    recordGateFindings({ gate: GATE, findings, env: { GATE_FINDINGS_DIR: directory } });

    const written = parseGateFindings(readFileSync(join(directory, FILE), 'utf8'));
    assert.equal(findings.length, 2);
    assert.deepEqual(written.findings, findings);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const page = (heading, sentence) =>
  `<!doctype html><html><body><main><h1>${heading}</h1><p>${sentence}</p></main></body></html>`;

const scene = (doc) => {
  const root = mkdtempSync(join(tmpdir(), 'registers-findings-'));
  roots.push(root);
  const files = {
    [DOC]: doc,
    'site/src/data/glossary/ai-register.md':
      '---\nterm: AI register\nshortDefinition: A list of AI systems.\nrelatedTerms: []\n---\nBody.\n',
    'site/dist/gate-routes.json': JSON.stringify({ routes: ['/', '/glossary/ai-register'] }),
    'site/dist/index.html': page('Home', 'Nothing to define here.'),
    'site/dist/glossary/ai-register.html': page('What is an AI register?', 'It lists systems.'),
  };
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), text);
  }
  return { root, site: join(root, 'site'), findingsDir: join(root, 'findings') };
};

const run = ({ site }, args, findingsDir) => {
  const env = { ...process.env };
  delete env.GATE_FINDINGS_DIR;
  if (findingsDir !== undefined) env.GATE_FINDINGS_DIR = findingsDir;
  return spawnSync(process.execPath, [RUNNER, ...args], { cwd: site, env, encoding: 'utf8' });
};

const check = (found, findingsDir) => run(found, ['--check', 'dist'], findingsDir);

const recorded = (findingsDir) => {
  const file = join(findingsDir, FILE);
  assert.ok(existsSync(file), `the gate wrote no ${FILE}`);
  return parseGateFindings(readFileSync(file, 'utf8'));
};

const cleanScene = () => {
  const found = scene(DRIFTED);
  assert.equal(run(found, ['dist']).status, 0);
  return found;
};

test('a drifted block is recorded against the document, and the lines the gate prints are unchanged', () => {
  const found = scene(DRIFTED);

  const result = check(found, found.findingsDir);

  assert.equal(result.status, 1);
  assert.match(result.stdout, new RegExp(`^registers-drift \\[${REPAIR_DETAIL}\\]$`, 'm'));
  assert.match(result.stdout, /^registers: 1 findings, 0 unlinked concept uses$/m);
  const { gate, findings } = recorded(found.findingsDir);
  assert.equal(gate, GATE);
  assert.deepEqual(findings, [{ rule: 'registers-drift', subjects: [DOC], detail: REPAIR_DETAIL, excerpt: '' }]);
  for (const { rule } of findings) assert.equal(knownRule({ gate: GATE, rule }), true, rule);
});

test('a document without the markers is recorded against the document', () => {
  const found = scene(UNMARKED);

  const result = check(found, found.findingsDir);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /^registers-markers-missing \[docs\/SEMANTIC-CORE\.md\]$/m);
  assert.deepEqual(recorded(found.findingsDir).findings, [
    { rule: 'registers-markers-missing', subjects: [DOC], detail: DOC, excerpt: '' },
  ]);
});

test('a clean check removes the stale file of this gate, and leaves the file of another gate alone', () => {
  const found = cleanScene();
  mkdirSync(found.findingsDir);
  writeFileSync(join(found.findingsDir, FILE), 'stale');
  writeFileSync(join(found.findingsDir, 'gate-human.json'), 'another gate');

  const result = check(found, found.findingsDir);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^registers: 0 findings, 0 unlinked concept uses$/m);
  assert.deepEqual(readdirSync(found.findingsDir), ['gate-human.json']);
});

test('the write mode records nothing, and leaves a findings file exactly as it found it', () => {
  const found = scene(DRIFTED);
  mkdirSync(found.findingsDir);
  writeFileSync(join(found.findingsDir, FILE), 'stale');

  const result = run(found, ['dist'], found.findingsDir);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^registers: 1 entities and concepts -> \.\.\/docs\/SEMANTIC-CORE\.md$/m);
  assert.deepEqual(readdirSync(found.findingsDir), [FILE]);
  assert.equal(readFileSync(join(found.findingsDir, FILE), 'utf8'), 'stale');
});

test('an unset GATE_FINDINGS_DIR writes nothing, in the working directory or anywhere beside the tree', () => {
  const found = scene(DRIFTED);
  const before = readdirSync(found.root, { recursive: true }).sort();

  const result = check(found);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /^registers-drift /m);
  assert.deepEqual(readdirSync(found.root, { recursive: true }).sort(), before);
});

test('a relative GATE_FINDINGS_DIR stops even a clean check, and writes nothing', () => {
  const found = cleanScene();
  const before = readdirSync(found.root, { recursive: true }).sort();

  const result = check(found, 'findings');

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FindingsError: GATE_FINDINGS_DIR must be an absolute path/);
  assert.deepEqual(readdirSync(found.root, { recursive: true }).sort(), before);
});
