import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';

import { titleSuffix } from '../src/utils/brand.mjs';

import { ATTEMPT_CAP } from './autowriter-ledger.mjs';
import { historySpecimens } from './autowriter-history-specimens.mjs';
import { autowriterSpecimens } from './autowriter-specimens.mjs';
import { GENERATED_AT } from './fixtures/spend-report-corpus.mjs';
import { ENTRY_PATH, FACT, RECORD_PATH, SENTENCES, bandSceneFiles } from './fixtures/record-rules-scene.mjs';
import { run } from './measure-entry-length.mjs';
import { FAMILIES, manifestFamilies } from './mutation-smoke.mjs';
import { addUntrackedFile, editFile, flatten, SPECIMENS } from './mutation-specimens.mjs';
import { recordPath } from './record-layout.mjs';
import { spendReportFile } from './spend-report.mjs';
import { siteBrand } from './site-brand.mjs';

const SITE = resolve(import.meta.dirname, '..');
const REPO = resolve(SITE, '..');
const FILES = {
  'site/src/config.yaml': `site:\n  name: ${siteBrand().name}\n`,
  'docs/SEMANTIC-CORE.md': readFileSync(join(REPO, 'docs/SEMANTIC-CORE.md'), 'utf8'),
  '.github/workflows/ci.yml': readFileSync(join(REPO, '.github/workflows/ci.yml'), 'utf8'),
  ...bandSceneFiles(),
};
const NAMES = Object.keys(autowriterSpecimens({})).sort();
const PLAIN_NAMES = NAMES.filter((name) => !Object.hasOwn(historySpecimens(), name));
const LEDGER_AT = '2026-11-02T07:00:00.000Z';
const CLAIMED_AT = '2026-11-01T07:00:00.000Z';
const LEDGER = recordPath('ledger', 'zz-specimen', LEDGER_AT);
const CLAIM = recordPath('claim', 'zz-specimen', CLAIMED_AT);
const STRAY_LEDGER = 'audits/autowriter/zz-specimen.json';
const KEPT_LEDGER = recordPath('ledger', 'kept', LEDGER_AT);
const WORKFLOW = '.github/workflows/ci.yml';
const LENGTH_PATH = 'audits/entry-length.json';
const CORPUS_ENTRY = 'site/src/data/post/zz-specimen.md';

const writeSpendReport = (root) => {
  const report = spendReportFile({ repoRoot: root, revision: 'abc1234', at: GENERATED_AT });
  mkdirSync(dirname(join(root, report.path)), { recursive: true });
  writeFileSync(join(root, report.path), report.text);
};
const SUFFIX_PATTERN = titleSuffix(siteBrand()).replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function inTempRepo(check, extra = {}) {
  const root = mkdtempSync(join(tmpdir(), 'autowriter-specimens-'));
  try {
    for (const [path, body] of Object.entries({ ...FILES, ...extra })) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), body);
    }
    writeSpendReport(root);
    return await check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const listing = (root, at = root) =>
  readdirSync(at, { withFileTypes: true }).flatMap((entry) => {
    const path = join(at, entry.name);
    return entry.isDirectory() ? [relative(root, path) + '/', ...listing(root, path)] : [relative(root, path)];
  });

const snapshot = (root) =>
  Object.fromEntries(
    listing(root).map((path) => [path, path.endsWith('/') ? '' : readFileSync(join(root, path), 'utf8')])
  );

const gate = (root) =>
  spawnSync(process.execPath, ['scripts/autowriter-gate.mjs', root], { cwd: SITE, encoding: 'utf8' });

const planted = async (name, root) => SPECIMENS[name].plant(join(root, 'site'));

