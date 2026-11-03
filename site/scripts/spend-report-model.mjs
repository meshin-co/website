import { MONTHLY_SPEND_CEILING_USD, fileStemProblem, validateLedger } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { WRITING_ROLES, validateRecord, writingTotals } from './generation-record.mjs';
import {
  attemptsMicro,
  hasEnded,
  instantError,
  isUtcInstant,
  microOf,
  monthlyBreakdown,
  recordMicro,
  recordRepairMicro,
  spendItemsOf,
  spendWarnings,
  totalBreakdown,
  usdOf,
} from './spend-sum.mjs';

export const WINDOW_DAYS = 30;

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

const sum = (values) => values.reduce((total, value) => total + value, 0);
const byText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const stemOf = (path) => path.slice(path.lastIndexOf('/') + 1).replace(/\.json$/, '');
const ledgerSpendMicro = (ledger) => totalBreakdown({ ledgers: [{ ledger, record: null }] }).totalMicro;
const instantOf = (value) => new Date(value).toISOString();
const isWriting = ({ role }) => WRITING_ROLES.includes(role);

const newestFirst = (left, right) => byText(right.generatedAt, left.generatedAt) || byText(left.slug, right.slug);
const oldestFirst = (left, right) => byText(left.generatedAt, right.generatedAt) || byText(left.slug, right.slug);

const firstProblem = (path, value, validate) => validate(value).map(describeProblem)[0] ?? fileStemProblem(path, value);

function readAll(files, validate) {
  const values = [];
  const problems = [];
  for (const { path, text } of files) {
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      problems.push(`${path} is not counted: it is not readable JSON`);
      continue;
    }
    const problem = firstProblem(path, value, validate);
    if (problem) problems.push(`${path} is not counted: ${problem}`);
    else values.push(value);
  }
  return { values, problems };
}

export function corpusOf({ ledgers, records }) {
  const read = readAll(ledgers, validateLedger);
  const entries = readAll(records, validateRecord);
  return {
    ledgers: read.values,
    records: entries.values,
    problems: [...read.problems, ...entries.problems].sort(),
  };
}

function entryOf(record) {
  const { tokens } = writingTotals(record);
  return {
    slug: record.slug,
    runId: record.runId,
    format: record.entry.format,
    generatedAt: instantOf(record.generatedAt),
    input: tokens.input,
    output: tokens.output,
    micro: recordMicro(record),
    repairMicro: recordRepairMicro(record),
  };
}

const totalOf = (entries) => ({
  entries: entries.length,
  input: sum(entries.map(({ input }) => input)),
  output: sum(entries.map(({ output }) => output)),
  micro: sum(entries.map(({ micro }) => micro)),
});

function totalsOf(entries) {
  const formats = [...new Set(entries.map(({ format }) => format))].sort();
  return {
    all: totalOf(entries),
    formats: formats.map((format) => ({ format, ...totalOf(entries.filter((entry) => entry.format === format)) })),
  };
}

function ratesOf(records) {
  const pricedAt = new Map();
  for (const record of records) {
    const generatedAt = instantOf(record.generatedAt);
    const keys = new Set(
      record.calls
        .filter(isWriting)
        .map(({ resolvedModel, price }) =>
          JSON.stringify([resolvedModel, price.inputPerMillion, price.outputPerMillion])
        )
    );
    for (const key of keys) pricedAt.set(key, [...(pricedAt.get(key) ?? []), generatedAt]);
  }
  return [...pricedAt]
    .map(([key, instants]) => {
      const [model, inputPerMillion, outputPerMillion] = JSON.parse(key);
      const ordered = [...instants].sort(byText);
      return {
        model,
        inputPerMillion,
        outputPerMillion,
        entries: ordered.length,
        first: ordered[0],
        last: ordered.at(-1),
      };
    })
    .sort(
      (left, right) =>
        byText(left.first, right.first) ||
        byText(left.model, right.model) ||
        left.inputPerMillion - right.inputPerMillion ||
        left.outputPerMillion - right.outputPerMillion
    );
}

const clauseOf = (ledger, ofGeneration, ofAttempts) =>
  [
    ...(ledger.generation === undefined ? [] : [ofGeneration(ledger.generation.costUsd)]),
    ...(attemptsMicro(ledger) > 0 ? [ofAttempts(usdOf(attemptsMicro(ledger)))] : []),
  ].join(' and ');

