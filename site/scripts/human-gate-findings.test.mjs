import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, test } from 'node:test';

import { parseGateFindings, recordGateFindings } from './gate-findings.mjs';
import { humanRecords } from './gate-records.mjs';
import { humanFindings, runGate } from './human-gate.mjs';
import { knownRule, listRows } from './repair-kinds.mjs';

const GATE = 'gate:human';
const FILE = 'gate-human.json';
const RUNNER = join(import.meta.dirname, 'run-human-gate.mjs');
const SITE = resolve(import.meta.dirname, '..');
const REPOSITORY_ROOT = resolve(SITE, '..');
const CONTROLLED = JSON.parse(readFileSync(join(SITE, 'controlled-words.json'), 'utf8'));

const PLAIN = [
  'The register lists every AI system the company runs.',
  'Each row names an owner and a risk tier.',
  'Someone reviews the tiers every quarter and writes the review date next to each row.',
  'A first version takes a week.',
].join(' ');
const PASSIVE = 'The plan was written by the team.';
const ACTIVE = 'The coach sets the goals each week.';
const COMMENCE = 'You can commence the task now.';

const document = (main) => `<!doctype html><html><head><title>x</title></head><body><main>${main}</main></body></html>`;
const withText = (text) => ({ text, paragraphs: [text] });
const repeated = (sentence, count) => Array.from({ length: count }, () => sentence).join(' ');
const equal = (count, words) => Array.from({ length: count }, () => words);

const pageOf = (lengths, { two = 0, three = 0 } = {}) => {
  const total = lengths.reduce((sum, count) => sum + count, 0);
  const words = [
    ...Array(three).fill('important'),
    ...Array(two).fill('garden'),
    ...Array(total - three - two).fill('plan'),
  ];
  return lengths.map((count) => `${words.splice(0, count).join(' ')}.`).join(' ');
};

const writeTree = (directory, files) => {
  mkdirSync(directory, { recursive: true });
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(directory, name)), { recursive: true });
    writeFileSync(join(directory, name), text);
  }
};

async function findingsOfTree(files) {
  const dist = mkdtempSync(join(tmpdir(), 'human-findings-tree-'));
  try {
    writeTree(dist, files);
    return (await runGate(dist)).findings;
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
}

const onPage = (overrides) => ({
  found: () => humanFindings({ route: '/specimen', ...overrides }, CONTROLLED),
  subjects: ['/specimen'],
});
const onTree = (files) => ({ found: () => findingsOfTree(files), subjects: [] });

const PLANTED = {
  'reading-grade': onPage(withText(pageOf(equal(6, 20), { two: 87 }))),
  'reading-ease': onPage(withText(pageOf(equal(6, 12), { two: 64 }))),
  'sentence-average': onPage(withText(pageOf([...equal(4, 21), 22]))),
  'sentence-longest': onPage(withText(pageOf([...equal(4, 5), 41]))),
  'long-sentences': onPage(withText(pageOf([26, 26, 5]))),
  'long-word-share': onPage(withText(pageOf(equal(6, 20), { three: 31 }))),
  'passive-voice': onPage(withText(`${repeated(PASSIVE, 3)} ${repeated(ACTIVE, 2)}`)),
  'sentence-variance': onPage(withText(pageOf([2, 2, 2, 5, 6, 6, 8, 8]))),
  'paragraph-variance': onPage({ paragraphs: [4, 10, 16].map((count) => pageOf([count])) }),
  'list-variety': onPage({ lists: [3, 3, 3] }),
  'heading-variety': onPage({ headings: ['How to start', 'How to keep going', 'How to stop'] }),
  'antithesis-template': onPage({ text: `${PLAIN} This is not a plan, it is a way of living.` }),
  'bolded-lead': onPage({ html: '<ul><li><strong>Governance:</strong> the owner signs it off.</li></ul>' }),
  'emoji-bullet': onPage({ html: '<ul><li>✅ Done and signed off.</li></ul>' }),
  'controlled-word': onPage({ text: `${PLAIN} ${COMMENCE}` }),
  'no-pages': onTree({}),
  'nothing-measured': onTree({ 'a.html': document('<p>One short line.</p>') }),
};

for (const [rule, { found, subjects }] of Object.entries(PLANTED)) {
  test(`${rule} is emitted by the gate, recorded against ${subjects.join() || 'no subject'}, and known`, async () => {
    const records = humanRecords(await found());
    const emitted = records.map((record) => record.rule).join(', ') || 'nothing';

    const hit = records.find((record) => record.rule === rule);

    assert.ok(hit, `${GATE} emitted ${emitted}, never ${rule}`);
    assert.deepEqual(hit.subjects, subjects);
    assert.equal(knownRule({ gate: GATE, rule }), true, `${GATE} ${rule} is not a row of the repair table`);
  });
}

test('the gate source holds no rule id without a planted test above', () => {
  const source = readFileSync(join(import.meta.dirname, 'human-gate.mjs'), 'utf8');
  const emitted = [...new Set([...source.matchAll(/\brule: '([a-z0-9-]+)'/g)].map((match) => match[1]))];

  assert.equal(emitted.length, 17);
  assert.deepEqual(emitted.sort(), Object.keys(PLANTED).sort());
});

test('the repair table holds a row for every rule planted above and for no other rule of this gate', () => {
  const rules = listRows()
    .filter((row) => row.gate === GATE)
    .map((row) => row.rule);

  assert.deepEqual(rules.sort(), Object.keys(PLANTED).sort());
});

test('every record the gate can emit is accepted by the strict findings schema and parses back', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'human-findings-write-'));
  try {
    const planted = await Promise.all(Object.values(PLANTED).map(({ found }) => found()));
    const findings = planted.flatMap((native) => humanRecords(native));

    recordGateFindings({ gate: GATE, findings, env: { GATE_FINDINGS_DIR: directory } });

    const written = parseGateFindings(readFileSync(join(directory, FILE), 'utf8'));
    assert.ok(findings.length >= Object.keys(PLANTED).length);
    assert.deepEqual(written.findings, findings);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const scene = (files) => {
  const root = mkdtempSync(join(tmpdir(), 'human-findings-'));
  roots.push(root);
  writeTree(join(root, 'dist'), files);
  return { root, dist: join(root, 'dist'), findingsDir: join(root, 'findings') };
};

const run = ({ root, dist }, { findingsDir, cwd = root } = {}) => {
  const env = { ...process.env };
  delete env.GATE_FINDINGS_DIR;
  if (findingsDir !== undefined) env.GATE_FINDINGS_DIR = findingsDir;
  return spawnSync(process.execPath, [RUNNER, dist], { cwd, env, encoding: 'utf8' });
};

const recordedText = (findingsDir) => {
  const file = join(findingsDir, FILE);
  assert.ok(existsSync(file), `the runner wrote no ${FILE}`);
  return readFileSync(file, 'utf8');
};
const recorded = (findingsDir) => parseGateFindings(recordedText(findingsDir));

const FLAWED = {
  'a.html': document(`<p>${PLAIN}</p>`),
  'b.html': document(`<p>${PLAIN}</p><p>${COMMENCE}</p>`),
  '404.html': document(`<p>${PLAIN}</p><p>${COMMENCE}</p>`),
};
const COMMENCE_FINDING = [{ rule: 'controlled-word', subjects: ['/b'], detail: 'commence → start', excerpt: '' }];

test('the runner records each finding under its route, and every rule it records is known', () => {
  const found = scene(FLAWED);

  const result = run(found, { findingsDir: found.findingsDir });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /^human: 2 pages checked, 2 measured for reading level, 1 findings$/m);
  assert.match(result.stdout, /^HUMAN \/b controlled-word: commence → start$/m);
  const { gate, findings } = recorded(found.findingsDir);
  assert.equal(gate, GATE);
  assert.deepEqual(findings, COMMENCE_FINDING);
  for (const { rule } of findings) assert.equal(knownRule({ gate: GATE, rule }), true, rule);
});

