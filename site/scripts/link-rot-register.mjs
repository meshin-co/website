import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { SEARCH_ORIGIN, isSnapshotOf } from '../src/utils/archive-url.mjs';

export const REGISTER_PATH = 'audits/link-rot.json';
export const REGISTER_SCHEMA = 1;
export const OUTCOMES = ['archive', 'search', 'unplaced'];

const TOP_KEYS = ['schema', 'updatedOn', 'rows', 'digest'];
const ROW_KEYS = ['original', 'entry', 'outcome', 'replacement', 'citedOn', 'firstSeenDead', 'why'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DIGEST_MISMATCH =
  'the digest does not match its rows: the file was edited by hand, and only the link repair job writes it; restore it from git';

export class RegisterError extends Error {
  name = 'RegisterError';
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isDay = (value) => {
  if (typeof value !== 'string' || !DAY.test(value)) return false;
  const moment = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(moment.getTime()) && moment.toISOString().startsWith(value);
};
const isHttpAddress = (value) =>
  typeof value === 'string' && URL.canParse(value) && /^https?:$/.test(new URL(value).protocol);
const isRepositoryPath = (value) =>
  isText(value) && !value.startsWith('/') && !value.includes('\\') && !value.split('/').includes('..');

const keysOf = (row) => [...ROW_KEYS, ...(row?.outcome === 'unplaced' ? ['pages'] : [])];
const canonicalRow = (row) => Object.fromEntries(keysOf(row).map((key) => [key, row?.[key]]));
const sortKey = (row) => [row?.original ?? '', row?.entry ?? ''];

function compareRows(left, right) {
  const [leftOriginal, leftEntry] = sortKey(left);
  const [rightOriginal, rightEntry] = sortKey(right);
  if (leftOriginal !== rightOriginal) return leftOriginal < rightOriginal ? -1 : 1;
  if (leftEntry !== rightEntry) return leftEntry < rightEntry ? -1 : 1;
  return 0;
}

const keyOf = (row) => JSON.stringify([row.original, row.entry ?? null]);

export function digestOf({ updatedOn, rows }) {
  const canonical = JSON.stringify({ updatedOn, rows: (Array.isArray(rows) ? rows : []).map(canonicalRow) });
  return createHash('sha256').update(canonical).digest('hex');
}

export function sealRegister({ updatedOn, rows }) {
  const sorted = rows.map(canonicalRow).sort(compareRows);
  return { schema: REGISTER_SCHEMA, updatedOn, rows: sorted, digest: digestOf({ updatedOn, rows: sorted }) };
}

export const registerText = ({ schema, updatedOn, rows, digest }) =>
  `${JSON.stringify({ schema, updatedOn, rows: rows.map(canonicalRow), digest }, null, 2)}\n`;

function topLevelProblems(register) {
  const found = Object.keys(register)
    .filter((key) => !TOP_KEYS.includes(key))
    .map((key) => `the register has a key "${key}" that the writer never writes`);
  for (const key of TOP_KEYS.filter((name) => !Object.hasOwn(register, name))) found.push(`the register has no ${key}`);
  if (Object.hasOwn(register, 'schema') && register.schema !== REGISTER_SCHEMA)
    found.push(`schema must be ${REGISTER_SCHEMA}, got ${JSON.stringify(register.schema)}`);
  if (Object.hasOwn(register, 'updatedOn') && !isDay(register.updatedOn))
    found.push('updatedOn must be a calendar day written YYYY-MM-DD');
  if (Object.hasOwn(register, 'rows') && !Array.isArray(register.rows)) found.push('rows must be a list');
  if (Object.hasOwn(register, 'digest') && !SHA256.test(register.digest))
    found.push('the digest must be 64 lowercase hexadecimal characters');
  return found;
}

function keyProblems(row, at) {
  const allowed = keysOf(row);
  return [
    ...Object.keys(row)
      .filter((key) => !allowed.includes(key))
      .map((key) => `${at} has a key "${key}" that the writer never writes in this kind of row`),
    ...allowed.filter((key) => !Object.hasOwn(row, key)).map((key) => `${at} has no ${key}`),
  ];
}

function repairProblems(row, at) {
  const found = [];
  if (!isRepositoryPath(row.entry)) found.push(`${at}: entry must be a repository path of the entry that cites it`);
  if (!isDay(row.citedOn)) found.push(`${at}: citedOn must be the calendar day the source was cited`);
  if (row.outcome === 'archive' && !isSnapshotOf(row.replacement, row.original))
    found.push(`${at}: replacement must be a Wayback snapshot of the original`);
  if (
    row.outcome === 'search' &&
    !(typeof row.replacement === 'string' && row.replacement.startsWith(`${SEARCH_ORIGIN}?q=`))
  )
    found.push(`${at}: replacement must be a search link on ${SEARCH_ORIGIN}`);
  return found;
}

function unplacedProblems(row, at) {
  const found = [];
  for (const key of ['entry', 'replacement', 'citedOn'])
    if (row[key] !== null) found.push(`${at}: ${key} must be null, because nothing was placed`);
  const pages = row.pages;
  const sorted =
    Array.isArray(pages) && pages.every((page, index) => isText(page) && (index === 0 || pages[index - 1] < page));
  if (!Array.isArray(pages) || pages.length === 0 || !sorted)
    found.push(`${at}: pages must be a sorted list of the built routes that carry the address, each once`);
  return found;
}

function rowProblems(row, index, updatedOn) {
  const at = `rows[${index}]`;
  if (!isPlainObject(row)) return [`${at} is not an object`];
  if (!OUTCOMES.includes(row.outcome))
    return [`${at}: outcome must be one of ${OUTCOMES.join(', ')}, got ${JSON.stringify(row.outcome)}`];
  const found = keyProblems(row, at);
  if (!isHttpAddress(row.original)) found.push(`${at}: original must be an http or https address`);
  if (!isDay(row.firstSeenDead)) found.push(`${at}: firstSeenDead must be a calendar day written YYYY-MM-DD`);
  else if (isDay(updatedOn) && row.firstSeenDead > updatedOn)
    found.push(`${at}: firstSeenDead ${row.firstSeenDead} is after the day the register changed, ${updatedOn}`);
  if (!isText(row.why)) found.push(`${at}: why must say in words what happened`);
  found.push(...(row.outcome === 'unplaced' ? unplacedProblems(row, at) : repairProblems(row, at)));
  return found;
}

function orderProblems(rows) {
  const found = [];
  for (let index = 1; index < rows.length; index += 1) {
    const [before, row] = [rows[index - 1], rows[index]];
    if (!isPlainObject(before) || !isPlainObject(row)) continue;
    const order = compareRows(before, row);
    if (order === 0)
      found.push(
        `rows[${index}] repeats original ${row.original} for entry ${row.entry}, which rows[${index - 1}] already holds`
      );
    else if (order > 0)
      found.push(`rows are not sorted by original then entry: rows[${index}] belongs before rows[${index - 1}]`);
  }
  return found;
}

export function registerProblems(register) {
  if (!isPlainObject(register)) return ['the register is not a JSON object'];
  const found = topLevelProblems(register);
  if (!Array.isArray(register.rows)) return found;
  register.rows.forEach((row, index) => found.push(...rowProblems(row, index, register.updatedOn)));
  found.push(...orderProblems(register.rows));
  if (SHA256.test(register.digest) && register.digest !== digestOf(register)) found.push(DIGEST_MISMATCH);
  return found;
}

export function readRegister(repoRoot) {
  const path = join(repoRoot, REGISTER_PATH);
  if (!existsSync(path)) return { register: null, problems: [] };
  let register;
  try {
    register = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return { register: null, problems: [`${REGISTER_PATH} is not JSON: ${error.message}`] };
  }
  return { register, problems: registerProblems(register) };
}

export function writeRegister(repoRoot, text) {
  const path = join(repoRoot, REGISTER_PATH);
  mkdirSync(dirname(path), { recursive: true });
  const staged = `${path}.${process.pid}.tmp`;
  writeFileSync(staged, text);
  renameSync(staged, path);
}

export const isSameRow = (left, right) => JSON.stringify(canonicalRow(left)) === JSON.stringify(canonicalRow(right));

const sameRows = (left, right) =>
  left.length === right.length && left.every((row, index) => isSameRow(row, right[index]));

export function planRegister({ existing, found, settled = new Set(), today }) {
  if (!isDay(today)) throw new RegisterError(`today must be a calendar day written YYYY-MM-DD, got ${String(today)}`);
  const replaced = new Set(found.map(keyOf));
  const held = (existing?.rows ?? []).filter(
    (row) => !replaced.has(keyOf(row)) && !(row.outcome === 'unplaced' && settled.has(row.original))
  );
  const rows = [...held, ...found].map(canonicalRow).sort(compareRows);
  if (existing === null || existing === undefined) {
    if (rows.length === 0) return { changed: false, register: null, text: null };
  } else if (sameRows(existing.rows, rows)) {
    return { changed: false, register: existing, text: null };
  }
  const register = sealRegister({ updatedOn: today, rows });
  const problems = registerProblems(register);
  if (problems.length > 0)
    throw new RegisterError(`the planned register would fail its own guard: ${problems.join('; ')}`);
  return { changed: true, register, text: registerText(register) };
}

const countOf = (rows, outcome) => rows.filter((row) => row.outcome === outcome).length;
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

export function registerSummary(register) {
  if (register === null) return `link rot: no register yet (${REGISTER_PATH} is written by the repair job)`;
  const { rows, updatedOn } = register;
  return [
    `link rot: ${plural(countOf(rows, 'archive'), 'citation', 'citations')} repaired from the archive`,
    `${countOf(rows, 'search')} resting on a search link`,
    `${plural(countOf(rows, 'unplaced'), 'unplaced address', 'unplaced addresses')} (${REGISTER_PATH}, changed ${updatedOn})`,
  ].join(', ');
}