const recordedClause = (ledger) =>
  clauseOf(
    ledger,
    (usd) => `a generation of ${usd} USD`,
    (usd) => `repair attempts of ${usd} USD`
  );

const spentClause = (ledger) =>
  clauseOf(
    ledger,
    (usd) => `${usd} USD for the generation`,
    (usd) => `${usd} USD for repair attempts`
  );

const missingRecordSentence = (ledger) =>
  `${ledger.slug}: its ledger records ${recordedClause(ledger)} (verdict: ${ledger.verdict.state}) but no generation record names this ledger, so no entry is counted for it`;

const discardedSentence = (ledger) =>
  `${ledger.slug}: a person discarded this attempt on ${ledger.verdict.decidedAt.slice(0, 10)} and its generation record went with it, so no entry is counted for it and its cost cannot be checked against a record; its ledger records ${spentClause(ledger)}, and the monthly spend ceiling counts that cost`;

const endedSentence = (ledger) =>
  `${ledger.slug}: this run ended on ${ledger.verdict.decidedAt.slice(0, 10)} with the verdict ${ledger.verdict.state} and left no generation record, so no entry is counted for it; its ledger records ${spentClause(ledger)}, and the monthly spend ceiling counts that cost`;

const NOTE_SENTENCES = { stopped: endedSentence, escalated: endedSentence, discarded: discardedSentence };

const noteSentence = (ledger) => NOTE_SENTENCES[ledger.verdict.state](ledger);

function ledgerSentences({ ledgers, records, items }) {
  const ledgerBySlug = new Map(ledgers.map((ledger) => [ledger.slug, ledger]));
  const recordsByLedger = Map.groupBy(records, ({ ledger }) => stemOf(ledger));
  const checked = [...recordsByLedger].flatMap(([ledgerSlug, group]) => {
    const ledger = ledgerBySlug.get(ledgerSlug);
    if (!ledger)
      return group.map(
        ({ slug, ledger: path }) =>
          `${slug}: its generation record names the ledger ${path}, which does not exist, so the spend of its run is not checked against a ledger`
      );
    const together = { ...group[0], calls: group.flatMap(({ calls }) => calls) };
    return spendWarnings({ ledgers: [{ ledger, record: together }] });
  });
  const unrecorded = items
    .filter(({ ledger, record }) => ledger !== null && record === null && ledgerSpendMicro(ledger) > 0)
    .map(({ ledger }) => ledger);
  return {
    warnings: [...checked, ...unrecorded.filter((ledger) => !hasEnded(ledger)).map(missingRecordSentence)].sort(),
    notes: unrecorded.filter(hasEnded).map(noteSentence).sort(),
  };
}

export function reportModel({ ledgers, records, problems }, { at } = {}) {
  if (!isUtcInstant(at)) throw instantError(at);
  const month = at.slice(0, 7);
  const items = spendItemsOf({ ledgers, records });
  const found = ledgerSentences({ ledgers, records, items });
  const warnings = [...problems, ...found.warnings];
  const spend = {
    thisMonth: {
      month,
      at,
      ceilingMicro: microOf(MONTHLY_SPEND_CEILING_USD),
      paid: monthlyBreakdown({ ledgers: items, month }),
    },
    paidAllTime: totalBreakdown({ ledgers: items }),
  };
  const { notes } = found;
  if (records.length === 0)
    return {
      empty: true,
      rows: [],
      newestRun: [],
      thirtyDays: null,
      allTime: null,
      rates: [],
      warnings,
      notes,
      ...spend,
    };
  const rows = records.map(entryOf).sort(newestFirst);
  const through = rows[0].generatedAt;
  const after = instantOf(Date.parse(through) - WINDOW_DAYS * DAY_MILLISECONDS);
  return {
    empty: false,
    rows,
    newestRun: rows.filter(({ runId }) => runId === rows[0].runId).sort(oldestFirst),
    thirtyDays: { after, through, totals: totalsOf(rows.filter(({ generatedAt }) => generatedAt > after)) },
    allTime: { since: rows.at(-1).generatedAt, through, totals: totalsOf(rows) },
    rates: ratesOf(records),
    warnings,
    notes,
    ...spend,
  };
}
