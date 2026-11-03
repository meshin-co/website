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
  proseOf,
  realBandFiles,
  recordWith,
} from './fixtures/record-rules-scene.mjs';
import { bandProblems } from './sentence-band.mjs';

const SITE = resolve(import.meta.dirname, '..');
const REPO = resolve(SITE, '..');
const BAND_PATH = 'audits/sentence-band.json';
const realBand = () => JSON.parse(realBandFiles()[BAND_PATH]);

function inTempRepo(plant, check) {
  const root = mkdtempSync(join(tmpdir(), 'autowriter-gate-band-'));
  try {
    for (const [path, text] of Object.entries({
      'site/src/config.yaml': 'site:\n  name: meshin.co\n',
      'docs/SEMANTIC-CORE.md': readFileSync(join(REPO, 'docs/SEMANTIC-CORE.md'), 'utf8'),
      '.github/workflows/ci.yml': readFileSync(join(REPO, '.github/workflows/ci.yml'), 'utf8'),
      ...realBandFiles(),
      ...plant,
    })) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    return check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const gate = (root) =>
  spawnSync(process.execPath, ['scripts/autowriter-gate.mjs', root], { cwd: SITE, encoding: 'utf8' });

const lineStarting = (run, prefix) => run.stderr.split('\n').find((line) => line.startsWith(prefix));

const bandLeftBy = (entry) => bandProblems({ sentences: proseOf(entry), band: realBand().bands.article });

function assertLeavesTheCommittedBand(run, left) {
  assert.equal(run.status, 1);
  const lines = run.stderr.split('\n');
  for (const { rule, detail } of left)
    assert.ok(lines.includes(`AUTOWRITER ${rule} ${RECORD_PATH}: ${ENTRY_PATH}: ${detail}`), run.stderr);
  assert.match(run.stdout, new RegExp(`, 1 generation records, ${left.length} findings$`, 'm'));
}

test('a committed entry of eleven-word sentences fails the gate, naming the record and the band it left', () => {
  const entry = entryText({ sentences: Array(10).fill(ELEVEN_WORD_SENTENCE) });
  const record = recordWith({ band: realBand(), claimTable: [], entry });
  const left = bandLeftBy(entry);
  assert.ok(left.length > 0, 'the committed band admits an entry made only of eleven-word sentences');
  inTempRepo({ [RECORD_PATH]: asJson(record), [ENTRY_PATH]: entry }, (root) =>
    assertLeavesTheCommittedBand(gate(root), left)
  );
});

test('a record that widens the band it carries still fails the gate, against the committed band', () => {
  const entry = entryText({ sentences: Array(10).fill(ELEVEN_WORD_SENTENCE) });
  const record = recordWith({ band: realBand(), claimTable: [], entry });
  record.band.limits = { ...record.band.limits, belowThresholdCap: 1, justBelowCap: 1 };
  const left = bandLeftBy(entry);
  inTempRepo({ [RECORD_PATH]: asJson(record), [ENTRY_PATH]: entry }, (root) =>
    assertLeavesTheCommittedBand(gate(root), left)
  );
});

test('a band record that no longer matches the corpus fails the gate even when every record is inside it', () => {
  const stale = realBand();
  stale.corpus.article.entries += 1;
  const planted = { [RECORD_PATH]: asJson(recordWith({ band: realBand() })), [ENTRY_PATH]: entryText() };
  inTempRepo({ ...planted, [BAND_PATH]: asJson(stale) }, (root) => {
    const run = gate(root);
    assert.equal(run.status, 1);
    assert.match(
      lineStarting(run, `AUTOWRITER record-corpus-stale ${BAND_PATH}: `),
      /the record measured \d+ article entries/
    );
  });
});

test('a record beside a missing band record is unjudged, never passed', () =>
  inTempRepo({ [RECORD_PATH]: asJson(recordWith({ band: realBand() })), [ENTRY_PATH]: entryText() }, (root) => {
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
  const { band, ...record } = recordWith({ band: realBand() });
  assert.ok(band);
  inTempRepo({ [RECORD_PATH]: asJson(record), [ENTRY_PATH]: entryText() }, (root) => {
    const run = gate(root);
    assert.equal(run.status, 1);
    assert.equal(lineStarting(run, 'AUTOWRITER '), `AUTOWRITER generation-schema ${RECORD_PATH}: band is required`);
  });
});
