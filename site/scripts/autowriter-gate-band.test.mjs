import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

import {
  ELEVEN_WORD_SENTENCE,
  ENTRY_PATH,
  RECORD_PATH,
  asJson,
  entryText,
  bandSceneFiles,
  recordWith,
} from './fixtures/record-rules-scene.mjs';
import { SCENE_CORE } from './fixtures/semantic-core-scene.mjs';
import { plantSpendReport } from './fixtures/spend-report-plant.mjs';
import { siteBrand } from './site-brand.mjs';

const SITE = resolve(import.meta.dirname, '..');
const REPO = resolve(SITE, '..');
const BAND_PATH = 'audits/sentence-band.json';
const sceneBand = () => JSON.parse(bandSceneFiles()[BAND_PATH]);

function inTempRepo(plant, check) {
  const root = mkdtempSync(join(tmpdir(), 'autowriter-gate-band-'));
  try {
    for (const [path, text] of Object.entries({
      'site/src/config.yaml': `site:\n  name: ${siteBrand().name}\n`,
      'docs/SEMANTIC-CORE.md': SCENE_CORE,
      '.github/workflows/ci.yml': readFileSync(join(REPO, '.github/workflows/ci.yml'), 'utf8'),
      ...bandSceneFiles(),
      ...plant,
    })) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    plantSpendReport(root);
    return check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const gate = (root) =>
  spawnSync(process.execPath, ['scripts/autowriter-gate.mjs', root], { cwd: SITE, encoding: 'utf8' });

const lineStarting = (run, prefix) => run.stderr.split('\n').find((line) => line.startsWith(prefix));

test('a committed entry of eleven-word sentences fails the gate, naming the record and the band it left', () => {
  const entry = entryText({ sentences: Array(10).fill(ELEVEN_WORD_SENTENCE) });
  const record = recordWith({ band: sceneBand(), claimTable: [], entry });
  inTempRepo({ [RECORD_PATH]: asJson(record), [ENTRY_PATH]: entry }, (root) => {
    const run = gate(root);
    assert.equal(run.status, 1);
    assert.match(
      lineStarting(run, `AUTOWRITER below-threshold-share ${RECORD_PATH}: `),
      /zz-specimen\.md: 10 of 10 sentences \(100%\) are under 12 words; the band allows \d+; article band: median/
    );
    assert.match(run.stdout, /, 1 generation records, 0 dispositions, 2 findings$/m);
  });
});

test('a record that widens the band it carries still fails the gate, against the committed band', () => {
  const entry = entryText({ sentences: Array(10).fill(ELEVEN_WORD_SENTENCE) });
  const record = recordWith({ band: sceneBand(), claimTable: [], entry });
  record.band.limits = { ...record.band.limits, belowThresholdCap: 1, justBelowCap: 1 };
  inTempRepo({ [RECORD_PATH]: asJson(record), [ENTRY_PATH]: entry }, (root) => {
    const run = gate(root);
    assert.equal(run.status, 1);
    assert.ok(lineStarting(run, `AUTOWRITER below-threshold-share ${RECORD_PATH}: `), run.stderr);
    assert.match(run.stdout, /, 1 generation records, 0 dispositions, 2 findings$/m);
  });
});

test('a band record that no longer matches the corpus fails the gate even when every record is inside it', () => {
  const stale = sceneBand();
  stale.corpus.article.entries += 1;
  const planted = { [RECORD_PATH]: asJson(recordWith({ band: sceneBand() })), [ENTRY_PATH]: entryText() };
  inTempRepo({ ...planted, [BAND_PATH]: asJson(stale) }, (root) => {
    const run = gate(root);
    assert.equal(run.status, 1);
    assert.match(
      lineStarting(run, `AUTOWRITER record-corpus-stale ${BAND_PATH}: `),
      /the record measured \d+ article entries/
    );
  });
});

test('a band record whose distribution no longer matches the corpus fails the gate, naming the file and the rule', () => {
  const stale = sceneBand();
  stale.distribution.article.pooled.shareBelowThreshold += 0.01;
  const planted = { [RECORD_PATH]: asJson(recordWith({ band: sceneBand() })), [ENTRY_PATH]: entryText() };
  inTempRepo({ ...planted, [BAND_PATH]: asJson(stale) }, (root) => {
    const run = gate(root);
    assert.equal(run.status, 1);
    assert.match(
      lineStarting(run, `AUTOWRITER record-distribution-stale ${BAND_PATH}: `),
      /the recorded distribution differs from a fresh measurement of the corpus/
    );
    assert.equal(lineStarting(run, `AUTOWRITER record-corpus-stale ${BAND_PATH}: `), undefined);
  });
});

test('an article planted in the corpus after the band record was written fails the gate on the corpus and on the distribution', () => {
  const late = entryText({ sentences: Array(9).fill(`${Array(20).fill('word').join(' ')}.`) });
  const planted = {
    [RECORD_PATH]: asJson(recordWith({ band: sceneBand() })),
    [ENTRY_PATH]: entryText(),
    'site/src/data/post/zz-late-entry.md': late,
  };
  inTempRepo(planted, (root) => {
    const run = gate(root);
    assert.equal(run.status, 1);
    assert.match(
      lineStarting(run, `AUTOWRITER record-corpus-stale ${BAND_PATH}: `),
      /the record measured 2 article entries with 29 sentences.*the corpus now has 3 article entries with 38 sentences/
    );
    assert.ok(lineStarting(run, `AUTOWRITER record-distribution-stale ${BAND_PATH}: `), run.stderr);
  });
});

test('a record beside a missing band record is unjudged, never passed', () =>
  inTempRepo({ [RECORD_PATH]: asJson(recordWith({ band: sceneBand() })), [ENTRY_PATH]: entryText() }, (root) => {
    rmSync(join(root, BAND_PATH));
    const run = gate(root);
    assert.equal(run.status, 1);
    assert.ok(lineStarting(run, `AUTOWRITER record-missing ${BAND_PATH}: `), run.stderr);
    assert.match(
      lineStarting(run, `AUTOWRITER generation-band-unjudged ${RECORD_PATH}: `),
      /zz-specimen\.md cannot be judged: audits\/sentence-band\.json does not exist/
    );
  }));

test('a record that carries no band is refused as a schema finding, so a missing measurement is not a pass', () => {
  const { band, ...record } = recordWith({ band: sceneBand() });
  assert.ok(band);
  inTempRepo({ [RECORD_PATH]: asJson(record), [ENTRY_PATH]: entryText() }, (root) => {
    const run = gate(root);
    assert.equal(run.status, 1);
    assert.equal(lineStarting(run, 'AUTOWRITER '), `AUTOWRITER generation-schema ${RECORD_PATH}: band is required`);
  });
});