test('a tree with no page is recorded against no subject, though its route is the dist directory', () => {
  const found = scene({});

  const result = run(found, { findingsDir: found.findingsDir });

  assert.equal(result.status, 1);
  assert.deepEqual(recorded(found.findingsDir).findings, [
    { rule: 'no-pages', subjects: [], detail: 'no built page was found, so nothing was checked', excerpt: '' },
  ]);
});

test('a clean tree removes the stale file of this gate, and leaves the file of another gate alone', () => {
  const found = scene({ 'a.html': document(`<p>${PLAIN}</p>`) });
  mkdirSync(found.findingsDir);
  writeFileSync(join(found.findingsDir, FILE), 'stale');
  writeFileSync(join(found.findingsDir, 'gate-content.json'), 'another gate');

  const result = run(found, { findingsDir: found.findingsDir });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^human: 1 pages checked, 1 measured for reading level, 0 findings$/m);
  assert.deepEqual(readdirSync(found.findingsDir), ['gate-content.json']);
});

test('an unset GATE_FINDINGS_DIR writes nothing, in the working directory or anywhere beside the tree', () => {
  const found = scene(FLAWED);

  const result = run(found);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /^HUMAN \/b controlled-word: commence → start$/m);
  assert.deepEqual(readdirSync(found.root), ['dist']);
});

test('a relative GATE_FINDINGS_DIR stops even a clean run, and writes nothing', () => {
  const found = scene({ 'a.html': document(`<p>${PLAIN}</p>`) });

  const result = run(found, { findingsDir: 'findings' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FindingsError: GATE_FINDINGS_DIR must be an absolute path/);
  assert.deepEqual(readdirSync(found.root), ['dist']);
});

test('the runner writes the same file from the repository root as from site', () => {
  const found = scene(FLAWED);
  const [fromRoot, fromSite] = [REPOSITORY_ROOT, SITE].map((cwd, index) => {
    const findingsDir = join(found.root, `findings-${index}`);
    run(found, { findingsDir, cwd });
    return recordedText(findingsDir);
  });

  assert.equal(fromRoot, fromSite);
  assert.deepEqual(parseGateFindings(fromRoot).findings, COMMENCE_FINDING);
});
