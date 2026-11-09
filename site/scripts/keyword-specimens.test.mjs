import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after } from 'node:test';

import { withProvenance } from './evidence-gate.mjs';
import { keywordFindings } from './keyword-demand-gate.mjs';
import { renderKeywords } from './keyword-demand-render.mjs';
import { buildKeywords } from './keyword-demand-rows.mjs';
import { SPECIMENS } from './mutation-specimens.mjs';

const TODAY = '2026-11-08';
const REPORT = withProvenance(
  renderKeywords(
    buildKeywords({
      measured: TODAY,
      market: { country: 'us', language: 'en-US' },
      stats: [
        { phrase: 'shadow ai', weeks: [{ day: '2026-11-07', exact: 12, broad: 15 }] },
        { phrase: 'shadow ai policy', weeks: [] },
      ],
      routes: [],
    })
  ),
  'abc1234'
);

const scratches = [];
after(() => scratches.forEach((scratch) => rmSync(scratch, { recursive: true, force: true })));

async function plantInto(name) {
  const repo = mkdtempSync(join(tmpdir(), 'keyword-specimens-'));
  scratches.push(repo);
  mkdirSync(join(repo, 'site'));
  mkdirSync(join(repo, 'audits'));
  const file = join(repo, 'audits', 'keyword-demand.md');
  writeFileSync(file, REPORT);
  const restore = await SPECIMENS[name].plant(join(repo, 'site'));
  const planted = readFileSync(file, 'utf8');
  await restore();
  return { planted, restored: readFileSync(file, 'utf8') };
}

const printed = (report) =>
  keywordFindings({ report, today: TODAY }).map(({ rule, path, detail }) => `${rule} ${path}: ${detail}`);

test('the unplanted report is one gate:keywords accepts, so each specimen is the only reason the gate goes red', () => {
  assert.deepEqual(printed(REPORT), []);
});

test('the stale specimen moves the measured date back and the gate prints exactly the token it names', async () => {
  const { planted, restored } = await plantInto('keywordReportStale');

  assert.equal(SPECIMENS.keywordReportStale.gate, 'gate:keywords');
  assert.equal(printed(planted).length, 1);
  assert.ok(printed(planted)[0].includes(SPECIMENS.keywordReportStale.token), printed(planted)[0]);
  assert.equal(restored, REPORT);
});

test('the no-table specimen renames one header cell of the phrase table and the gate prints exactly the token it names', async () => {
  const { planted, restored } = await plantInto('keywordReportWithoutPhraseTable');

  assert.equal(SPECIMENS.keywordReportWithoutPhraseTable.gate, 'gate:keywords');
  assert.equal(printed(planted).length, 1);
  assert.ok(printed(planted)[0].includes(SPECIMENS.keywordReportWithoutPhraseTable.token), printed(planted)[0]);
  assert.equal(restored, REPORT);
});

const changedLines = (before, after) => {
  const was = before.split('\n');
  const now = after.split('\n');
  return { removed: was.filter((line) => !now.includes(line)), added: now.filter((line) => !was.includes(line)) };
};

test('the carried-past-the-window specimen sets one phrase to a day long ago and the gate prints exactly the token it names', async () => {
  const { planted, restored } = await plantInto('keywordPhraseCarriedPastWindow');
  const { removed, added } = changedLines(REPORT, planted);

  assert.equal(SPECIMENS.keywordPhraseCarriedPastWindow.gate, 'gate:keywords');
  assert.equal(removed.length, 1);
  assert.equal(added.length, 1);
  assert.ok(added[0].includes('2020-01-01'), added[0]);
  assert.equal(printed(planted).length, 1);
  assert.ok(printed(planted)[0].includes(SPECIMENS.keywordPhraseCarriedPastWindow.token), printed(planted)[0]);
  assert.equal(restored, REPORT);
});

test('the dropped-phrase specimen removes one phrase row without naming it and the gate prints exactly the token it names', async () => {
  const { planted, restored } = await plantInto('keywordPhraseDropped');
  const { removed, added } = changedLines(REPORT, planted);

  assert.equal(SPECIMENS.keywordPhraseDropped.gate, 'gate:keywords');
  assert.equal(removed.length, 1);
  assert.equal(added.length, 0);
  assert.ok(removed[0].startsWith('| shadow ai'), removed[0]);
  assert.equal(printed(planted).length, 1);
  assert.ok(printed(planted)[0].includes(SPECIMENS.keywordPhraseDropped.token), printed(planted)[0]);
  assert.equal(restored, REPORT);
});

test('a specimen that finds nothing to change refuses to plant, so it cannot pass by changing nothing', async () => {
  const repo = mkdtempSync(join(tmpdir(), 'keyword-specimens-'));
  scratches.push(repo);
  mkdirSync(join(repo, 'site'));
  mkdirSync(join(repo, 'audits'));
  writeFileSync(join(repo, 'audits', 'keyword-demand.md'), '# Report with neither a date nor a table\n');

  for (const name of [
    'keywordReportStale',
    'keywordReportWithoutPhraseTable',
    'keywordPhraseCarriedPastWindow',
    'keywordPhraseDropped',
  ]) {
    await assert.rejects(Promise.resolve(SPECIMENS[name].plant(join(repo, 'site'))), /specimen edit changed nothing/);
  }
});
