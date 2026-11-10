import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

import { titleSuffix } from '../src/utils/brand.mjs';

import { autowriterReport, summaryLine } from './autowriter-gate.mjs';
import { newLedger } from './autowriter-ledger.mjs';
import { ENTRY_PATH, SLUG, asJson, entryText, bandSceneFiles, recordWith } from './fixtures/record-rules-scene.mjs';
import { SCENE_CORE } from './fixtures/semantic-core-scene.mjs';
import { plantSpendReport } from './fixtures/spend-report-plant.mjs';
import { RECORD_FAMILIES, recordDirectory, recordPath } from './record-layout.mjs';
import { siteBrand } from './site-brand.mjs';

const SITE = resolve(import.meta.dirname, '..');
const REPO = resolve(SITE, '..');
const SUFFIX = titleSuffix(siteBrand());
const NOW = new Date('2026-11-02T07:00:00.000Z');
const CLAIMED = '2026-11-01T07:00:00.000Z';
const BAND_PATH = 'audits/sentence-band.json';
const WORKFLOW = readFileSync(join(REPO, '.github/workflows/ci.yml'), 'utf8');
const CI_FILE = { path: '.github/workflows/ci.yml', text: WORKFLOW };

const FLAT_LEDGER = 'audits/autowriter/what-is-aims.json';
const FLAT_CLAIM = `audits/autowriter/claims/${SLUG}.json`;
const FLAT_RECORD = `audits/autowriter/generations/${SLUG}.json`;
const HAND_WRITTEN = 'audits/phase-4.7/dispositions/routes.json';

const realBand = () => JSON.parse(bandSceneFiles()[BAND_PATH]);
const ledger = (slug) => newLedger({ slug, runId: '9', pullRequest: 5 });
const claim = (extra = {}) => ({
  schema: 1,
  slug: SLUG,
  title: 'A scratch entry',
  format: 'term',
  query: 'scratch entry',
  demand: { impressions: 14, position: 11.2 },
  prompt: { number: 7, text: 'How do I document a model?' },
  runId: '9001',
  status: 'claimed',
  claimedAt: CLAIMED,
  expiresAt: '2026-11-15T07:00:00.000Z',
  ...extra,
});
const SCRATCH = claim();
const FILED_SCRATCH = { path: recordPath('claim', SLUG, CLAIMED), text: JSON.stringify(SCRATCH) };
const generationAt = (path) => ({ path, text: asJson(recordWith({ band: realBand() })) });
const readsEntry = () => ({ readEntry: (path) => (path === ENTRY_PATH ? entryText() : null), band: realBand() });
const report = (extra = {}) =>
  autowriterReport({
    ledgers: [],
    claims: [],
    core: SCENE_CORE,
    workflows: [CI_FILE],
    suffix: SUFFIX,
    now: NOW,
    ...extra,
  });
const findings = (extra) => report(extra).findings;
const one = (extra) => {
  const found = findings(extra);
  assert.equal(found.length, 1, JSON.stringify(found));
  return found[0];
};

test('a ledger filed flat is named with the place a ledger belongs', () => {
  assert.deepEqual(one({ ledgers: [{ path: FLAT_LEDGER, text: JSON.stringify(ledger('what-is-aims')) }] }), {
    rule: 'record-layout',
    path: FLAT_LEDGER,
    detail: 'is not filed as audits/autowriter/<year>/<month>/<slug>.json',
  });
});

test('a claim filed flat is named with the month its own claim date puts it in', () => {
  assert.deepEqual(one({ claims: [{ path: FLAT_CLAIM, text: JSON.stringify(SCRATCH) }] }), {
    rule: 'record-layout',
    path: FLAT_CLAIM,
    detail: `the claim of ${SLUG} belongs at ${recordPath('claim', SLUG, CLAIMED)}, the month of its claim (${CLAIMED})`,
  });
});

test('a generation record filed flat is named with the place a generation record belongs', () => {
  assert.deepEqual(one({ records: [generationAt(FLAT_RECORD)], ...readsEntry() }), {
    rule: 'record-layout',
    path: FLAT_RECORD,
    detail: 'is not filed as audits/autowriter/generations/<year>/<month>/<slug>.json',
  });
});

const NOUN = { ledger: 'ledger', claim: 'claim', generation: 'generation record', disposition: 'disposition' };
const PLANT = {
  ledger: (path) => ({ claims: [FILED_SCRATCH], ledgers: [{ path, text: JSON.stringify(ledger(SLUG)) }] }),
  claim: (path) => ({ claims: [{ path, text: JSON.stringify(SCRATCH) }] }),
  generation: (path) => ({ claims: [FILED_SCRATCH], records: [generationAt(path)], ...readsEntry() }),
  disposition: (path) => ({ claims: [FILED_SCRATCH], dispositions: [path] }),
};

for (const family of RECORD_FAMILIES) {
  test(`a ${NOUN[family]} not filed in the month of its claim is named with the place it belongs`, () => {
    const belongs = recordPath(family, SLUG, SCRATCH.claimedAt);
    const flat = `${recordDirectory(family)}/${basename(belongs)}`;
    const otherMonth = recordPath(family, SLUG, '2026-12-01T00:00:00.000Z');
    assert.deepEqual(findings(PLANT[family](belongs)), []);
    for (const path of [flat, otherMonth])
      assert.deepEqual(findings(PLANT[family](path)), [
        {
          rule: 'record-layout',
          path,
          detail: `the ${NOUN[family]} of ${SLUG} belongs at ${belongs}, the month of its claim (${SCRATCH.claimedAt})`,
        },
      ]);
  });
}

