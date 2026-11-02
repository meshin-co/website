import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

import { autowriterReport, summaryLine } from './autowriter-gate.mjs';
import { BOT, HUMAN, commitAs, initRepo, removeRepos, shallowClone } from './fixtures/history-repo.mjs';
import {
  ENTRY_PATH,
  RECORD_PATH,
  asJson,
  entryText,
  realBandFiles,
  recordWith,
} from './fixtures/record-rules-scene.mjs';

const SITE = resolve(import.meta.dirname, '..');
const REPO = resolve(SITE, '..');
const BAND_PATH = 'audits/sentence-band.json';
const SKIPPED = 'autowriter: history rules skipped: ';
const NOTHING_READ = { ledgers: 0, claims: 0, lapsed: 0, titles: 0, jobs: 0, records: 0, dispositions: 0 };

test('the summary line says how many pipeline commits were judged, and that none were when the history was skipped', () => {
  assert.match(
    summaryLine({ findings: [], counts: { ...NOTHING_READ, commits: 12 } }),
    /CI jobs under the aggregate check, 12 pipeline commits judged, 0 generation records, 0 dispositions, 0 findings$/
  );
  assert.match(
    summaryLine({ findings: [], counts: { ...NOTHING_READ, commits: 0 } }),
    /, 0 pipeline commits judged, 0 generation records, 0 dispositions, 0 findings$/
  );
  for (const commits of [null, undefined])
    assert.match(
      summaryLine({ findings: [], counts: { ...NOTHING_READ, commits } }),
      /, pipeline commits not judged, 0 generation records, 0 dispositions, 0 findings$/
    );
});

const inputs = () => ({
  ledgers: [],
  claims: [],
  core: readFileSync(join(REPO, 'docs/SEMANTIC-CORE.md'), 'utf8'),
  workflow: readFileSync(join(REPO, '.github/workflows/ci.yml'), 'utf8'),
  suffix: ' — meshin.co',
  now: new Date('2026-11-02T07:00:00.000Z'),
});

test('the history the report is given adds its findings and its commit count, and without one nothing was judged', () => {
  const found = [{ rule: 'refused-path-committed', path: RECORD_PATH, detail: 'touched x' }];
  const judged = autowriterReport({ ...inputs(), history: { findings: found, commits: 3 } });
  assert.deepEqual(judged.findings, found);
  assert.equal(judged.counts.commits, 3);
  const unjudged = autowriterReport(inputs());
  assert.deepEqual(unjudged.findings, []);
  assert.equal(unjudged.counts.commits, null);
});

function inTempRepo(check) {
  const root = mkdtempSync(join(tmpdir(), 'autowriter-gate-history-'));
  try {
    for (const [path, text] of Object.entries({
      'site/src/config.yaml': 'site:\n  name: meshin.co\n',
      'docs/SEMANTIC-CORE.md': inputs().core,
      '.github/workflows/ci.yml': inputs().workflow,
      ...realBandFiles(),
    })) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    return check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function inTempHistory(check) {
  return inTempRepo((root) => {
    initRepo(root);
    commitAs(root, HUMAN, { message: 'chore(fixture): start' });
    return check(root);
  });
}

const gateFrom = (cwd, root, env = process.env) =>
  spawnSync(process.execPath, [join(SITE, 'scripts/autowriter-gate.mjs'), root], { cwd, encoding: 'utf8', env });
const gate = (root) => gateFrom(SITE, root);
const skippedLines = (run) => run.stdout.split('\n').filter((line) => line.startsWith(SKIPPED));

const pipelineWrites = (root, extra = {}) => {
  const band = JSON.parse(realBandFiles()[BAND_PATH]);
  const write = { [RECORD_PATH]: asJson(recordWith({ band })), [ENTRY_PATH]: entryText(), ...extra };
  const message = `feat(autowriter): write zz-specimen\n\nProvenance: ${RECORD_PATH}`;
  return commitAs(root, BOT, { write, message });
};

function bandMovedByThePipeline(root) {
  const band = readFileSync(join(root, BAND_PATH), 'utf8');
  const sha = pipelineWrites(root, { [BAND_PATH]: '{}\n' });
  commitAs(root, HUMAN, { write: { [BAND_PATH]: band }, message: 'chore(fixture): put the band back' });
  return sha;
}

test('a directory that is not a git repository is not judged, and the command says so once on stdout', () =>
  inTempRepo((root) => {
    const run = gate(root);
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(skippedLines(run), [`${SKIPPED}${root} is not a git repository`]);
    assert.match(run.stdout, /, pipeline commits not judged, 0 generation records, 0 dispositions, 0 findings$/m);
    assert.equal(run.stderr, '');
  }));

test('the command exits 1 and names the record, the band and the commit when a pipeline commit moved the band', () =>
  inTempHistory((root) => {
    const sha = bandMovedByThePipeline(root);
    const run = gate(root);
    assert.equal(run.status, 1, run.stdout);
    const lines = run.stderr.trim().split('\n');
    assert.equal(lines.length, 1, run.stderr);
    const refused = `AUTOWRITER refused-path-committed ${RECORD_PATH}: touched ${BAND_PATH} (sentence-band: `;
    assert.ok(lines[0].startsWith(refused), lines[0]);
    assert.ok(lines[0].endsWith(`, in commit ${sha.slice(0, 12)}`), lines[0]);
    assert.match(run.stdout, /, 1 pipeline commits judged, 1 generation records, 0 dispositions, 1 findings$/m);
    assert.deepEqual(skippedLines(run), []);
  }));

test('the command exits 0 and prints how many pipeline commits it judged when none touched what is refused', () =>
  inTempHistory((root) => {
    pipelineWrites(root);
    const run = gate(root);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /, 1 pipeline commits judged, 1 generation records, 0 dispositions, 0 findings$/m);
    assert.equal(run.stderr, '');
  }));

test('a shallow clone is not judged: the command says so once, passes, and counts no commits', () =>
  inTempHistory((root) => {
    bandMovedByThePipeline(root);
    const clone = shallowClone(root);
    try {
      const run = gate(clone);
      assert.equal(run.status, 0, run.stderr);
      assert.deepEqual(skippedLines(run), [`${SKIPPED}the clone is shallow`]);
      assert.match(run.stdout, /, pipeline commits not judged, 1 generation records, 0 dispositions, 0 findings$/m);
    } finally {
      removeRepos(clone);
    }
  }));

test('a GIT_DIR in the environment does not move the repository the command reads', () =>
  inTempHistory((root) => {
    bandMovedByThePipeline(root);
    const run = gateFrom(SITE, root, { ...process.env, GIT_DIR: join(REPO, '.git') });
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /^AUTOWRITER refused-path-committed /m);
  }));
