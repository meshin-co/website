import { fileStemProblem, validateLedger } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { WRITING_ROLES, validateRecord, writingTotals } from './generation-record.mjs';
import { microOf, recordMicro, spendWarnings } from './spend-sum.mjs';

export const WINDOW_DAYS = 30;

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

const sum = (values) => values.reduce((total, value) => total + value, 0);
const byText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const stemOf = (path) => path.slice(path.lastIndexOf('/') + 1).replace(/\.json$/, '');
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

function ledgerSentences({ ledgers, records }) {
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
  const unrecorded = ledgers
    .filter(
      (ledger) =>
        !recordsByLedger.has(ledger.slug) &&
        microOf(ledger.generation?.costUsd ?? 0) > 0 &&
        ledger.verdict.state !== 'stopped'
    )
    .map(
      (ledger) =>
        `${ledger.slug}: its ledger records a generation of ${ledger.generation.costUsd} USD (verdict: ${ledger.verdict.state}) but no generation record names this ledger, so no entry is counted for it`
    );
  return [...checked, ...unrecorded].sort();
}

export function reportModel({ ledgers, records, problems }) {
  const warnings = [...problems, ...ledgerSentences({ ledgers, records })];
  if (records.length === 0)
    return { empty: true, rows: [], newestRun: [], thirtyDays: null, allTime: null, rates: [], warnings };
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
  };
}
