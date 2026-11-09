import { recordsOf, tableWith, tablesIn } from './markdown-table.mjs';
import { count, decimal, lineValue, measuredOf, routesIn, unticked } from './report-reading.mjs';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const promptNumbers = (cell) =>
  cell
    .split(',')
    .map((part) => count(part.trim()))
    .filter((number) => number !== null);

const numbersOf = (record) => {
  const impressions = count(record.Impressions);
  if (impressions === null) return null;
  return { impressions, clicks: count(record.Clicks) ?? 0, position: decimal(record.Position) };
};

const readRows = (table, build) =>
  recordsOf(table).flatMap((record) => {
    const numbers = numbersOf(record);
    return numbers ? [build(record, numbers)] : [];
  });

const queryRow = (record, numbers) => ({
  query: record.Query,
  ...numbers,
  pages: routesIn(record.Page),
  prompts: promptNumbers(record.Prompts),
  cells: record,
});

const pageRow = (record, numbers) => ({ route: unticked(record.Page), ...numbers });

const dayRow = (record, numbers) => ({ day: record.Day, ...numbers });

function promptRow(record) {
  if (count(record['#']) === null) return [];
  const unproven = /^unproven$/i.test(record.Impressions);
  const impressions = unproven ? 0 : count(record.Impressions);
  if (impressions === null) return [];
  const mustWin = unticked(record['Must win']);
  return [
    {
      number: count(record['#']),
      prompt: record.Prompt,
      mustWin: mustWin === '-' || mustWin === '' ? null : mustWin,
      unproven,
      impressions,
      position: unproven ? null : decimal(record.Position),
      carriedBy: routesIn(record['Carried by']),
      cells: record,
    },
  ];
}

export function readDemandReport(markdown) {
  const text = typeof markdown === 'string' ? markdown : '';
  const tables = tablesIn(text);
  return {
    ...measuredOf(text),
    property: lineValue('Property', text),
    generatedFrom: lineValue('Generated-from', text),
    queries: readRows(tableWith(tables, ['Query', 'Page', 'Prompts']), queryRow),
    pages: readRows(tableWith(tables, ['Page', 'Impressions'], ['Query']), pageRow),
    days: readRows(tableWith(tables, ['Day']), dayRow).filter(({ day }) => DAY.test(day)),
    prompts: recordsOf(tableWith(tables, ['#', 'Prompt', 'Must win'])).flatMap(promptRow),
  };
}
