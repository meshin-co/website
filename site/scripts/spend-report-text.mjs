import { withProvenance } from './evidence-gate.mjs';
import { table } from './markdown-table.mjs';
import { corpusOf, reportModel } from './spend-report-model.mjs';
import { isUtcInstant } from './spend-sum.mjs';

export const REPORT_PATH = 'audits/spend-report.md';

const STAMP = /^Generated-at: (.+)$/m;

export function stampedAt(text) {
  const at = STAMP.exec(text)?.[1]?.trim();
  return isUtcInstant(at) ? at : undefined;
}

const MICRO = 1e6;

const TITLE = '# Spend report: what writing each entry cost';

const INTRO =
  'This file is written by `npm run audit:spend` from the generation records and the ledgers under `audits/autowriter`. ' +
  'It is rewritten from them every time and never appended to. ' +
  'It reads no network. It reads the clock once, when it is written, and stamps that instant in Generated-at, ' +
  'so the same records and the same stamp give the same file. ' +
  '`npm run gate:autowriter` regenerates it with the stamp it finds and fails when this file differs.';

const MEANING =
  'Cost means the cost of the writing calls of an entry: its draft and its correction, each as its record stored it, ' +
  'added in whole micro-dollars. Repair is the cost of the repair calls that the record of the entry holds, and is not part of Cost. ' +
  'A draft that a run wrote and then skipped, a run that stopped before any entry existed and an attempt that a person ' +
  'discarded have no entry, so no row holds them. The ledgers record that spend, and the monthly spend ceiling counts it. ' +
  'The paid tables count every call the ledgers and the records show, and each call is in exactly one row: ' +
  'the writing calls of entries; every repair call, including a repair that failed; ' +
  'the runs that ended with no entry, which the Notes name; ' +
  'and the spend of a ledger that no generation record names, which the Warnings name. ' +
  'The four rows add up to the last row.';

const NOTHING_TO_SHOW =
  'so this file holds no entry row, no entry total and no rate. That is the absence of a measurement. ' +
  'It is not a cost of zero. The figures of the month above count every call the ledgers show.';

const ENTRY_HEADER = [
  'Generated (UTC)',
  'Format',
  'Slug',
  'Input tokens',
  'Output tokens',
  'Cost (USD)',
  'Repair (USD)',
];
const PAID_HEADER = ['What was paid for', 'Cost (USD)'];
const TOTAL_HEADER = ['Format', 'Entries', 'Input tokens', 'Output tokens', 'Cost (USD)'];
const RATE_HEADER = [
  'Model',
  'Input USD per million tokens',
  'Output USD per million tokens',
  'Entries',
  'First',
  'Last',
];

export function usdText(micro) {
  if (!Number.isSafeInteger(micro) || micro < 0)
    throw new Error(`${String(micro)} is not a whole number of micro-dollars`);
  const fraction = String(micro % MICRO)
    .padStart(6, '0')
    .replace(/0+$/, '')
    .padEnd(2, '0');
  return `${(micro - (micro % MICRO)) / MICRO}.${fraction}`;
}

export const tokenText = (count) => String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const countText = (count, one, many) => `${count} ${count === 1 ? one : many}`;

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function monthLine({ month, spentMicro, ceilingMicro }) {
  if (typeof month !== 'string' || !MONTH.test(month))
    throw new Error(`${JSON.stringify(month)} is not a UTC month such as 2026-11`);
  const head = `${month} so far: ${usdText(spentMicro)} USD spent of the ${usdText(ceilingMicro)} USD monthly ceiling,`;
  if (spentMicro >= ceilingMicro)
    return `${head} none left: the ceiling is reached, so the writer does not run for the rest of the month.`;
  return `${head} ${usdText(ceilingMicro - spentMicro)} USD left.`;
}

const entryRow = ({ generatedAt, format, slug, input, output, micro, repairMicro }) => [
  generatedAt,
  format,
  slug,
  tokenText(input),
  tokenText(output),
  usdText(micro),
  usdText(repairMicro),
];

const totalRow = (label, { entries, input, output, micro }) => [
  label,
  String(entries),
  tokenText(input),
  tokenText(output),
  usdText(micro),
];

const totalRows = ({ all, formats }) => [
  totalRow('all', all),
  ...formats.map(({ format, ...total }) => totalRow(format, total)),
];

const rateRow = ({ model, inputPerMillion, outputPerMillion, entries, first, last }) => [
  model,
  String(inputPerMillion),
  String(outputPerMillion),
  String(entries),
  first,
  last,
];

const section = (title, ...blocks) => [`## ${title}`, ...blocks].join('\n\n');

const ABOUT = section('About this file', INTRO, MEANING);

const paidRows = ({ writingMicro, repairMicro, endedMicro, unmatchedMicro, totalMicro }) => [
  ['Writing calls of entries', usdText(writingMicro)],
  ['Repair calls', usdText(repairMicro)],
  ['Runs that ended with no entry', usdText(endedMicro)],
  ['Spend with no generation record', usdText(unmatchedMicro)],
  ['Everything paid for', usdText(totalMicro)],
];

