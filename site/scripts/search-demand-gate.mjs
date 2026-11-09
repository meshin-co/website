import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { discoverDocs, isRecord, mayBeRecord } from './docs-gate.mjs';
import { parsePrompts } from './geo-baseline.mjs';
import { readEngineConfig } from './engine-config.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { tablesIn } from './markdown-table.mjs';
import { ageInDays, measuredDate, staleFindings as staleFindingsFor } from './report-freshness.mjs';
import { wonClaims } from './search-demand-claims.mjs';

const REPORT = 'audits/search-demand.md';
const CORE = 'docs/SEMANTIC-CORE.md';
const REFRESH = 'npm run audit:demand';
const ARCHIVE = 'openspec/changes/archive/';
export const MAX_AGE_DAYS = readEngineConfig().demand.maxAgeDays;

const PROMPT_COLUMNS = ['#', 'Prompt', 'Impressions'];
const listed = (names) => `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

const plain = (text) =>
  text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

function impressionsOf(cell) {
  if (/^unproven$/i.test(cell)) return 0;
  return /^\d+$/.test(cell) ? Number(cell) : null;
}

export function parseDemandReport(markdown) {
  const table = tablesIn(markdown).find(({ header }) => PROMPT_COLUMNS.every((name) => header.includes(name)));
  const [numberAt, promptAt, impressionsAt] = PROMPT_COLUMNS.map((name) => table?.header.indexOf(name));
  const rows = (table?.rows ?? [])
    .filter((cells) => /^\d+$/.test(cells[numberAt] ?? ''))
    .map((cells) => ({
      number: Number(cells[numberAt]),
      prompt: cells[promptAt] ?? '',
      impressions: impressionsOf(cells[impressionsAt] ?? ''),
    }));
  return { measured: measuredDate(markdown), rows };
}

const finding = (rule, path, detail, line) => ({ rule, path, detail, ...(line ? { line } : {}) });

export const staleFindings = (measured, today) =>
  staleFindingsFor({ measured, today, report: REPORT, refresh: REFRESH, maxAgeDays: MAX_AGE_DAYS });

const rowFor = (prompt, rows) =>
  rows.find(
    (row) => row.number === prompt.number && row.impressions !== null && plain(row.prompt) === plain(prompt.prompt)
  );

export const promptsWithRows = (prompts, rows) => prompts.filter((prompt) => rowFor(prompt, rows));

const routeOf = (prompt) => (prompt.mustWin ? `must win ${prompt.mustWin}` : 'no must-win route');

function whyNoRow(prompt, rows) {
  const sameNumber = rows.find((row) => row.number === prompt.number);
  if (!sameNumber) return '';
  if (plain(sameNumber.prompt) !== plain(prompt.prompt))
    return `; its row ${prompt.number} names "${sameNumber.prompt}"`;
  return `; its row ${prompt.number} has an Impressions cell that is neither a count nor "unproven"`;
}

export function rowFindings(prompts, rows) {
  if (prompts.length === 0)
    return [finding('prompt-without-row', CORE, `no buyer prompts parsed from ${CORE}, so no prompt was checked`)];
  if (rows.length === 0)
    return [
      finding(
        'prompt-without-row',
        REPORT,
        `no per-prompt table (a header with the cells ${listed(PROMPT_COLUMNS)}) in ${REPORT}, so all ${prompts.length} core prompts have no row`
      ),
    ];
  return prompts
    .filter((prompt) => !rowFor(prompt, rows))
    .map((prompt) =>
      finding(
        'prompt-without-row',
        CORE,
        `prompt ${prompt.number} "${prompt.prompt}" (${routeOf(prompt)}) has no row in ${REPORT}${whyNoRow(prompt, rows)}`
      )
    );
}

function outrunsData(number, prompts, rows) {
  const prompt = prompts.find((candidate) => candidate.number === number);
  const row = prompt && rowFor(prompt, rows);
  if (!row) return 'has no row for it';
  if (row.impressions > 0) return null;
  return `records 0 impressions for it ("${prompt.prompt}", ${routeOf(prompt)})`;
}

export function claimFindings(documents, prompts, rows) {
  const findings = [];
  for (const { path, text } of documents) {
    const named = new Set();
    for (const { line, numbers } of wonClaims(text)) {
      for (const number of numbers.filter((candidate) => !named.has(candidate))) {
        named.add(number);
        const problem = outrunsData(number, prompts, rows);
        if (problem)
          findings.push(
            finding('claim-outruns-data', path, `says prompt ${number} is won, but ${REPORT} ${problem}`, line)
          );
      }
    }
  }
  return findings;
}

export const readsForClaims = (path, text) => !path.startsWith(ARCHIVE) && !(mayBeRecord(path) && isRecord(text));

export function demandFindings({ report, prompts, documents, today }) {
  const { measured, rows } = parseDemandReport(report);
  return [...staleFindings(measured, today), ...rowFindings(prompts, rows), ...claimFindings(documents, prompts, rows)];
}

export function summaryLine({ measured, today, covered, total, documents, findings }) {
  const age =
    measured === null
      ? `has no measured date (limit ${MAX_AGE_DAYS} days)`
      : `measured ${measured} (${ageInDays(measured, today)} days old, limit ${MAX_AGE_DAYS})`;
  return `demand: ${REPORT} ${age}, ${covered} of ${total} core prompts have a row, ${documents} documents read for won-claims, ${findings} findings`;
}

const readIfPresent = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

function walkMarkdown(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.git' || entry.name === 'node_modules') return [];
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return walkMarkdown(join(dir, entry.name), path);
    return entry.name.endsWith('.md') ? [path] : [];
  });
}

function readDocuments(repo) {
  const paths = discoverDocs(
    () =>
      execFileSync('git', ['-C', repo, 'ls-files', '*.md'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
        .split('\n')
        .filter(Boolean),
    () => walkMarkdown(repo)
  );
  return paths
    .filter((path) => existsSync(join(repo, path)))
    .map((path) => ({ path, text: readFileSync(join(repo, path), 'utf8') }))
    .filter(({ path, text }) => readsForClaims(path, text));
}

function main(repoArg) {
  const repo = resolve(repoArg ?? '..');
  const prompts = parsePrompts(readIfPresent(join(repo, CORE)));
  const report = readIfPresent(join(repo, REPORT));
  const documents = readDocuments(repo);
  const today = new Date().toISOString().slice(0, 10);

  const findings = demandFindings({ report, prompts, documents, today });
  const { measured, rows } = parseDemandReport(report);

  for (const { rule, path, line, detail } of findings)
    console.error(`DEMAND ${rule} ${path}${line ? `:${line}` : ''}: ${detail}`);
  console.log(
    summaryLine({
      measured,
      today,
      covered: promptsWithRows(prompts, rows).length,
      total: prompts.length,
      documents: documents.length,
      findings: findings.length,
    })
  );
  process.exitCode = findings.length === 0 ? 0 : 1;
}

if (invokedDirectly(import.meta.filename, process.argv[1])) main(process.argv[2]);