test('the specimen module names every failure mode of the gate, each against gate:autowriter with a token of its own', () => {
  assert.deepEqual(NAMES, [
    'autowriterAggregateNameShadowed',
    'autowriterAggregateSkippable',
    'autowriterAttemptsOverCap',
    'autowriterBandMeasurementForged',
    'autowriterBandRecordCorpusDrifted',
    'autowriterBandRecordDistributionDrifted',
    'autowriterBandRecordStale',
    'autowriterClaimOriginMismatch',
    'autowriterClaimTitleCollides',
    'autowriterClassifierJudgesLastPush',
    'autowriterCommitMovesTheBand',
    'autowriterCommitMovesTheEntryLength',
    'autowriterCommitRemovesAGenerationRecord',
    'autowriterCommitSealsDispositions',
    'autowriterCommitWritesLighthouseRecord',
    'autowriterCommitWritesLighthouseReport',
    'autowriterCommitWritesLighthouseStamp',
    'autowriterEscalationFailed',
    'autowriterEscalationUnreceipted',
    'autowriterFactWithoutClaimRow',
    'autowriterGeneratedEntryUnderTheFloor',
    'autowriterGenerationOffSchema',
    'autowriterGenerationOriginMismatch',
    'autowriterGenerationWithoutBand',
    'autowriterJobOutsideAggregate',
    'autowriterLedgerOffSchema',
    'autowriterLengthRecordCorpusDrifted',
    'autowriterLengthRecordFedByTheEntry',
    'autowriterLengthRecordStale',
    'autowriterMeasurementDebtMissing',
    'autowriterProseOffTheBand',
    'autowriterPushWithDefaultToken',
    'autowriterRecordMisfiled',
    'autowriterSpendReportDeleted',
    'autowriterSpendReportEdited',
    'autowriterSpendReportStale',
    'autowriterSpendReportUnstamped',
  ]);
  const tokens = NAMES.map((name) => SPECIMENS[name].token);
  assert.equal(new Set(tokens).size, tokens.length, 'two specimens share a token');
  for (const name of NAMES) {
    assert.equal(SPECIMENS[name].gate, 'gate:autowriter', name);
    assert.equal(typeof SPECIMENS[name].plant, 'function', name);
  }
});

test('the misfiled specimen names its stray file in its token, and the mutation smoke runs it as a family of its own', () => {
  assert.equal(SPECIMENS.autowriterRecordMisfiled.token, 'record-layout ' + STRAY_LEDGER);
  const family = manifestFamilies(FAMILIES).find(({ id }) => id === 'autowriter-record-filed-outside-its-month');
  assert.equal(family?.kind, 'specimen');
  assert.equal(family.specimen, 'autowriterRecordMisfiled');
});

for (const name of PLAIN_NAMES) {
  test(name + ' is green before, red with its own token when planted, and byte for byte undone after', async () => {
    await inTempRepo(async (root) => {
      const before = snapshot(root);
      const green = gate(root);
      assert.equal(green.status, 0, green.stderr);
      assert.equal(flatten(green.stderr).includes(SPECIMENS[name].token), false);
      const restore = await planted(name, root);
      const red = gate(root);
      assert.equal(red.status, 1, 'the gate stayed green on ' + name + ': ' + red.stdout);
      assert.ok(flatten(red.stderr).includes(SPECIMENS[name].token), 'token not printed: ' + red.stderr);
      await restore();
      assert.deepEqual(snapshot(root), before);
      assert.equal(gate(root).status, 0);
    });
  });
}

const SCENE = JSON.parse(FILES['audits/sentence-band.json']);
const LIMITS = SCENE.bands.article;
const percent = (share) => `${Number((share * 100).toFixed(2))}%`;
const describeCorpus = ({ article, term }) =>
  `${article.entries} article entries with ${article.sentences} sentences, ${term.entries} term entries with ${term.sentences} sentences`;
const entryLine = (rule) => `AUTOWRITER ${rule} ${RECORD_PATH}: ${ENTRY_PATH}: `;
const BAND_TEXT =
  `article band: median ${LIMITS.medianFloor} to ${LIMITS.medianCeiling} words, ` +
  `at most ${percent(LIMITS.belowThresholdCap)} of sentences under 12 words, ` +
  `at most ${percent(LIMITS.justBelowCap)} of sentences of 8 to 11 words`;
const COMMAND = '(re-measure with: node scripts/measure-sentence-band.mjs --write)';
const ELEVEN_WORDS_BELOW = `${entryLine('below-threshold-share')}10 of 10 sentences (100%) are under 12 words; the band allows ${Math.floor(LIMITS.belowThresholdCap * 10)}; ${BAND_TEXT}`;
const DRIFTED_CORPUS = {
  ...SCENE.corpus,
  article: { ...SCENE.corpus.article, entries: SCENE.corpus.article.entries + 1 },
};

