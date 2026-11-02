import { tablesIn } from './search-demand-gate.mjs';

const LINE = (label) => new RegExp(`^[*_]*${label}:[*_]*[ \\t]*(.*?)[ \\t]*$`, 'm');
const MEASURED =
  /^[*_]*Measured:[*_]*\s*(\d{4}-\d{2}-\d{2})(?:\s*\(window (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})\))?/m;
const PROPERTY = LINE('Property');
const GENERATED_FROM = LINE('Generated-from');

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const COUNT = /^\d+$/;
const DECIMAL = /^\d+(?:\.\d+)?$/;

const lineValue = (pattern, markdown) => pattern.exec(markdown)?.[1] || null;
const count = (cell) => (COUNT.test(cell ?? '') ? Number(cell) : null);
const decimal = (cell) => (DECIMAL.test(cell ?? '') ? Number(cell) : null);
const unticked = (cell) => cell.replaceAll('`', '').trim();

const routes = (cell) =>
  cell
    .split(',')
    .map(unticked)
    .filter((route) => route !== '' && route !== '-');

const promptNumbers = (cell) =>
  cell
    .split(',')
    .map((part) => part.trim())
    .filter((part) => COUNT.test(part))
    .map(Number);

const tableWith = (tables, names, absent = []) =>
  tables.find(
    ({ header }) => names.every((name) => header.includes(name)) && !absent.some((name) => header.includes(name))
  );

const recordsOf = (table) =>
  (table?.rows ?? []).map((cells) => Object.fromEntries(table.header.map((name, at) => [name, cells[at] ?? ''])));

const measuredOf = (record) => {
  const impressions = count(record.Impressions);
  if (impressions === null) return null;
  return { impressions, clicks: count(record.Clicks) ?? 0, position: decimal(record.Position) };
};

const readRows = (table, build) =>
  recordsOf(table).flatMap((record) => {
    const numbers = measuredOf(record);
    return numbers ? [build(record, numbers)] : [];
  });

const queryRow = (record, numbers) => ({
  query: record.Query,
  ...numbers,
  pages: routes(record.Page),
  prompts: promptNumbers(record.Prompts),
  cells: record,
});

const pageRow = (record, numbers) => ({ route: unticked(record.Page), ...numbers });

const dayRow = (record, numbers) => ({ day: record.Day, ...numbers });

function promptRow(record) {
  if (!COUNT.test(record['#'])) return [];
  const unproven = /^unproven$/i.test(record.Impressions);
  const impressions = unproven ? 0 : count(record.Impressions);
  if (impressions === null) return [];
  const mustWin = unticked(record['Must win']);
  return [
    {
      number: Number(record['#']),
      prompt: record.Prompt,
      mustWin: mustWin === '-' || mustWin === '' ? null : mustWin,
      unproven,
      impressions,
      position: unproven ? null : decimal(record.Position),
      carriedBy: routes(record['Carried by']),
      cells: record,
    },
  ];
}

export function readDemandReport(markdown) {
  const text = typeof markdown === 'string' ? markdown : '';
  const [, measured = null, windowStart = null, windowEnd = null] = MEASURED.exec(text) ?? [];
  const tables = tablesIn(text);
  return {
    measured,
    windowStart,
    windowEnd,
    property: lineValue(PROPERTY, text),
    generatedFrom: lineValue(GENERATED_FROM, text),
    queries: readRows(tableWith(tables, ['Query', 'Page', 'Prompts']), queryRow),
    pages: readRows(tableWith(tables, ['Page', 'Impressions'], ['Query']), pageRow),
    days: readRows(tableWith(tables, ['Day']), dayRow).filter(({ day }) => DAY.test(day)),
    prompts: recordsOf(tableWith(tables, ['#', 'Prompt', 'Must win'])).flatMap(promptRow),
  };
}
