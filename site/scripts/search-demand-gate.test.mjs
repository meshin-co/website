import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parsePrompts } from './geo-baseline.mjs';
import {
  MAX_AGE_DAYS,
  demandFindings,
  parseDemandReport,
  promptsWithRows,
  rowFindings,
  staleFindings,
  summaryLine,
} from './search-demand-gate.mjs';

const CORE_DOC = [
  '### The 30 buyer prompts (PRD §17.3)',
  '',
  '**7. AI acceptable use policy template**',
  'Must win: `/blog/ai-acceptable-use-policy-for-a-50-person-company`.',
  '',
  '**8. EU AI Act obligations for deployers small business**',
  'Must win: `/glossary/eu-ai-act`.',
  '',
  '**17. fractional AI leader Europe remote**',
  'Must win: nothing. Retired 2026-10-02 by L57.',
  '',
  '### GAP register',
  '',
].join('\n');

const PROMPTS = parsePrompts(CORE_DOC);
const TODAY = '2026-11-15';
const FRESH = { 7: 'unproven', 8: 28, 17: 'unproven' };

const reportOf = ({ measured = '2026-11-01', impressions = FRESH, label = 'Measured:' } = {}) =>
  [
    '# Search demand',
    '',
    'Generated-from: abc1234',
    label + ' ' + measured + ' (window 2026-08-01 to 2026-10-30)',
    'Property: sc-domain:meshin.co',
    '',
    '## Queries',
    '',
    '| Query | Impressions | Clicks | Position | CTR | Page | Prompts |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| eu ai act | 28 | 0 | 76.2 | 0.0% | `/glossary/eu-ai-act` | 8 |',
    '',
    '## Buyer prompts',
    '',
    '| # | Prompt | Must win | Impressions | Position | Carried by |',
    '| --- | --- | --- | --- | --- | --- |',
    ...PROMPTS.map(
      ({ number, prompt, mustWin }) =>
        '| ' + [number, prompt, mustWin || '-', impressions[number], '-', '-'].join(' | ') + ' |'
    ),
    '',
  ].join('\n');

const rowsOf = (impressions = FRESH) => parseDemandReport(reportOf({ impressions })).rows;
const doc = (path, text) => ({ path, text });

const only = (findings) => {
  assert.equal(findings.length, 1, JSON.stringify(findings));
  return findings[0];
};

test('the measured date and one row per prompt are read from the report', () => {
  assert.deepEqual(parseDemandReport(reportOf()), {
    measured: '2026-11-01',
    rows: [
      { number: 7, prompt: 'AI acceptable use policy template', impressions: 0 },
      { number: 8, prompt: 'EU AI Act obligations for deployers small business', impressions: 28 },
      { number: 17, prompt: 'fractional AI leader Europe remote', impressions: 0 },
    ],
  });
});

test('the queries table is never taken for the prompt table, although it has an Impressions column', () => {
  const queriesOnly = reportOf().split('## Buyer prompts')[0];
  assert.deepEqual(parseDemandReport(queriesOnly).rows, []);
  assert.equal(parseDemandReport(queriesOnly).measured, '2026-11-01');
});

test('a bold label is tolerated, and a date that is not on the calendar reads as no date', () => {
  assert.equal(parseDemandReport(reportOf({ label: '**Measured:**' })).measured, '2026-11-01');
  assert.equal(parseDemandReport(reportOf({ measured: '2026-02-31' })).measured, null);
  assert.equal(parseDemandReport(reportOf({ measured: 'yesterday' })).measured, null);
  assert.equal(parseDemandReport('# Search demand\n\nNo measurement line here.\n').measured, null);
});

test('unproven in any case reads as zero, a count as itself, and anything else as an unreadable cell', () => {
  const table = [
    '| # | Prompt | Impressions |',
    '| --- | --- | --- |',
    '| 7 | a | Unproven |',
    '| 8 | b | 0 |',
    '| 9 | c | 12 |',
    '| 10 | d | - |',
    '| 11 | e | n/a |',
    '| 12 | f |  |',
  ].join('\n');
  assert.deepEqual(
    parseDemandReport(table).rows.map((row) => row.impressions),
    [0, 0, 12, null, null, null]
  );
});

test('an escaped pipe stays inside its cell, and the three columns may come in any order', () => {
  const table = ['| Impressions | Prompt | # |', '| --- | --- | --- |', '| 3 | a\\|b | 7 |'].join('\n');
  assert.deepEqual(parseDemandReport(table).rows, [{ number: 7, prompt: 'a|b', impressions: 3 }]);
});

test('thirty-five days old is fresh and thirty-six is stale, naming the date and the command that refreshes it', () => {
  assert.equal(MAX_AGE_DAYS, 35);
  assert.deepEqual(staleFindings('2026-10-11', TODAY), []);
  const finding = only(staleFindings('2026-10-10', TODAY));
  assert.equal(finding.rule, 'report-stale');
  assert.equal(finding.path, 'audits/search-demand.md');
  assert.match(finding.detail, /measured 2026-10-10; refresh with npm run audit:demand \(36 days old, limit 35\)/);
});

test('a report with no date cannot be shown fresh, so it fails and names the command', () => {
  const finding = only(staleFindings(null, TODAY));
  assert.equal(finding.rule, 'report-stale');
  assert.match(finding.detail, /no "Measured: YYYY-MM-DD" line.*npm run audit:demand/);
});