const SCENE_LENGTH = JSON.parse(FILES[LENGTH_PATH]);
const FLOOR = SCENE_LENGTH.limits.article;
const SHORT_WORDS = SENTENCES.slice(2).join(' ').split(' ').length;
const LENGTH_COMMAND = '(re-measure with: node scripts/measure-entry-length.mjs --write)';
const describeLengthCorpus = ({ article, term }) => `${article.entries} article entries, ${term.entries} term entries`;
const DRIFTED_LENGTH_CORPUS = { ...SCENE_LENGTH.corpus, article: { entries: SCENE_LENGTH.corpus.article.entries + 1 } };
const UNDER_THE_FLOOR =
  `AUTOWRITER body-too-short ${CORPUS_ENTRY}: the body has ${SHORT_WORDS} words; ` +
  `no hand-written article has fewer than ${FLOOR.wordsFloor}, and the middle half of them run ` +
  `${FLOOR.targetFrom} to ${FLOOR.targetTo}. Reach the length with more sections that each answer one more ` +
  'question a buyer asks, never with longer sentences or a restated field';

const MESSAGES = [
  ['autowriterGenerationOffSchema', 'AUTOWRITER generation-schema ' + RECORD_PATH + ': schema must equal 1'],
  ['autowriterGenerationWithoutBand', 'AUTOWRITER generation-schema ' + RECORD_PATH + ': band is required'],
  [
    'autowriterFactWithoutClaimRow',
    'AUTOWRITER fact-unbound ' +
      RECORD_PATH +
      ': ' +
      ENTRY_PATH +
      ', sentence "' +
      FACT +
      '": the sentence asserts a fact and the table binds it to nothing',
  ],
  ['autowriterProseOffTheBand', ELEVEN_WORDS_BELOW],
  [
    'autowriterBandMeasurementForged',
    `${entryLine('band-measurement-differs')}sentences 0 in the record against 9 in a measurement of the entry, median 0 in the record against 14 in a measurement of the entry`,
  ],
  [
    'autowriterBandRecordStale',
    `AUTOWRITER record-bands-stale audits/sentence-band.json: the recorded bands differs from a fresh measurement of the corpus ${COMMAND}`,
  ],
  [
    'autowriterBandRecordCorpusDrifted',
    `AUTOWRITER record-corpus-stale audits/sentence-band.json: the record measured ${describeCorpus(DRIFTED_CORPUS)}; the corpus now has ${describeCorpus(SCENE.corpus)} ${COMMAND}`,
  ],
  [
    'autowriterBandRecordDistributionDrifted',
    `AUTOWRITER record-distribution-stale audits/sentence-band.json: the recorded distribution differs from a fresh measurement of the corpus ${COMMAND}`,
  ],
  ['autowriterGeneratedEntryUnderTheFloor', UNDER_THE_FLOOR],
  [
    'autowriterLengthRecordStale',
    `AUTOWRITER length-record-limits-stale ${LENGTH_PATH}: the recorded limits differs from a fresh measurement of the corpus ${LENGTH_COMMAND}`,
  ],
  [
    'autowriterLengthRecordCorpusDrifted',
    `AUTOWRITER length-record-corpus-stale ${LENGTH_PATH}: the record measured ${describeLengthCorpus(DRIFTED_LENGTH_CORPUS)}; the corpus now has ${describeLengthCorpus(SCENE_LENGTH.corpus)} ${LENGTH_COMMAND}`,
  ],
  [
    'autowriterLedgerOffSchema',
    'AUTOWRITER ledger-schema ' + LEDGER + ': attempts[0].judgedCommit must match pattern ^[0-9a-f]{40}$',
  ],
  [
    'autowriterAttemptsOverCap',
    'AUTOWRITER attempt-cap ' + LEDGER + ': ' + (ATTEMPT_CAP + 1) + ' attempts recorded, the cap is ' + ATTEMPT_CAP,
  ],
  [
    'autowriterMeasurementDebtMissing',
    'AUTOWRITER ledger-schema ' +
      LEDGER +
      ': measurementDebt is required once the verdict is merged, so the tree no Lighthouse run measured is on record',
  ],
  [
    'autowriterRecordMisfiled',
    'AUTOWRITER record-layout ' + STRAY_LEDGER + ': is not filed as audits/autowriter/<year>/<month>/<slug>.json',
  ],
  [
    'autowriterEscalationFailed',
    'AUTOWRITER escalation-undelivered ' +
      LEDGER +
      ': escalations[0] esc-1 (no-convergence) was not delivered to slack: SLACK_WEBHOOK_URL is not set; create the repository secret of that name',
  ],
  [
    'autowriterEscalationUnreceipted',
    'AUTOWRITER escalation-undelivered ' +
      LEDGER +
      ': escalations[0] esc-1 (no-convergence) has no delivery receipt for issue',
  ],
  [
    'autowriterEscalationUnreceipted',
    'AUTOWRITER escalation-undelivered ' +
      LEDGER +
      ': escalations[0] esc-1 (no-convergence) has no delivery receipt for slack',
  ],
];

