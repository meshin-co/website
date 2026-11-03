import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { spendReportFindings } from './autowriter-spend-rules.mjs';
import { spendSpecimens } from './autowriter-spend-specimens.mjs';
import {
  GENERATED_AT,
  attemptedLedger,
  discardedLedger,
  escalatedLedger,
  filesOf,
  ledgerOf,
  mergedLedger,
  recordOf,
  repairCall,
  repairedRecord,
  writingCall,
} from './fixtures/spend-report-corpus.mjs';
import { addUntrackedFile, editFile, removeFile } from './mutation-specimens.mjs';
import { corpusFiles } from './spend-report.mjs';
import { recordPath } from './record-layout.mjs';
import { REPORT_PATH, reportText, stampedAt } from './spend-report-text.mjs';

const SPECIMENS = spendSpecimens({ addUntrackedFile, editFile, removeFile });
const NAMES = [
  'autowriterSpendReportDeleted',
  'autowriterSpendReportEdited',
  'autowriterSpendReportStale',
  'autowriterSpendReportUnstamped',
];

const OTHER_MONTH_STAMP = '2027-01-15T10:00:00.000Z';

function populatedParts() {
  const draft = writingCall({ input: 12000, output: 3000, tag: 'draft' });
  const correction = writingCall({ role: 'correction', input: 13000, output: 2000, tag: 'correction' });
  const termCall = writingCall({ input: 4000, output: 1000, tag: 'term' });
  const plain = recordOf({ slug: 'a-post', at: '2026-11-02T07:00:00.000Z', calls: [draft, correction] });
  const term = recordOf({
    slug: 'a-term',
    format: 'term',
    at: '2026-11-02T07:05:00.000Z',
    ledgerSlug: 'a-post',
    calls: [termCall],
  });
  const postLedger = attemptedLedger(
    ledgerOf({ slug: 'a-post', calls: [...plain.calls, ...term.calls] }),
    { recordedAt: '2026-11-02T09:00:00.000Z', costUsd: 0.015 },
    { recordedAt: '2026-11-02T11:00:00.000Z', costUsd: 0.03 }
  );
  return {
    ledgers: [
      postLedger,
      escalatedLedger(ledgerOf({ slug: 'lost-post', runId: 'run-2', calls: [draft] })),
      mergedLedger(ledgerOf({ slug: 'orphan-post', runId: 'run-4', calls: [draft] })),
    ],
    records: [repairedRecord(plain, [repairCall()]), term],
  };
}

const STATES = {
  empty: () => ({ parts: { ledgers: [], records: [] }, stamp: GENERATED_AT }),
  noted: () => ({
    parts: {
      ledgers: [
        discardedLedger(ledgerOf({ slug: 'closed-post', runId: 'run-3', calls: [writingCall({ tag: 'closed' })] })),
      ],
      records: [],
    },
    stamp: GENERATED_AT,
  }),
  populated: () => ({ parts: populatedParts(), stamp: GENERATED_AT }),
  'populated, stamped in another month': () => ({ parts: populatedParts(), stamp: OTHER_MONTH_STAMP }),
};

const writeInto = (root, path, text) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

const committedReport = ({ parts, stamp }) => reportText(filesOf(parts), 'abc1234', stamp);

async function inCopy(state, body) {
  const root = mkdtempSync(join(tmpdir(), 'spend-specimens-'));
  try {
    mkdirSync(join(root, 'site'), { recursive: true });
    const files = filesOf(state.parts);
    for (const { path, text } of [...files.ledgers, ...files.records]) writeInto(root, path, text);
    writeInto(root, REPORT_PATH, committedReport(state));
    return await body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function printed(root) {
  const committed = existsSync(join(root, REPORT_PATH)) ? readFileSync(join(root, REPORT_PATH), 'utf8') : null;
  return spendReportFindings({ ...corpusFiles(root), committed })
    .map(({ rule, path, detail }) => `AUTOWRITER ${rule} ${path}: ${detail}`)
    .join('\n');
}

test('four specimens, each against gate:autowriter, each with a token of its own', () => {
  assert.deepEqual(Object.keys(SPECIMENS).sort(), NAMES);
  const tokens = NAMES.map((name) => SPECIMENS[name].token);
  assert.equal(new Set(tokens).size, tokens.length, 'two specimens share a token');
  for (const name of NAMES) {
    assert.equal(SPECIMENS[name].gate, 'gate:autowriter', name);
    assert.equal(typeof SPECIMENS[name].plant, 'function', name);
  }
});

test('the module can be built with no tools, which is how the registry lists its names', () => {
  assert.deepEqual(Object.keys(spendSpecimens({})).sort(), NAMES);
});

for (const [stateName, build] of Object.entries(STATES)) {
  for (const name of NAMES) {
    test(`${name} against a committed report that is ${stateName}: clean before, names its token when planted, clean again once restored`, () => {
      const state = build();
      return inCopy(state, async (root) => {
        assert.equal(printed(root), '');
        const restore = await SPECIMENS[name].plant(join(root, 'site'));
        assert.equal(typeof restore, 'function', 'plant returned no restore function');
        const planted = printed(root);
        assert.ok(planted.includes(SPECIMENS[name].token), planted);
        await restore();
        assert.equal(printed(root), '');
        assert.equal(readFileSync(join(root, REPORT_PATH), 'utf8'), committedReport(state));
      });
    });
  }
}

test('the stale specimen dates its record by the stamp of the committed report and files it under that month', () =>
  inCopy(STATES['populated, stamped in another month'](), async (root) => {
    const stamp = stampedAt(readFileSync(join(root, REPORT_PATH), 'utf8'));
    assert.equal(stamp, OTHER_MONTH_STAMP);
    const restore = await SPECIMENS.autowriterSpendReportStale.plant(join(root, 'site'));
    const planted = join(root, recordPath('generation', 'zz-specimen', stamp));
    assert.ok(planted.includes('/2027/01/'), planted);
    const record = JSON.parse(readFileSync(planted, 'utf8'));
    assert.equal(record.generatedAt, stamp);
    await restore();
    assert.equal(existsSync(planted), false);
  }));

test('the stale specimen refuses a committed report that carries no stamp', () =>
  inCopy(STATES.empty(), async (root) => {
    writeFileSync(
      join(root, REPORT_PATH),
      readFileSync(join(root, REPORT_PATH), 'utf8').replace(/^Generated-at: .*\n/m, '')
    );
    await assert.rejects(() => SPECIMENS.autowriterSpendReportStale.plant(join(root, 'site')), /Generated-at/);
  }));
