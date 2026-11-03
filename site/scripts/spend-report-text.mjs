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
const MAX_SHOWN_WARNINGS = 3;

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
  'The paid tables count every call the ledgers and the records show: the writing calls of entries, every repair call ' +
  'including a repair that failed, and the spend that no entry carries. ' +
  'The Notes section, when there is one, names each run that ended with no entry.';

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

const paidRows = ({ writingMicro, repairMicro, uncarriedMicro, totalMicro }) => [
  ['Writing calls of entries', usdText(writingMicro)],
  ['Repair calls', usdText(repairMicro)],
  ['Spend that no entry carries', usdText(uncarriedMicro)],
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

function warningsSection(warnings) {
  if (warnings.length === 0) return [];
  const intro =
    'Each line below needs a person to look at it: it says what could not be counted or checked, or what does not add up. ' +
    'Every entry that can be counted is still counted above.';
  return [section('Warnings', intro, warnings.map((sentence) => `- ${sentence}`).join('\n'))];
}

function notesSection(notes, notesMicro) {
  if (notes.length === 0) return [];
  const intro =
    `These runs ended with no entry and together cost ${usdText(notesMicro)} USD. ` +
    'That spend is in no entry row; the paid tables count it as spend that no entry carries. ' +
    'A note is not a warning: nothing a person does can clear it, because a run that ended will never gain a record.';
  return [section('Notes', intro, notes.map((sentence) => `- ${sentence}`).join('\n'))];
}

function emptyReport({ warnings, notes, notesMicro, thisMonth }) {
  const nothingSaid = warnings.length === 0 && notes.length === 0;
  const reason = nothingSaid ? 'No entry has been generated,' : 'No generation record could be counted,';
  return [
    monthSection(thisMonth),
    section('No entry yet', `${reason} ${NOTHING_TO_SHOW}`),
    ...warningsSection(warnings),
    ...notesSection(notes, notesMicro),
  ];
}

function populatedReport({
  rows,
  newestRun,
  thirtyDays,
  allTime,
  rates,
  warnings,
  notes,
  notesMicro,
  thisMonth,
  paidAllTime,
}) {
  return [
    monthSection(thisMonth),
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
        'that ceiling counts calendar months and counts spend that no entry carries. ' +
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
    ...warningsSection(warnings),
    ...notesSection(notes, notesMicro),
  ];
}

export function reportMarkdown(model) {
  const body = model.empty ? emptyReport(model) : populatedReport(model);
  return `${[TITLE, INTRO, MEANING, ...body].join('\n\n')}\n`;
}

const withInstant = (text, at) => text.replace(/^Generated-from: .*$/m, (line) => `${line}\nGenerated-at: ${at}`);

export const reportText = (files, revision, at) =>
  withInstant(withProvenance(reportMarkdown(reportModel(corpusOf(files), { at })), revision), at);

const figures = ({ input, output, micro }) =>
  `${tokenText(input)} input tokens, ${tokenText(output)} output tokens, ${usdText(micro)} USD`;

const entryLine = ({ format, slug, ...rest }) => `${format} ${slug}: ${figures(rest)}`;

const totalLine = (label, { entries, ...rest }) =>
  `${label}: ${countText(entries, 'entry', 'entries')}, ${figures(rest)}`;

const windowLines = (title, { all, formats }) => [
  title,
  totalLine('all', all),
  ...formats.map(({ format, ...total }) => totalLine(format, total)),
];

const ZERO_WARNINGS =
  'every ledger agrees with its generation record; this does not say that every run produced an entry';

const paidLine = ({ writingMicro, repairMicro, uncarriedMicro, totalMicro }) =>
  `Everything paid for: ${usdText(totalMicro)} USD, of which writing calls ${usdText(writingMicro)} USD, ` +
  `repair calls ${usdText(repairMicro)} USD and spend that no entry carries ${usdText(uncarriedMicro)} USD.`;

function warningLines(warnings) {
  const more = warnings.length - MAX_SHOWN_WARNINGS;
  const meaning = warnings.length === 0 ? ZERO_WARNINGS : 'each needs a person to look at it';
  return [
    `Warnings: ${warnings.length} (${meaning})`,
    ...warnings.slice(0, MAX_SHOWN_WARNINGS),
    ...(more > 0 ? [`and ${more} more in ${REPORT_PATH}`] : []),
  ];
}

export function slackMessage(model, rows, line) {
  if (model.empty || rows.length === 0) throw new Error('there is no entry to report, so there is nothing to total');
  if (typeof line !== 'string' || line.trim() === '')
    throw new Error('the message needs the month line, which says what the month has spent against the ceiling');
  return [
    ['This entry', ...rows.map(entryLine)],
    [line],
    windowLines(`Last 30 days, to ${model.thirtyDays.through}`, model.thirtyDays.totals),
    [...windowLines(`All time, since ${model.allTime.since}`, model.allTime.totals), paidLine(model.paidAllTime)],
    ['The 30 days end at the newest entry. They are not the calendar month of the spend ceiling.'],
    warningLines(model.warnings),
  ]
    .map((lines) => lines.join('\n'))
    .join('\n\n');
}
