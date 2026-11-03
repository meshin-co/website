import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

import { autowriterReport } from './autowriter-gate.mjs';
import { LENGTH_FILE, REMEASURE_COMMAND } from './entry-length.mjs';
import {
  RECORD_PATH,
  SENTENCES,
  asJson,
  bandSceneFiles,
  entryText,
  recordWith,
} from './fixtures/record-rules-scene.mjs';
import { GENERATED_AT } from './fixtures/spend-report-corpus.mjs';
import { spendReportFile } from './spend-report.mjs';

const SITE = resolve(import.meta.dirname, '..');
const REPO = resolve(SITE, '..');
const ENTRY = 'site/src/data/post/zz-specimen.md';
const sceneLength = () => JSON.parse(bandSceneFiles()[LENGTH_FILE]);

const longEntry = () => {
  const [fact, answer, ...filler] = SENTENCES;
  const section = (number) => ['## Question ' + number + '?', ...filler, ...filler, ...filler];
  return entryText({ sentences: [fact, answer, ...[1, 2, 3, 4].flatMap(section)] });
};

const scene = (entry) => ({
  [RECORD_PATH]: asJson(recordWith({ path: ENTRY, entry })),
  [ENTRY]: entry,
});

function inTempRepo(plant, check) {
  const root = mkdtempSync(join(tmpdir(), 'autowriter-gate-length-'));
  try {
    for (const [path, text] of Object.entries({
      'site/src/config.yaml': 'site:\n  name: meshin.co\n',
      'docs/SEMANTIC-CORE.md': readFileSync(join(REPO, 'docs/SEMANTIC-CORE.md'), 'utf8'),
      '.github/workflows/ci.yml': readFileSync(join(REPO, '.github/workflows/ci.yml'), 'utf8'),
      ...bandSceneFiles(),
      ...plant,
    })) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    const report = spendReportFile({ repoRoot: root, revision: 'abc1234', at: GENERATED_AT });
    mkdirSync(dirname(join(root, report.path)), { recursive: true });
    writeFileSync(join(root, report.path), report.text);
    return check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const gate = (root) =>
  spawnSync(process.execPath, ['scripts/autowriter-gate.mjs', root], { cwd: SITE, encoding: 'utf8' });

const linesStarting = (run, prefix) => run.stderr.split('\n').filter((line) => line.startsWith(prefix));

test('the findings of the length record are part of the report, after the others', () => {
  const planted = { rule: 'length-record-missing', path: LENGTH_FILE, detail: 'x' };
  const report = autowriterReport({
    ledgers: [],
    claims: [],
    core: null,
    workflow: null,
    suffix: ' — x',
    now: new Date('2026-11-02T07:00:00.000Z'),
    lengthRecord: [planted],
  });
  assert.deepEqual(report.findings.at(-1), planted);
});

test('a generated entry of the length of the corpus passes the gate with its record', () =>
  inTempRepo(scene(longEntry()), (root) => {
    const run = gate(root);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /, 1 generation records, 0 dispositions, 0 findings$/m);
  }));

test('a generated entry shorter than the shortest the owner wrote fails the gate, naming the entry and the floor', () =>
  inTempRepo(scene(entryText()), (root) => {
    const run = gate(root);
    assert.equal(run.status, 1);
    const floor = sceneLength().limits.article.wordsFloor;
    const [short] = linesStarting(run, 'AUTOWRITER body-too-short ' + ENTRY + ': ');
    assert.match(short, new RegExp('no hand-written article has fewer than ' + floor));
    assert.equal(linesStarting(run, 'AUTOWRITER too-few-sections ' + ENTRY + ': ').length, 1, run.stderr);
  }));

test('a length record that no longer matches the entries a person wrote fails the gate, naming the file', () => {
  const stale = sceneLength();
  stale.limits.article.wordsFloor = 1;
  inTempRepo({ ...scene(longEntry()), [LENGTH_FILE]: asJson(stale) }, (root) => {
    const run = gate(root);
    assert.equal(run.status, 1);
    const [line] = linesStarting(run, 'AUTOWRITER length-record-limits-stale ' + LENGTH_FILE + ': ');
    assert.ok(line.endsWith('(re-measure with: ' + REMEASURE_COMMAND + ')'), line);
  });
});

test('a record measured with the pipeline entry counted in it fails the gate, so the pipeline cannot lower the floor', () => {
  const fed = sceneLength();
  fed.corpus.article.entries += 1;
  fed.limits.article.wordsFloor = 100;
  inTempRepo({ ...scene(longEntry()), [LENGTH_FILE]: asJson(fed) }, (root) => {
    const run = gate(root);
    assert.equal(run.status, 1);
    assert.equal(
      linesStarting(run, 'AUTOWRITER length-record-corpus-stale ' + LENGTH_FILE + ': ').length,
      1,
      run.stderr
    );
    assert.equal(
      linesStarting(run, 'AUTOWRITER length-record-limits-stale ' + LENGTH_FILE + ': ').length,
      1,
      run.stderr
    );
  });
});

test('a missing length record is a finding and is never read as a pass', () =>
  inTempRepo(scene(longEntry()), (root) => {
    rmSync(join(root, LENGTH_FILE));
    const run = gate(root);
    assert.equal(run.status, 1);
    assert.equal(linesStarting(run, 'AUTOWRITER length-record-missing ' + LENGTH_FILE + ': ').length, 1, run.stderr);
  }));
