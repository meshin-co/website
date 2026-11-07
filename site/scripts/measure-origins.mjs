import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { ORIGINS, WEAKNESS_REASONS, originOf } from './autowriter-claims.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { fileStemProblem } from './autowriter-ledger.mjs';
import { CATEGORIES } from './entry-limits.mjs';
import { ENTRY_COST_ROLES, REPAIR_ROLES, TOPIC_ROLES, validateRecord } from './generation-record.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { recordFiles } from './record-layout.mjs';
import { microOf, usdOf } from './spend-sum.mjs';

const USAGE = 'usage: node scripts/measure-origins.mjs [repository root]';
const GAP = '  ';
const PUBLISH_DATE = /^publishDate:\s*['"]?(\d{4}-\d{2}-\d{2})/m;
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const WRITING_ROLES = ENTRY_COST_ROLES.filter((role) => !TOPIC_ROLES.includes(role));
const TABLE_HEADER = [
  'origin',
  'entries',
  'calls',
  'tokens',
  'topic USD',
  'writing USD',
  'repair USD',
  'total USD',
  'mean USD per entry',
];
const LIST_HEADER = ['slug', 'origin', 'category or weakness', 'date'];
const CATCH_UP_HEADER = ['slug', 'slot', 'minutes late', 'date'];

class OriginsError extends Error {}

const sum = (values) => values.reduce((total, value) => total + value, 0);
const usd = (micro) => usdOf(micro).toFixed(4);

function readJson(path, text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new OriginsError(`${path} is not readable JSON: ${error.message}`);
  }
}

function loadRecord(repoRoot, path) {
  const record = readJson(path, readFileSync(join(repoRoot, path), 'utf8'));
  const problems = validateRecord(record).map(describeProblem);
  if (problems.length > 0) throw new OriginsError(`${path} is not valid: ${problems.slice(0, 3).join('; ')}`);
  const stem = fileStemProblem(path, record);
  if (stem !== null) throw new OriginsError(`${path} is not valid: ${stem}`);
  return record;
}

function loadRecords(repoRoot) {
  const records = [];
  const failures = [];
  for (const path of recordFiles(repoRoot, 'generation')) {
    try {
      records.push(loadRecord(repoRoot, path));
    } catch (error) {
      if (!(error instanceof OriginsError)) throw error;
      failures.push(error.message);
    }
  }
  return { records, failures };
}

const microOfRoles = (record, roles) =>
  sum(record.calls.filter(({ role }) => roles.includes(role)).map(({ costUsd }) => microOf(costUsd)));

function costOf(record) {
  return {
    topic: microOfRoles(record, TOPIC_ROLES),
    writing: microOfRoles(record, WRITING_ROLES),
    repair: microOfRoles(record, REPAIR_ROLES),
    total: sum(record.calls.map(({ costUsd }) => microOf(costUsd))),
  };
}

function publishDateOf(repoRoot, record) {
  let text;
  try {
    text = readFileSync(join(repoRoot, record.entry.path), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const front = FRONT_MATTER.exec(text);
  return front ? (PUBLISH_DATE.exec(front[1])?.[1] ?? null) : null;
}

function summarise(repoRoot, record) {
  const origin = originOf(record.claim);
  return {
    slug: record.slug,
    origin,
    prompted: record.claim.prompt !== undefined,
    detail: origin === 'category' ? record.claim.category : (record.claim.weakness ?? []).join(','),
    date: publishDateOf(repoRoot, record) ?? record.generatedAt.slice(0, 10),
    category: record.claim.category,
    weakness: record.claim.weakness ?? [],
    catchUp: record.claim.catchUp ?? null,
    calls: record.calls.length,
    tokens: record.totals.tokens.input + record.totals.tokens.output,
    cost: costOf(record),
  };
}

function totalsOf(label, entries) {
  const total = sum(entries.map(({ cost }) => cost.total));
  return [
    label,
    String(entries.length),
    String(sum(entries.map(({ calls }) => calls))),
    String(sum(entries.map(({ tokens }) => tokens))),
    usd(sum(entries.map(({ cost }) => cost.topic))),
    usd(sum(entries.map(({ cost }) => cost.writing))),
    usd(sum(entries.map(({ cost }) => cost.repair))),
    usd(total),
    entries.length === 0 ? '-' : usd(total / entries.length),
  ];
}

function aligned(rows, numeric = false) {
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)));
  return rows.map((row) =>
    row
      .map((cell, column) => (numeric && column > 0 ? cell.padStart(widths[column]) : cell.padEnd(widths[column])))
      .join(GAP)
      .trimEnd()
  );
}

const countLines = (heading, keys, counts) => [
  '',
  heading,
  ...aligned(
    keys.map((key) => [key, String(counts(key))]),
    true
  ),
];

function listLines(entries) {
  const unprompted = entries
    .filter(({ prompted }) => !prompted)
    .sort((left, right) => left.date.localeCompare(right.date) || left.slug.localeCompare(right.slug));
  const heading = ['', 'written without a buyer prompt, oldest first'];
  if (unprompted.length === 0) return [...heading, 'none'];
  const rows = unprompted.map(({ slug, origin, detail, date }) => [slug, origin, detail, date]);
  return [...heading, ...aligned([LIST_HEADER, ...rows])];
}

function catchUpLines(entries) {
  const late = entries
    .filter(({ catchUp }) => catchUp !== null)
    .sort((left, right) => left.date.localeCompare(right.date) || left.slug.localeCompare(right.slug));
  const heading = ['', 'caught up late, oldest first'];
  if (late.length === 0) return [...heading, 'none'];
  const rows = late.map(({ slug, catchUp, date }) => [slug, catchUp.slot, String(catchUp.lateMinutes), date]);
  return [...heading, ...aligned([CATCH_UP_HEADER, ...rows])];
}

function describe(entries) {
  if (entries.length === 0) return ['0 entries'];
  const byOrigin = (origin) => entries.filter((entry) => entry.origin === origin);
  const rows = [...ORIGINS.map((origin) => totalsOf(origin, byOrigin(origin))), totalsOf('all', entries)];
  const table = aligned([TABLE_HEADER, ...rows], true);
  return [
    `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`,
    '',
    ...table,
    ...countLines(
      'weak-demand weaknesses',
      WEAKNESS_REASONS,
      (reason) => byOrigin('weak-demand').filter(({ weakness }) => weakness.includes(reason)).length
    ),
    ...countLines(
      'category entries',
      CATEGORIES,
      (category) => byOrigin('category').filter((entry) => entry.category === category).length
    ),
    ...countLines(
      'arrival',
      ['on time', 'catch-up'],
      (arrival) => entries.filter(({ catchUp }) => (catchUp === null) === (arrival === 'on time')).length
    ),
    ...catchUpLines(entries),
    ...listLines(entries),
  ];
}

export function run({ repoRoot, out, err }) {
  const { records, failures } = loadRecords(repoRoot);
  if (failures.length > 0) {
    for (const message of failures) err(`MEASURE-ORIGINS ${message}`);
    return 1;
  }
  for (const line of describe(records.map((record) => summarise(repoRoot, record)))) out(line);
  return 0;
}

function main(argv) {
  const [repoArgument, ...extra] = argv;
  if (argv.some((argument) => argument.startsWith('--')) || extra.length > 0) {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  process.exitCode = run({ repoRoot: resolve(repoArgument ?? '..'), out: console.log, err: console.error });
}

if (invokedDirectly(import.meta.filename, process.argv[1])) main(process.argv.slice(2));