for (const [name, line] of MESSAGES) {
  test(name + ' makes the reader see: ' + line.slice(0, 70), async () => {
    await inTempRepo(async (root) => {
      const restore = await planted(name, root);
      const lines = gate(root).stderr.trim().split('\n');
      await restore();
      assert.ok(lines.includes(line), lines.join('\n'));
    });
  });
}

const countEveryEntry = (root, err = () => {}) =>
  run({ write: true, repoRoot: root, today: SCENE_LENGTH.measuredOn, out: () => {}, err, exclude: [] });

test('the fed length record is what a measurement that counted the pipeline entry writes, and only the fresh measurement refuses it', async () => {
  await inTempRepo(async (root) => {
    const restore = await planted('autowriterLengthRecordFedByTheEntry', root);
    writeSpendReport(root);
    const fed = readFileSync(join(root, LENGTH_PATH), 'utf8');
    const rules = gate(root)
      .stderr.trim()
      .split('\n')
      .map((line) => line.split(' ')[1]);
    const status = countEveryEntry(root);
    const counted = readFileSync(join(root, LENGTH_PATH), 'utf8');
    await restore();
    assert.equal(status, 0);
    assert.equal(fed, counted);
    assert.ok(JSON.parse(fed).limits.article.wordsFloor < FLOOR.wordsFloor);
    assert.deepEqual(rules, [
      'length-record-corpus-stale',
      'length-record-distribution-stale',
      'length-record-limits-stale',
    ]);
  });
});

test('a measurement that counts an entry with no section refuses to write, which is why the fed record is measured from an entry with a section', async () => {
  await inTempRepo(async (root) => {
    const restore = await planted('autowriterGeneratedEntryUnderTheFloor', root);
    const refusals = [];
    const status = countEveryEntry(root, (line) => refusals.push(line));
    await restore();
    assert.equal(status, 1);
    assert.match(refusals.join('\n'), /admit a body of \d+ words with no section/);
  });
});

test('a fed length record that cannot be written leaves neither the planted entry nor its generation record behind', async () => {
  await inTempRepo(async (root) => {
    const before = snapshot(root);
    const failingEdit = () => Promise.reject(new Error('disk full'));
    const { autowriterLengthRecordFedByTheEntry } = autowriterSpecimens({ addUntrackedFile, editFile: failingEdit });
    await assert.rejects(autowriterLengthRecordFedByTheEntry.plant(join(root, 'site')), /disk full/);
    assert.deepEqual(snapshot(root), before);
  });
});

const LENGTH_FAMILIES = {
  'autowriter-generated-entry-under-the-length-floor': 'autowriterGeneratedEntryUnderTheFloor',
  'autowriter-entry-length-record-stale': 'autowriterLengthRecordStale',
  'autowriter-entry-length-corpus-drifted': 'autowriterLengthRecordCorpusDrifted',
  'autowriter-entry-length-record-fed-by-the-entry': 'autowriterLengthRecordFedByTheEntry',
};

test('each length specimen has a family of its own in the mutation smoke, and the family names its specimen', () => {
  const families = manifestFamilies(FAMILIES);
  for (const [id, specimen] of Object.entries(LENGTH_FAMILIES)) {
    const family = families.find((found) => found.id === id);
    assert.equal(family?.kind, 'specimen', id);
    assert.equal(family.specimen, specimen, id);
  }
});