test('a date from the future cannot defeat the age check, but one day of timezone skew is tolerated', () => {
  assert.deepEqual(staleFindings('2026-11-16', TODAY), []);
  const finding = only(staleFindings('2026-11-17', TODAY));
  assert.equal(finding.rule, 'report-stale');
  assert.match(finding.detail, /measured 2026-11-17, 2 days after today 2026-11-15/);
});

test('every prompt in the core has a row, so no finding is raised', () => {
  assert.equal(PROMPTS.length, 3);
  assert.deepEqual(rowFindings(PROMPTS, rowsOf()), []);
  assert.equal(promptsWithRows(PROMPTS, rowsOf()).length, 3);
});

test('a prompt added to the core after the report names itself, its text and its route', () => {
  const added = { number: 31, prompt: 'zz specimen prompt about measured demand', mustWin: '/' };
  const finding = only(rowFindings([...PROMPTS, added], rowsOf()));
  assert.equal(finding.rule, 'prompt-without-row');
  assert.equal(finding.path, 'docs/SEMANTIC-CORE.md');
  assert.match(
    finding.detail,
    /prompt 31 "zz specimen prompt about measured demand" \(must win \/\) has no row in audits\/search-demand\.md/
  );
  const routeless = only(rowFindings([{ number: 32, prompt: 'another', mustWin: '' }], rowsOf()));
  assert.match(routeless.detail, /prompt 32 "another" \(no must-win route\) has no row/);
});

test('a row with the number but another text is the report of an older core, so the prompt has no row', () => {
  const stale = rowsOf().map((row) => (row.number === 8 ? { ...row, prompt: 'EU AI Act duties' } : row));
  const finding = only(rowFindings(PROMPTS, stale));
  assert.match(
    finding.detail,
    /prompt 8 "EU AI Act obligations for deployers small business".*its row 8 names "EU AI Act duties"/
  );
});

test('a row with the text but another number is not a row for that prompt, because the numbers moved', () => {
  const moved = rowsOf().map((row) => (row.number === 8 ? { ...row, number: 9 } : row));
  const finding = only(rowFindings(PROMPTS, moved));
  assert.match(finding.detail, /^prompt 8 "EU AI Act obligations for deployers small business"/);
});

test('a row whose Impressions cell is unreadable is no row, and the finding says why', () => {
  const unreadable = rowsOf().map((row) => (row.number === 8 ? { ...row, impressions: null } : row));
  const finding = only(rowFindings(PROMPTS, unreadable));
  assert.match(
    finding.detail,
    /prompt 8 .* has no row in audits\/search-demand\.md; its row 8 has an Impressions cell that is neither a count nor "unproven"/
  );
});

test('text is compared ignoring case, spacing and typographic quotes, and nothing else', () => {
  const prompts = [{ number: 1, prompt: "what's the cost", mustWin: '/' }];
  const rows = [{ number: 1, prompt: 'What’s  the Cost', impressions: 0 }];
  assert.deepEqual(rowFindings(prompts, rows), []);
  assert.equal(rowFindings(prompts, [{ ...rows[0], prompt: 'what is the cost' }]).length, 1);
});

test('a report with no prompt table is one finding naming the table, never one per prompt', () => {
  const finding = only(rowFindings(PROMPTS, []));
  assert.equal(finding.rule, 'prompt-without-row');
  assert.match(
    finding.detail,
    /no per-prompt table \(a header with the cells #, Prompt and Impressions\).*all 3 core prompts/
  );
});

test('a core that parses to no prompts fails, because a check that read nothing must not pass', () => {
  const finding = only(rowFindings([], rowsOf()));
  assert.equal(finding.rule, 'prompt-without-row');
  assert.match(finding.detail, /no buyer prompts parsed from docs\/SEMANTIC-CORE\.md/);
});

test('a fresh, complete report with no claim is green, and the summary says what was read', () => {
  const documents = [doc('docs/a.md', 'Nothing claimed here.'), doc('docs/b.md', 'Prompt 7 is unproven.')];
  assert.deepEqual(demandFindings({ report: reportOf(), prompts: PROMPTS, documents, today: TODAY }), []);
  assert.equal(
    summaryLine({ measured: '2026-11-01', today: TODAY, covered: 3, total: 3, documents: 2, findings: 0 }),
    'demand: audits/search-demand.md measured 2026-11-01 (14 days old, limit 35), 3 of 3 core prompts have a row, 2 documents read for won-claims, 0 findings'
  );
  assert.match(
    summaryLine({ measured: null, today: TODAY, covered: 0, total: 3, documents: 2, findings: 2 }),
    /has no measured date \(limit 35 days\)/
  );
});

test('a window with no impressions at all is still green, because sparse data is not a failure', () => {
  const none = { 7: 'unproven', 8: 'unproven', 17: 'unproven' };
  const report = reportOf({ impressions: none });
  assert.deepEqual(demandFindings({ report, prompts: PROMPTS, documents: [], today: TODAY }), []);
});

test('the three failure modes arrive together, the report first, then the rows, then the claims', () => {
  const added = { number: 31, prompt: 'zz specimen prompt about measured demand', mustWin: '/' };
  const findings = demandFindings({
    report: reportOf({ measured: '2020-01-01' }),
    prompts: [...PROMPTS, added],
    documents: [doc('docs/plan.md', 'Prompt 7 is won.')],
    today: TODAY,
  });
  assert.deepEqual(
    findings.map((finding) => finding.rule),
    ['report-stale', 'prompt-without-row', 'claim-outruns-data']
  );
});
