import {
  assemble,
  bold,
  context,
  divider,
  escapeText,
  fields,
  header,
  link,
  preformatted,
  section,
  sections,
} from './slack-blocks.mjs';
import { monoTable } from './slack-table.mjs';
import { monthLineOf } from './spend-ceiling.mjs';
import { REPORT_PATH, countText, tokenText, usdText } from './spend-report-text.mjs';
import { microOf } from './spend-sum.mjs';

const MAX_SHOWN_WARNINGS = 3;
const MAX_SHOWN_RATES = 3;
const REACHED_NOTE = 'The ceiling is reached, so the writer does not run for the rest of the month.';
const WINDOW_CAVEAT = 'The 30 days end at the newest entry. They are not the calendar month of the spend ceiling.';
const LIVE_NOTE = 'The entries are live at these addresses once the pull request merges and the site is published.';
const ZERO_WARNINGS =
  'every ledger agrees with its generation record; this does not say that every run produced an entry';
const NEEDS_A_PERSON = 'each needs a person to look at it';

const RULE = { blocks: [divider()], text: '' };
const column = (name, value) => `${bold(name)}\n${value}`;
const reference = (ref) => link(ref.url, ref.label);
const referencesOf = (...named) => named.filter(([, ref]) => ref !== null && ref !== undefined);
const tabulated = (table) => preformatted(monoTable(table));
const figures = ({ input, output, micro }) =>
  `${tokenText(input)} input tokens, ${tokenText(output)} output tokens, ${usdText(micro)} USD`;

function checked(status) {
  const known = status && typeof status.month === 'string' && Number.isSafeInteger(status.spentMicro);
  if (!known || typeof status.ceilingUsd !== 'number')
    throw new Error('the message needs the ceiling status, which says what the month has spent against the ceiling');
  return status;
}

export function monthPart(status) {
  const { month, spentMicro, ceilingUsd } = checked(status);
  const ceilingMicro = microOf(ceilingUsd);
  const reached = spentMicro >= ceilingMicro;
  const left = reached ? 'none' : usdText(ceilingMicro - spentMicro);
  const figuresOf = tabulated({
    header: ['', 'USD'],
    align: ['left', 'decimal'],
    rows: [
      ['Spent', usdText(spentMicro)],
      ['Ceiling', usdText(ceilingMicro)],
      ['Left', left],
    ],
  });
  return {
    blocks: [
      header(`${month} spend against the monthly ceiling`),
      section(figuresOf),
      ...(reached ? [context(REACHED_NOTE)] : []),
    ],
    text: monthLineOf(status),
  };
}

function labelsOf(rows) {
  return rows.map((row) => {
    const sameFormat = rows.filter(({ format }) => format === row.format);
    return sameFormat.length === 1 ? row.format : `${row.format} ${sameFormat.indexOf(row) + 1}`;
  });
}

function entryTables(rows, labels) {
  const tokens = monoTable({
    header: ['Tokens', 'input', 'output'],
    align: ['left', 'right', 'right'],
    rows: rows.map((row, at) => [labels[at], tokenText(row.input), tokenText(row.output)]),
  });
  const cost = monoTable({
    header: ['Cost', 'USD'],
    align: ['left', 'decimal'],
    rows: rows.map((row, at) => [labels[at], usdText(row.micro)]),
  });
  return preformatted([...tokens, '', ...cost]);
}

function entryParts(rows, links) {
  const labels = labelsOf(rows);
  const addressOf = ({ slug }) => links.entries?.[slug] ?? null;
  const shown = rows.map((row, at) => `${labels[at]} ${link(addressOf(row), row.slug)}`);
  const references = referencesOf(['Pull request', links.pullRequest], ['Workflow run', links.run]);
  const live = rows.some((row) => addressOf(row) !== null);
  return [
    {
      blocks: [section([bold('This entry'), ...shown].join('\n'))],
      text: ['This entry', ...shown.map((name, at) => `${name}: ${figures(rows[at])}`)].join('\n'),
    },
    {
      blocks: [
        ...(references.length === 0 ? [] : [fields(references.map(([name, ref]) => column(name, reference(ref))))]),
        ...(live ? [context(LIVE_NOTE)] : []),
      ],
      text: references.map(([name, ref]) => `${name}: ${reference(ref)}`).join('\n'),
    },
    { blocks: [section(entryTables(rows, labels))], text: '' },
  ];
}

const labelled = ({ all, formats }) => [['all', all], ...formats.map(({ format, ...total }) => [format, total])];

const totalLine = (label, { entries, ...rest }) =>
  `${label}: ${countText(entries, 'entry', 'entries')}, ${figures(rest)}`;

const windowLines = (title, totals) => [title, ...labelled(totals).map(([label, total]) => totalLine(label, total))];

function windowTables(totals) {
  const tokens = monoTable({
    header: ['Tokens', 'input', 'output'],
    align: ['left', 'right', 'right'],
    rows: labelled(totals).map(([label, { input, output }]) => [label, tokenText(input), tokenText(output)]),
  });
  const cost = monoTable({
    header: ['Cost', 'entries', 'USD'],
    align: ['left', 'right', 'decimal'],
    rows: labelled(totals).map(([label, { entries, micro }]) => [label, String(entries), usdText(micro)]),
  });
  return preformatted([...tokens, '', ...cost]);
}