test('the claim specimen repeats a title the generated layer already holds, in other case and without its question mark', async () => {
  await inTempRepo(async (root) => {
    const restore = await planted('autowriterClaimTitleCollides', root);
    assert.ok(existsSync(join(root, CLAIM)), 'the specimen planted no claim file');
    const claim = JSON.parse(readFileSync(join(root, CLAIM), 'utf8'));
    const line = gate(root)
      .stderr.trim()
      .split('\n')
      .find((text) => text.includes('title-collision'));
    await restore();
    assert.equal(claim.title, claim.title.toLowerCase());
    assert.equal(claim.title.includes('?'), false);
    assert.match(
      line,
      new RegExp(
        '^AUTOWRITER title-collision ' +
          CLAIM.replaceAll('.', '\\.') +
          `: title ".+" is already the title of /[a-z/-]+ in the generated layer of docs/SEMANTIC-CORE\\.md \\(".+${SUFFIX_PATTERN}"\\)$`
      )
    );
  });
});

test('the misfiled specimen is a sound ledger in the wrong place: filed under its month, the same bytes leave the gate green', async () => {
  await inTempRepo(async (root) => {
    const restore = await planted('autowriterRecordMisfiled', root);
    writeSpendReport(root);
    assert.equal(existsSync(join(root, LEDGER)), false);
    const text = readFileSync(join(root, STRAY_LEDGER), 'utf8');
    const red = gate(root);
    await restore();
    assert.equal(red.status, 1);
    assert.equal(red.stderr.trim().split('\n').length, 1, red.stderr);
    mkdirSync(dirname(join(root, LEDGER)), { recursive: true });
    writeFileSync(join(root, LEDGER), text);
    const filed = gate(root);
    assert.equal(filed.status, 0, filed.stderr);
    assert.match(filed.stdout, /autowriter: 1 ledgers, /);
  });
});

const WORKFLOW_MESSAGES = [
  ['autowriterJobOutsideAggregate', 'AUTOWRITER aggregate-uncovered ' + WORKFLOW + ': ', 'visual-and-axe'],
  ['autowriterAggregateSkippable', 'AUTOWRITER aggregate-not-always ' + WORKFLOW + ': ', 'always()'],
  ['autowriterAggregateNameShadowed', 'AUTOWRITER aggregate-name ' + WORKFLOW + ': ', 'all required jobs passed'],
  ['autowriterPushWithDefaultToken', 'AUTOWRITER bot-push-token ' + WORKFLOW + ': ', 'AUTOWRITER_PAT'],
  [
    'autowriterClassifierJudgesLastPush',
    'AUTOWRITER classifier-judges-last-push ' + WORKFLOW + ': ',
    'github.event.pull_request.base.sha',
  ],
];

for (const [name, start, mention] of WORKFLOW_MESSAGES) {
  test(name + ' prints a message that names the workflow and what to restore', async () => {
    await inTempRepo(async (root) => {
      const restore = await planted(name, root);
      const line = gate(root)
        .stderr.trim()
        .split('\n')
        .find((text) => text.startsWith(start));
      await restore();
      assert.ok(line, 'no line started with ' + start);
      assert.ok(line.includes(mention), line);
    });
  });
}

test('planting beside a ledger that is already there leaves that ledger and its directory untouched', async () => {
  const kept = JSON.stringify({
    schema: 1,
    slug: 'kept',
    runId: '1',
    pullRequest: null,
    attempts: [],
    spend: { tokens: { input: 0, output: 0 }, costUsd: 0 },
    verdict: { state: 'open', reason: null, decidedAt: null },
    escalations: [],
  });
  await inTempRepo(
    async (root) => {
      const before = snapshot(root);
      for (const name of ['autowriterLedgerOffSchema', 'autowriterClaimTitleCollides', 'autowriterRecordMisfiled']) {
        const restore = await planted(name, root);
        await restore();
        assert.deepEqual(snapshot(root), before);
      }
      assert.equal(readFileSync(join(root, KEPT_LEDGER), 'utf8'), kept);
    },
    { [KEPT_LEDGER]: kept }
  );
});

test('a scratch record whose entry cannot be written is removed again before the failure surfaces', async () => {
  await inTempRepo(async (root) => {
    const before = snapshot(root);
    let calls = 0;
    const failingSecond = (path, content) => {
      calls += 1;
      if (calls === 2) throw new Error('disk full');
      return addUntrackedFile(path, content);
    };
    const { autowriterFactWithoutClaimRow } = autowriterSpecimens({ addUntrackedFile: failingSecond, editFile });
    await assert.rejects(autowriterFactWithoutClaimRow.plant(join(root, 'site')), /disk full/);
    assert.deepEqual(snapshot(root), before);
    assert.equal(existsSync(join(root, RECORD_PATH)), false);
  });
});
