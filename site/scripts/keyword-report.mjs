import { recordsOf, tableWith, tablesIn } from './markdown-table.mjs';
import { count, lineValue, measuredOf, routesIn } from './report-reading.mjs';

const PHRASE_COLUMNS = ['Phrase', 'Exact', 'Broad', 'Weeks', 'Served by'];
const CANDIDATE_COLUMNS = ['Phrase', 'Exact', 'Broad'];
const NOT_CANDIDATE_COLUMNS = ['Weeks', 'Served by'];
const UNMEASURED_COLUMNS = ['Phrase'];
const NOT_UNMEASURED_COLUMNS = ['Exact', 'Broad', 'Weeks', 'Served by'];
const RUN_COUNTS = /^phrases built (\d+), priced this run (\d+), carried from the cache (\d+), never answered (\d+)$/;
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

function calendarDay(cell) {
  if (!CALENDAR_DAY.test(cell)) return null;
  const day = new Date(`${cell}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(cell) ? cell : null;
}

function phraseRow(record) {
  const [exact, broad, weeks] = [record.Exact, record.Broad, record.Weeks].map(count);
  if ([exact, broad, weeks].includes(null)) return [];
  return [
    {
      phrase: record.Phrase,
      exact,
      broad,
      weeks,
      measured: calendarDay(record.Measured),
      servedBy: routesIn(record['Served by']),
    },
  ];
}

function candidateRow(record) {
  const [exact, broad] = [record.Exact, record.Broad].map(count);
  if (exact === null || broad === null) return [];
  return [{ phrase: record.Phrase, exact, broad }];
}

function runOf(text) {
  const counts = RUN_COUNTS.exec(lineValue('Run', text) ?? '');
  if (counts === null) return null;
  const [built, priced, carried, unanswered] = counts.slice(1).map(Number);
  return { built, priced, carried, unanswered };
}

export function readKeywordReport(markdown) {
  const text = typeof markdown === 'string' ? markdown : '';
  const tables = tablesIn(text);
  return {
    ...measuredOf(text),
    market: lineValue('Market', text),
    generatedFrom: lineValue('Generated-from', text),
    run: runOf(text),
    phrases: recordsOf(tableWith(tables, PHRASE_COLUMNS)).flatMap(phraseRow),
    candidates: recordsOf(tableWith(tables, CANDIDATE_COLUMNS, NOT_CANDIDATE_COLUMNS)).flatMap(candidateRow),
    unmeasured: recordsOf(tableWith(tables, UNMEASURED_COLUMNS, NOT_UNMEASURED_COLUMNS))
      .map(({ Phrase }) => Phrase)
      .filter((phrase) => phrase !== ''),
  };
}