const paidTable = (paid) => table(PAID_HEADER, paidRows(paid));

const monthSection = ({ month, at, ceilingMicro, paid }) =>
  section(
    'This month',
    monthLine({ month, spentMicro: paid.totalMicro, ceilingMicro }),
    `The figure is the spend of the UTC calendar month of ${at}, the instant stamped in Generated-at. ` +
      'It counts the ledgers and records committed in this repository: every call they show, ' +
      'whether it wrote an entry, repaired one or ended with no entry. ' +
      'The ceiling job also counts the spend on branches that are not merged yet, so the figure it stops on can be higher. ' +
      `This file does not change at the turn of the month: after the last run it still says what ${month} had spent at that instant.`,
    paidTable(paid)
  );

function warningsSection(warnings, unmatchedMicro) {
  if (warnings.length === 0) return [];
  const unmatched =
    unmatchedMicro > 0
      ? ' The ledgers below that no generation record names are counted in the paid tables, ' +
        `under Spend with no generation record: ${usdText(unmatchedMicro)} USD together.`
      : '';
  const intro =
    'Each line below needs a person to look at it: it says what could not be counted or checked, or what does not add up. ' +
    `Every entry that can be counted is still counted above.${unmatched}`;
  return [section('Warnings', intro, warnings.map((sentence) => `- ${sentence}`).join('\n'))];
}

function notesSection(notes, endedMicro) {
  if (notes.length === 0) return [];
  const intro =
    `These runs ended with no entry and together cost ${usdText(endedMicro)} USD. ` +
    'That spend is in no entry row; the paid tables count it under Runs that ended with no entry. ' +
    'A note is not a warning: nothing a person does can clear it, because a run that ended will never gain a record.';
  return [section('Notes', intro, notes.map((sentence) => `- ${sentence}`).join('\n'))];
}

function emptyReport({ warnings, notes, paidAllTime }) {
  const nothingSaid = warnings.length === 0 && notes.length === 0;
  const reason = nothingSaid ? 'No entry has been generated,' : 'No generation record could be counted,';
  return [
    section('No entry yet', `${reason} ${NOTHING_TO_SHOW}`),
    ...warningsSection(warnings, paidAllTime.unmatchedMicro),
    ...notesSection(notes, paidAllTime.endedMicro),
  ];
}

function populatedReport({ rows, newestRun, thirtyDays, allTime, rates, warnings, notes, paidAllTime }) {
  return [
    section(
      'This entry',
      `The newest run: the run of the newest record, which was generated at ${thirtyDays.through}. ` +
        'A run that wrote an article and a term lists both.',
      table(ENTRY_HEADER, newestRun.map(entryRow))
    ),
    section(
      'Last 30 days',
      `The 30 days of 24 hours each that end at the newest record: after ${thirtyDays.after} and through ${thirtyDays.through}. ` +
        'The start is excluded and the end is included, so an entry generated exactly at the start is outside the window. ' +
        'The window ends at the newest record and not at the clock, so this file does not change at midnight. ' +
        'Read long after the last run, it still describes the 30 days before that run. ' +
        'These 30 days are not the UTC calendar month of the monthly spend ceiling in `site/engine.config.json`: ' +
        'that ceiling counts calendar months and counts every call the machine paid for, not only the writing calls of entries. ' +
        'This table counts the writing calls of entries only.',
      table(TOTAL_HEADER, totalRows(thirtyDays.totals))
    ),
    section(
      'All time',
      `Every entry recorded: from ${allTime.since}, the oldest record, through ${allTime.through}, the newest. ` +
        'The first table counts the writing calls of entries only. ' +
        'The second table adds every other call the machine paid for, so its last row is the whole spend the ledgers and records show.',
      table(TOTAL_HEADER, totalRows(allTime.totals)),
      paidTable(paidAllTime)
    ),
    section(
      'Every entry',
      'One row per generation record, newest first. The cost is the cost of its writing calls, and Repair is the cost of its repair calls.',
      table(ENTRY_HEADER, rows.map(entryRow))
    ),
    section(
      'Rates',
      'The model and the two rates, in USD per million tokens, that each cost was computed at. ' +
        'An earlier entry keeps the cost its record stored, so a change of rate adds a row and rewrites no history. ' +
        'First and Last are the instants of the first and the last entry priced at that rate.',
      table(RATE_HEADER, rates.map(rateRow))
    ),
    ...warningsSection(warnings, paidAllTime.unmatchedMicro),
    ...notesSection(notes, paidAllTime.endedMicro),
  ];
}

export function reportMarkdown(model) {
  const body = model.empty ? emptyReport(model) : populatedReport(model);
  return `${[TITLE, monthSection(model.thisMonth), ABOUT, ...body].join('\n\n')}\n`;
}

const withInstant = (text, at) => text.replace(/^Generated-from: .*$/m, (line) => `${line}\nGenerated-at: ${at}`);

export const reportText = (files, revision, at) =>
  withInstant(withProvenance(reportMarkdown(reportModel(corpusOf(files), { at })), revision), at);
