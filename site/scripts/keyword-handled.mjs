import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { invokedDirectly } from './invoked-directly.mjs';
import { readKeywordReport } from './keyword-report.mjs';

export const HANDLED_PATH = 'audits/keyword-handled.json';
export const GROWTH_FACTOR = 2;
export const GROWTH_FLOOR = 50;

const REPORT_PATH = 'audits/keyword-demand.md';
const FIELDS = ['phrase', 'route', 'impressions', 'handledOn', 'reason'];
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;
const USAGE = 'usage: node scripts/keyword-handled.mjs [--prune]';

function isDay(value) {
  if (typeof value !== 'string' || !CALENDAR_DAY.test(value)) return false;
  const day = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(value);
}
const isPlain = (value) => typeof value === 'string' && value !== '' && value.trim() === value;

const isText = (value) => typeof value === 'string' && value.trim() !== '';
const CHECKS = {
  phrase: [isPlain, 'phrase must be the phrase as audits/keyword-demand.md spells it, with no space around it'],
  route: [
    (value) => isPlain(value) && value.startsWith('/'),
    'route must be a route of the site, such as /glossary/evals',
  ],
  impressions: [
    (value) => Number.isSafeInteger(value) && value >= 1,
    'impressions must be a whole number of at least 1, the exact count when the pair was handled',
  ],
  handledOn: [isDay, 'handledOn must be a calendar day such as 2026-11-10'],
  reason: [isText, 'reason must say what was done to the route'],
};

const pairOf = ({ phrase, route }) => `${phrase}\u0000${route}`;

function rowProblems(row, index) {
  if (row === null || typeof row !== 'object' || Array.isArray(row)) return [`row ${index + 1}: is not an object`];
  const name = isText(row.phrase) ? `"${row.phrase}"` : `row ${index + 1}`;
  const extra = Object.keys(row).filter((field) => !FIELDS.includes(field));
  return [
    ...FIELDS.filter((field) => !CHECKS[field][0](row[field])).map((field) => `${name}: ${CHECKS[field][1]}`),
    ...extra.map((field) => `${name}: carries the field "${field}", which a row does not carry`),
  ];
}

function duplicateProblems(rows) {
  const seen = new Set();
  return rows.flatMap((row) => {
    const repeated = seen.has(pairOf(row));
    seen.add(pairOf(row));
    return repeated
      ? [`"${row.phrase}": the pair with ${row.route} is recorded twice; a pair has one record, updated in place`]
      : [];
  });
}

export function readingOf(text) {
  if (typeof text !== 'string' || text.trim() === '') return { rows: [], problems: [] };
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { rows: [], problems: [`is not JSON: ${error.message}`] };
  }
  if (!Array.isArray(parsed)) return { rows: [], problems: ['is not a JSON list of rows'] };
  const checked = parsed.map((row, index) => ({ row, problems: rowProblems(row, index) }));
  const rows = checked.filter(({ problems }) => problems.length === 0).map(({ row }) => row);
  return { rows, problems: [...checked.flatMap(({ problems }) => problems), ...duplicateProblems(rows)] };
}

function ledgerText(repoRoot) {
  try {
    return readFileSync(join(repoRoot, HANDLED_PATH), 'utf8');
  } catch {
    return '';
  }
}

export const readHandled = (repoRoot) => readingOf(ledgerText(repoRoot)).rows;

export const handledFindings = (text) =>
  readingOf(text).problems.map((detail) => ({ rule: 'handled-invalid', path: HANDLED_PATH, detail }));

const grew = (recorded, exact) => exact >= recorded * GROWTH_FACTOR && exact - recorded >= GROWTH_FLOOR;

export const isHandled = (rows, { phrase, route, exact }) =>
  rows.some((row) => row.phrase === phrase && row.route === route && !grew(row.impressions, exact));

export const deadRecords = (rows, candidates) =>
  rows.filter(({ phrase }) => !candidates.some((candidate) => candidate.phrase === phrase));

const counted = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

function reportOf(repoRoot) {
  try {
    return readKeywordReport(readFileSync(join(repoRoot, REPORT_PATH), 'utf8'));
  } catch {
    return readKeywordReport('');
  }
}

function deadLine({ phrase, route, handledOn }) {
  return `dead: "${phrase}", ${route}, handled ${handledOn}: no longer a candidate in ${REPORT_PATH}; delete the row, or run with --prune`;
}

export async function runCli(argv, io = {}) {
  const { repoRoot = resolve(import.meta.dirname, '..', '..'), stdout = console.log, stderr = console.error } = io;
  const unknown = argv.find((argument) => argument !== '--prune');
  if (unknown !== undefined) {
    stderr(`unknown argument ${unknown}. ${USAGE}`);
    return 1;
  }
  const { rows, problems } = readingOf(ledgerText(repoRoot));
  if (problems.length > 0) {
    problems.forEach((problem) => stderr(`${HANDLED_PATH}: ${problem}`));
    return 1;
  }
  const report = reportOf(repoRoot);
  if (report.measured === null && rows.length > 0) {
    stderr(
      `${REPORT_PATH} has no Measured day, so no phrase can be shown to have left it; make it with npm run audit:keywords`
    );
    return 1;
  }
  const dead = deadRecords(rows, report.candidates);
  const prune = argv.includes('--prune');
  if (!prune) dead.forEach((row) => stdout(deadLine(row)));
  if (prune && dead.length > 0) {
    writeFileSync(
      join(repoRoot, HANDLED_PATH),
      `${JSON.stringify(
        rows.filter((row) => !dead.includes(row)),
        null,
        2
      )}\n`
    );
  }
  const tally = `keyword-handled: ${counted(rows.length, 'record')}, ${dead.length} dead`;
  stdout(prune ? `${tally}, ${dead.length} pruned` : tally);
  return 0;
}

if (invokedDirectly(import.meta.filename, process.argv[1])) {
  process.exitCode = await runCli(process.argv.slice(2));
}