const caveatPart = { blocks: [context(WINDOW_CAVEAT)], text: WINDOW_CAVEAT };

function paidTable({ writingMicro, repairMicro, endedMicro, unmatchedMicro, totalMicro }) {
  return tabulated({
    header: ['', 'USD'],
    align: ['left', 'decimal'],
    rows: [
      ['Writing calls', usdText(writingMicro)],
      ['Repair calls', usdText(repairMicro)],
      ['Ended with no entry', usdText(endedMicro)],
      ['No generation record', usdText(unmatchedMicro)],
      ['Everything paid for', usdText(totalMicro)],
    ],
  });
}

const paidLine = ({ writingMicro, repairMicro, endedMicro, unmatchedMicro, totalMicro }) =>
  `Everything paid for: ${usdText(totalMicro)} USD, of which writing calls ${usdText(writingMicro)} USD, ` +
  `repair calls ${usdText(repairMicro)} USD, runs that ended with no entry ${usdText(endedMicro)} USD ` +
  `and spend with no generation record ${usdText(unmatchedMicro)} USD.`;

const thirtyDaysPart = ({ thirtyDays }) => ({
  blocks: [section(`${bold('Last 30 days')}, to ${thirtyDays.through}\n${windowTables(thirtyDays.totals)}`)],
  text: windowLines(`Last 30 days, to ${thirtyDays.through}`, thirtyDays.totals).join('\n'),
});

const allTimePart = ({ allTime, paidAllTime }) => ({
  blocks: [
    section(`${bold('All time')}, since ${allTime.since}\n${windowTables(allTime.totals)}`),
    section(`${bold('Everything paid for')}\n${paidTable(paidAllTime)}`),
  ],
  text: [...windowLines(`All time, since ${allTime.since}`, allTime.totals), paidLine(paidAllTime)].join('\n'),
});

function ratesPart({ rates }) {
  if (rates.length === 0) return { blocks: [], text: '' };
  const newestFirst = [...rates].reverse();
  const shown = newestFirst.slice(0, MAX_SHOWN_RATES);
  const earlier = newestFirst.length - shown.length;
  const more = earlier > 0 ? [`and ${earlier} earlier in ${REPORT_PATH}`] : [];
  const bullet = ({ model, inputPerMillion, outputPerMillion }) =>
    `• ${escapeText(model)}: ${inputPerMillion} USD per million input tokens, ${outputPerMillion} USD per million output tokens`;
  const sentence = ({ model, inputPerMillion, outputPerMillion }) =>
    `${escapeText(model)} at ${inputPerMillion} USD per million input tokens and ${outputPerMillion} USD per million output tokens`;
  return {
    blocks: [section([bold('Rates'), ...shown.map(bullet), ...more].join('\n'))],
    text: [`Rates: ${shown.map(sentence)[0]}`, ...shown.slice(1).map(sentence), ...more].join('\n'),
  };
}

function warningsPart(warnings) {
  if (warnings.length === 0) {
    const quiet = `Warnings: 0 (${ZERO_WARNINGS})`;
    return { blocks: [context(quiet)], text: quiet };
  }
  const shown = warnings.slice(0, MAX_SHOWN_WARNINGS).map(escapeText);
  const rest = warnings.length - shown.length;
  const more = rest > 0 ? [`and ${rest} more in ${REPORT_PATH}`] : [];
  return {
    blocks: sections(
      [
        bold(`Warnings: ${warnings.length}`) + ` (${NEEDS_A_PERSON})`,
        ...shown.map((line) => `• ${line}`),
        ...more,
      ].join('\n')
    ),
    text: [`Warnings: ${warnings.length} (${NEEDS_A_PERSON})`, ...shown, ...more].join('\n'),
  };
}

const footerPart = { blocks: [context(`Full tables: \`${REPORT_PATH}\``)], text: '' };

export function spendMessage({ model, rows, status, links }) {
  if (model.empty || rows.length === 0) throw new Error('there is no entry to report, so there is nothing to total');
  return assemble(
    monthPart(status),
    RULE,
    ...entryParts(rows, links),
    RULE,
    thirtyDaysPart(model),
    allTimePart(model),
    ratesPart(model),
    caveatPart,
    RULE,
    warningsPart(model.warnings),
    footerPart
  );
}

const oneLine = (text) => text.replace(/\s+/g, ' ').trim();
const withoutFinalStops = (text) => oneLine(text).replace(/\.+$/, '');
const asSentence = (text) => `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;

export function endedMessage({ date, reason, runMicro, status, links }) {
  const why = withoutFinalStops(reason);
  const cost = `${usdText(runMicro)} USD`;
  const references = referencesOf(['Workflow run', links.run], ['Escalation issue', links.issue]);
  return assemble(
    monthPart(status),
    RULE,
    {
      blocks: [
        ...sections(`${bold(`No entry was written on ${date}`)}\n${escapeText(asSentence(why))}`),
        fields([column('What the run cost', cost), ...references.map(([name, ref]) => column(name, reference(ref)))]),
      ],
      text: `No entry was written on ${date}: ${escapeText(why)}. The run cost ${cost}.`,
    },
    { blocks: [], text: references.map(([name, ref]) => `${name}: ${reference(ref)}`).join('\n') }
  );
}
