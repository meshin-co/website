import { withProvenance } from './evidence-gate.mjs';
import { table } from './markdown-table.mjs';
import { corpusOf, reportModel } from './spend-report-model.mjs';

export const REPORT_PATH = 'audits/spend-report.md';

const MICRO = 1e6;
const MAX_SHOWN_WARNINGS = 3;

const TITLE = '# Spend report: what writing each entry cost';

const INTRO =
  'This file is written by `npm run audit:spend` from the generation records and the ledgers under `audits/autowriter`. ' +
  'It is rewritten from them every time and never appended to. ' +
  'It reads no clock and no network, so the same records give the same file on any day. ' +
  '`npm run gate:autowriter` regenerates it and fails when this file differs.';

const MEANING =
  'Cost means the cost of the writing calls of an entry: its draft and its correction, each as its record stored it, ' +
  'added in whole micro-dollars. A repair call is not a writing call and is not counted here. ' +
  'A draft that a run wrote and then skipped, and a run that stopped before any entry existed, have no entry and are ' +
  'not counted here either. The ledgers record that spend, and the monthly spend ceiling counts it.';

const NOTHING_TO_SHOW =
  'so this file holds no row, no total and no rate. That is the absence of a measurement. It is not a cost of zero.';

const ENTRY_HEADER = ['Generated (UTC)', 'Format', 'Slug', 'Input tokens', 'Output tokens', 'Cost (USD)'];
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

const entryRow = ({ generatedAt, format, slug, input, output, micro }) => [
  generatedAt,
  format,
  slug,
  tokenText(input),
  tokenText(output),
  usdText(micro),
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

function warningsSection(warnings) {
  if (warnings.length === 0) return [];
  const intro =
    'These lines say what could not be counted or checked. Every entry that can be counted is still counted above.';
  return [section('Warnings', intro, warnings.map((sentence) => `- ${sentence}`).join('\n'))];
}

function emptyReport({ warnings }) {
  const reason = warnings.length === 0 ? 'No entry has been generated,' : 'No generation record could be counted,';
  return [section('No entry yet', `${reason} ${NOTHING_TO_SHOW}`), ...warningsSection(warnings)];
}

function populatedReport({ rows, newestRun, thirtyDays, allTime, rates, warnings }) {
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
        'that ceiling counts calendar months and counts spend that no entry carries.',
      table(TOTAL_HEADER, totalRows(thirtyDays.totals))
    ),
    section(
      'All time',
      `Every entry recorded: from ${allTime.since}, the oldest record, through ${allTime.through}, the newest.`,
      table(TOTAL_HEADER, totalRows(allTime.totals))
    ),
    section(
      'Every entry',
      'One row per generation record, newest first. The cost is the cost of its writing calls.',
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
  ];
}

export function reportMarkdown(model) {
  const body = model.empty ? emptyReport(model) : populatedReport(model);
  return `${[TITLE, INTRO, MEANING, ...body].join('\n\n')}\n`;
}

export const reportText = (files, revision) => withProvenance(reportMarkdown(reportModel(corpusOf(files))), revision);

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

function warningLines(warnings) {
  if (warnings.length === 0) return [];
  const more = warnings.length - MAX_SHOWN_WARNINGS;
  return [
    [
      `Warnings: ${warnings.length}`,
      ...warnings.slice(0, MAX_SHOWN_WARNINGS),
      ...(more > 0 ? [`and ${more} more in ${REPORT_PATH}`] : []),
    ],
  ];
}

export function slackMessage(model, rows) {
  if (model.empty || rows.length === 0) throw new Error('there is no entry to report, so there is nothing to total');
  return [
    ['This entry', ...rows.map(entryLine)],
    windowLines(`Last 30 days, to ${model.thirtyDays.through}`, model.thirtyDays.totals),
    windowLines(`All time, since ${model.allTime.since}`, model.allTime.totals),
    ['The 30 days end at the newest entry. They are not the calendar month of the spend ceiling.'],
    ...warningLines(model.warnings),
  ]
    .map((lines) => lines.join('\n'))
    .join('\n\n');
}
