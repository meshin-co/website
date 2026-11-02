import './fixtures/no-network.mjs';

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseGateFindings } from './gate-findings.mjs';
import { knownRule } from './repair-kinds.mjs';

const GATE = 'gate:editorial';
const SCRIPT = join(import.meta.dirname, 'editorial-gate.mjs');
const REPOSITORY_ROOT = resolve(import.meta.dirname, '../..');
const CONDITIONAL_FILE = 'audits/phase-4.7/conditional-copy.json';
const RULES = [
  'unreviewed-copy',
  'untraceable-copy',
  'dead-copy',
  'stale-disposition',
  'stale-conditional-declaration',
  'invalid-conditional-declaration',
  'disposition-target-missing',
];

const PAGE =
  '<!doctype html><title>Shipped glossary title here</title><main><h1>Shipped glossary title here</h1>' +
  '<p>Shipped body sentence stays on page.</p>' +
  '<p>This paragraph ships but no source row holds it anywhere.</p></main>';

function scene({ broken }) {
  const root = mkdtempSync(join(tmpdir(), 'editorial-findings-'));
  const site = join(root, 'site');
  const put = (file, text) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  };
  put(join(site, 'dist/gate-routes.json'), JSON.stringify({ routes: broken ? ['/x'] : [] }));
  if (!broken) return { root, site };

  put(join(site, 'dist/x.html'), PAGE);
  put(
    join(site, 'src/data/glossary/shipped.md'),
    '---\ntitle: Shipped glossary title here\n---\nShipped body sentence stays on page.\n'
  );
  put(join(site, 'src/data/glossary/dead.md'), '---\ntitle: Dead glossary copy that nobody ships\n---\n');
  put(
    join(root, CONDITIONAL_FILE),
    JSON.stringify([
      { text: 'Shipped glossary title here', reason: 'only in one state' },
      { text: 'Dead glossary copy that nobody ships' },
    ])
  );
  put(
    join(root, 'audits/phase-4.7/dispositions/a.json'),
    JSON.stringify([
      {
        target: 'src/data/glossary/shipped.md',
        location: 'frontmatter.title',
        status: 'verified',
        reason: 'read it',
        digest: 'deadbeef0000',
      },
      { target: 'src/data/glossary/gone.md', status: 'verified', digest: 'deadbeef0000' },
      { target: '/route-with-no-rows', status: 'verified' },
    ])
  );
  return { root, site };
}

function run(site, { args = ['dist', '--check'], findingsDir, cwd = tmpdir() } = {}) {
  const env = { ...process.env };
  delete env.GATE_FINDINGS_DIR;
  if (findingsDir !== undefined) env.GATE_FINDINGS_DIR = findingsDir;
  return spawnSync('node', [SCRIPT, site, ...args], { encoding: 'utf8', env, cwd });
}

const withScene = (options, body) => {
  const made = scene(options);
  const findingsDir = join(made.root, 'findings');
  try {
    return body({ ...made, findingsDir, file: join(findingsDir, 'gate-editorial.json') });
  } finally {
    rmSync(made.root, { recursive: true, force: true });
  }
};

test('the CLI writes one record per kind and every rule id is known', () =>
  withScene({ broken: true }, ({ site, findingsDir, file }) => {
    const result = run(site, { findingsDir });
    assert.equal(result.status, 1);
    const { gate, findings } = parseGateFindings(readFileSync(file, 'utf8'));
    assert.equal(gate, GATE);
    assert.deepEqual([...new Set(findings.map((finding) => finding.rule))].sort(), [...RULES].sort());
    for (const finding of findings) assert.equal(knownRule({ gate: GATE, rule: finding.rule }), true, finding.rule);

    const of = (rule) => findings.filter((finding) => finding.rule === rule);
    assert.deepEqual(
      of('dead-copy').map((finding) => finding.subjects),
      [['site/src/data/glossary/dead.md']]
    );
    assert.deepEqual(
      of('untraceable-copy').map((finding) => finding.subjects),
      [['/x']]
    );
    assert.deepEqual(
      of('stale-disposition').map((finding) => finding.subjects),
      [['site/src/data/glossary/shipped.md']]
    );
    assert.deepEqual(
      of('stale-conditional-declaration').map((finding) => finding.subjects),
      [[CONDITIONAL_FILE]]
    );
    assert.deepEqual(
      of('invalid-conditional-declaration').map((finding) => finding.subjects),
      [[CONDITIONAL_FILE]]
    );
    assert.deepEqual(
      of('disposition-target-missing').map((finding) => finding.subjects),
      [['site/src/data/glossary/gone.md']]
    );
    assert.ok(of('unreviewed-copy').some((finding) => finding.subjects.includes('site/src/data/glossary/shipped.md')));
    assert.ok(of('unreviewed-copy').some((finding) => finding.subjects.join() === '/x'));
  }));

test('the write mode records the same findings as --check', () =>
  withScene({ broken: true }, ({ site, findingsDir, file }) => {
    const checked = run(site, { findingsDir });
    const first = readFileSync(file, 'utf8');
    rmSync(file);
    const written = run(site, { args: ['dist'], findingsDir });
    assert.equal(checked.stdout, written.stdout);
    assert.equal(readFileSync(file, 'utf8'), first);
  }));

test('the CLI writes the same file from the repository root as from any other directory', () =>
  withScene({ broken: true }, ({ site, findingsDir, file }) => {
    run(site, { findingsDir, cwd: join(REPOSITORY_ROOT, 'site') });
    const fromSite = readFileSync(file, 'utf8');
    rmSync(file);
    run(site, { findingsDir, cwd: REPOSITORY_ROOT });
    assert.equal(readFileSync(file, 'utf8'), fromSite);
  }));

test('an unset GATE_FINDINGS_DIR writes nothing, in the working directory or elsewhere', () =>
  withScene({ broken: true }, ({ root, site }) => {
    const cwd = mkdtempSync(join(tmpdir(), 'editorial-findings-cwd-'));
    try {
      const before = readdirSync(root).sort();
      const result = run(site, { cwd });
      assert.equal(result.status, 1);
      assert.deepEqual(readdirSync(cwd), []);
      assert.deepEqual(readdirSync(root).sort(), before);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }));

test('a clean scene removes a stale findings file and exits 0', () =>
  withScene({ broken: false }, ({ site, findingsDir, file }) => {
    mkdirSync(findingsDir, { recursive: true });
    writeFileSync(file, 'stale');
    const result = run(site, { findingsDir });
    assert.equal(result.status, 0);
    assert.equal(existsSync(file), false);
  }));

test('buildReport returns exactly one record for every string finding', () =>
  withScene({ broken: true }, ({ root, site }) => {
    const helper = join(root, 'probe.mjs');
    writeFileSync(
      helper,
      `import { buildReport } from ${JSON.stringify(pathToFileURL(SCRIPT).href)};
const result = buildReport(process.argv[3]);
console.log(JSON.stringify({ findings: result.findings.length, records: result.records?.length }));
`
    );
    const probe = spawnSync('node', [helper, site, join(site, 'dist')], { encoding: 'utf8' });
    assert.equal(probe.status, 0, probe.stderr);
    const { findings, records } = JSON.parse(probe.stdout);
    assert.ok(findings > 7);
    assert.equal(records, findings);
  }));