function atThreeDepths(family, [flat, month, deeper]) {
  const inMonth = recordPath(family, month, CLAIMED);
  const fileOf = (slug) => basename(recordPath(family, slug, CLAIMED));
  return [`${recordDirectory(family)}/${fileOf(flat)}`, inMonth, `${dirname(inMonth)}/extra/${fileOf(deeper)}`];
}

const THREE_SLUGS = {
  ledger: ['flat-run', 'month-run', 'deep-run'],
  claim: ['flat-claim', 'month-claim', 'deep-claim'],
  generation: [SLUG, SLUG, SLUG],
  disposition: ['flat-entry', 'month-entry', 'deep-entry'],
};
const threeDepths = () =>
  Object.fromEntries(RECORD_FAMILIES.map((family) => [family, atThreeDepths(family, THREE_SLUGS[family])]));
const slugOfFile = (path) => basename(path, '.json');
const ledgerFiles = (paths) => paths.map((path) => ({ path, text: JSON.stringify(ledger(slugOfFile(path))) }));
const claimFiles = (paths, extra = {}) =>
  paths.map((path) => ({
    path,
    text: JSON.stringify(claim({ slug: slugOfFile(path), title: `What is ${slugOfFile(path)}?`, ...extra })),
  }));

test('records filed flat, in their month and deeper are all counted, and only the one in its month passes', () => {
  const at = threeDepths();
  const { findings: found, counts } = report({
    ledgers: ledgerFiles(at.ledger),
    claims: claimFiles(at.claim),
    records: at.generation.map(generationAt),
    dispositions: at.disposition,
    ...readsEntry(),
  });
  assert.equal(counts.ledgers, 3);
  assert.equal(counts.claims, 3);
  assert.equal(counts.records, 3);
  assert.equal(counts.dispositions, 3);
  assert.deepEqual(
    found.map(({ rule, path }) => [rule, path]),
    RECORD_FAMILIES.flatMap((family) => [at[family][0], at[family][2]]).map((path) => ['record-layout', path])
  );
});

test('the dispositions the report is given are counted, and the summary line says how many', () => {
  assert.equal(report().counts.dispositions, 0);
  const dispositions = [
    HAND_WRITTEN,
    'audits/phase-4.7/dispositions/glossary.json',
    recordPath('disposition', 'what-is-aims', CLAIMED),
  ];
  const run = report({ dispositions });
  assert.deepEqual(run.findings, []);
  assert.equal(run.counts.dispositions, 3);
  assert.match(summaryLine(run), /, 0 generation records, 3 dispositions, 0 findings$/);
});

test('a slug claimed again after its first claim lapsed has two claim files and no finding, and the lapsed one is counted as lapsed', () => {
  const RECLAIMED = '2026-12-01T07:00:00.000Z';
  const again = claim({ claimedAt: RECLAIMED, expiresAt: '2026-12-15T07:00:00.000Z', runId: '9002' });
  const run = report({
    claims: [FILED_SCRATCH, { path: recordPath('claim', SLUG, RECLAIMED), text: JSON.stringify(again) }],
    now: new Date('2026-12-02T07:00:00.000Z'),
  });
  assert.deepEqual(run.findings, []);
  assert.equal(run.counts.claims, 2);
  assert.equal(run.counts.lapsed, 1);
});

test('a hand-written disposition may stay flat, and a generated one may not', () => {
  const generated = 'audits/phase-4.7/dispositions/generated-what-is-aims.json';
  assert.deepEqual(findings({ dispositions: [HAND_WRITTEN] }), []);
  assert.deepEqual(findings({ dispositions: [HAND_WRITTEN, generated] }), [
    {
      rule: 'record-layout',
      path: generated,
      detail: 'is not filed as audits/phase-4.7/dispositions/<year>/<month>/generated-<slug>.json',
    },
  ]);
});

function inTempRepo(plant, check) {
  const root = mkdtempSync(join(tmpdir(), 'autowriter-gate-layout-'));
  try {
    for (const [path, text] of Object.entries({
      'site/src/config.yaml': `site:\n  name: ${siteBrand().name}\n`,
      'docs/SEMANTIC-CORE.md': SCENE_CORE,
      '.github/workflows/ci.yml': WORKFLOW,
      ...bandSceneFiles(),
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

test('the command reads every kind of record at every depth, and its summary counts all three of each', () => {
  const at = threeDepths();
  const planted = [
    ...ledgerFiles(at.ledger),
    ...claimFiles(at.claim, { expiresAt: '2099-01-01T00:00:00.000Z' }),
    ...at.generation.map(generationAt),
    ...at.disposition.map((path) => ({ path, text: '{}\n' })),
  ];
  inTempRepo(
    { ...Object.fromEntries(planted.map(({ path, text }) => [path, text])), [ENTRY_PATH]: entryText() },
    (root) => {
      plantSpendReport(root);
      const run = gate(root);
      assert.equal(run.status, 1);
      const named = run.stderr
        .trim()
        .split('\n')
        .map((line) => /^AUTOWRITER record-layout (\S+): /.exec(line)?.[1]);
      assert.deepEqual(
        named.sort(),
        RECORD_FAMILIES.flatMap((family) => [at[family][0], at[family][2]]).sort(),
        run.stderr
      );
      assert.match(
        run.stdout,
        /^autowriter: 3 ledgers, 3 claims \(0 lapsed\), \d+ generated titles, 6 CI jobs under the aggregate check, pipeline commits not judged, 3 generation records, 3 dispositions, 8 findings$/m
      );
    }
  );
});
