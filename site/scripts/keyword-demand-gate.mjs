import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { readEngineConfig } from './engine-config.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { readKeywordReport } from './keyword-report.mjs';
import { ageInDays, measuredDate, staleFindings as staleFindingsFor } from './report-freshness.mjs';

const REPORT = 'audits/keyword-demand.md';
const REFRESH = 'npm run audit:keywords';
export const MAX_AGE_DAYS = readEngineConfig().keywords.maxAgeDays;

const PHRASE_COLUMNS = ['Phrase', 'Exact', 'Broad', 'Weeks', 'Served by'];
const listed = (names) => `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

const finding = (rule, path, detail) => ({ rule, path, detail });

const staleFindings = (measured, today) =>
  staleFindingsFor({ measured, today, report: REPORT, refresh: REFRESH, maxAgeDays: MAX_AGE_DAYS });

const unreadableFindings = (phrases) =>
  phrases.length > 0
    ? []
    : [
        finding(
          'report-unreadable',
          REPORT,
          `no phrase table (a header with the cells ${listed(PHRASE_COLUMNS)}), so a reader finds no phrase; make it with ${REFRESH}`
        ),
      ];

const oldestFirst = (a, b) => (a.measured < b.measured ? -1 : a.measured > b.measured ? 1 : 0);

function outdatedFindings(phrases, reportDate) {
  const outdated = phrases
    .filter(({ measured }) => measured !== null && ageInDays(measured, reportDate) > MAX_AGE_DAYS)
    .sort(oldestFirst);
  if (outdated.length === 0) return [];
  const [oldest] = outdated;
  return [
    finding(
      'phrase-stale',
      REPORT,
      `phrases older than the cache window: ${outdated.length}, the oldest measured ${oldest.measured} ("${oldest.phrase}"); the window is ${MAX_AGE_DAYS} days before the report's own date ${reportDate}, and a phrase that old is asked for again, so refresh with ${REFRESH}`
    ),
  ];
}

function undatedFindings(phrases) {
  const undated = phrases.filter(({ measured }) => measured === null);
  if (undated.length === 0) return [];
  return [
    finding(
      'phrase-stale',
      REPORT,
      `phrases with no readable Measured date: ${undated.length}, the first "${undated[0].phrase}", so their age cannot be shown; make it with ${REFRESH}`
    ),
  ];
}

const phraseAgeFindings = (phrases, reportDate) =>
  reportDate === null ? [] : [...outdatedFindings(phrases, reportDate), ...undatedFindings(phrases)];

const unaccounted = (detail) => [finding('report-unaccounted', REPORT, detail)];

function accountingFindings({ phrases, run, unmeasured }) {
  if (phrases.length === 0) return [];
  if (run === null) {
    return unaccounted(
      `no "Run:" line with the counts of phrases built, priced this run, carried from the cache and never answered, so a reader cannot tell what is missing; make it with ${REFRESH}`
    );
  }
  const withFigures = run.priced + run.carried;
  const agrees =
    withFigures === phrases.length &&
    run.unanswered === unmeasured.length &&
    run.built === withFigures + run.unanswered;
  return agrees
    ? []
    : unaccounted(
        `the Run line and the tables disagree: it counts ${run.built} built, ${withFigures} priced or carried and ${run.unanswered} never answered, while the tables hold ${phrases.length} priced and ${unmeasured.length} not measured; every phrase is priced, carried or named under Not measured, so make it with ${REFRESH}`
      );
}

export function keywordFindings({ report, today }) {
  const read = readKeywordReport(report);
  const reportDate = measuredDate(report);
  return [
    ...staleFindings(reportDate, today),
    ...unreadableFindings(read.phrases),
    ...phraseAgeFindings(read.phrases, reportDate),
    ...accountingFindings(read),
  ];
}

export function summaryLine({ measured, today, phrases, candidates, findings }) {
  const age =
    measured === null
      ? `has no measured date (limit ${MAX_AGE_DAYS} days)`
      : `measured ${measured} (${ageInDays(measured, today)} days old, limit ${MAX_AGE_DAYS})`;
  return `keywords: ${REPORT} ${age}, ${phrases} phrases, ${candidates} candidates, ${findings} findings`;
}

const readIfPresent = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

function main(repoArg) {
  const repo = resolve(repoArg ?? '..');
  const report = readIfPresent(join(repo, REPORT));
  const today = new Date().toISOString().slice(0, 10);

  const findings = keywordFindings({ report, today });
  const { phrases, candidates } = readKeywordReport(report);

  for (const { rule, path, detail } of findings) console.error(`KEYWORDS ${rule} ${path}: ${detail}`);
  console.log(
    summaryLine({
      measured: measuredDate(report),
      today,
      phrases: phrases.length,
      candidates: candidates.length,
      findings: findings.length,
    })
  );
  process.exitCode = findings.length === 0 ? 0 : 1;
}

if (invokedDirectly(import.meta.filename, process.argv[1])) main(process.argv[2]);
