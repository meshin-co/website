import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { brandFromDisk, titleSuffix } from '../src/utils/brand.mjs';
import { claimFileProblem, generatedTitles, isHolding, titleCollisions, validateClaim } from './autowriter-claims.mjs';
import { attemptCapProblem, deliveryProblems, fileStemProblem, validateLedger } from './autowriter-ledger.mjs';
import { bandRecordFindings, committedBand, generationReport } from './autowriter-record-rules.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { historyReport, skippedLine } from './autowriter-refusal-rules.mjs';
import { REQUIRED_JOBS } from './ci-aggregate.mjs';
import { WORKFLOW_PATH, aggregateWiringFindings } from './ci-aggregate-wiring.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { filingProblems, recordFiles } from './record-layout.mjs';

const CORE_PATH = 'docs/SEMANTIC-CORE.md';
const CONFIG_PATH = 'site/src/config.yaml';

const finding = (rule, path, detail) => ({ rule, path, detail });

function parsed({ path, text }) {
  try {
    return { path, value: JSON.parse(text) };
  } catch (error) {
    return { path, failure: error.message };
  }
}

const schemaFindings = (rule, path, problems) =>
  problems.map((problem) => finding(rule, path, describeProblem(problem)));

function ledgerFindings({ path, value: ledger, failure }) {
  if (failure !== undefined) return [finding('ledger-unreadable', path, `not readable JSON: ${failure}`)];
  const shape = validateLedger(ledger);
  if (shape.length > 0) return schemaFindings('ledger-schema', path, shape);
  return [
    ...[fileStemProblem(path, ledger)].filter(Boolean).map((detail) => finding('ledger-name', path, detail)),
    ...[attemptCapProblem(ledger)].filter(Boolean).map((detail) => finding('attempt-cap', path, detail)),
    ...schemaFindings('escalation-undelivered', path, deliveryProblems(ledger)),
  ];
}

function claimFindings({ path, value: claim, failure }) {
  if (failure !== undefined) return [finding('claim-unreadable', path, `not readable JSON: ${failure}`)];
  const shape = validateClaim(claim);
  if (shape.length > 0) return schemaFindings('claim-schema', path, shape);
  return [claimFileProblem(path, claim)].filter(Boolean).map((detail) => finding('claim-name', path, detail));
}

function readableTitles(core) {
  if (core === null) return { failure: `${CORE_PATH} is missing` };
  try {
    return { titles: generatedTitles(core) };
  } catch (error) {
    return { failure: error.message };
  }
}

function titleFindings({ core, claims, suffix, now }) {
  const { titles, failure } = readableTitles(core);
  if (failure !== undefined) return { titles: [], found: [finding('core-unreadable', CORE_PATH, failure)] };
  const empty =
    titles.length === 0
      ? [
          finding(
            'core-no-titles',
            CORE_PATH,
            'its generated layer lists no titles, so no claim can be checked against it'
          ),
        ]
      : [];
  const collisions = titleCollisions({ claims, generated: titles, suffix, now }).map(({ path, detail }) =>
    finding('title-collision', path, detail)
  );
  return { titles, found: [...empty, ...collisions] };
}

function workflowFindings(workflow) {
  if (workflow === null)
    return [
      finding(
        'workflow-unreadable',
        WORKFLOW_PATH,
        `${WORKFLOW_PATH} is missing, so no job carries the verdict of the required jobs`
      ),
    ];
  try {
    return aggregateWiringFindings(workflow).map(({ rule, detail }) => finding(rule, WORKFLOW_PATH, detail));
  } catch (error) {
    return [finding('workflow-unreadable', WORKFLOW_PATH, `not valid YAML: ${error.message}`)];
  }
}

export function autowriterReport({
  ledgers,
  claims,
  core,
  workflow,
  suffix,
  now,
  records = [],
  dispositions = [],
  readEntry = () => null,
  band = null,
  bandRecord = [],
  history = { findings: [], commits: null },
}) {
  const readClaims = claims.map(parsed);
  const valid = readClaims
    .filter(({ value }) => value !== undefined && validateClaim(value).length === 0)
    .filter(({ path, value }) => claimFileProblem(path, value) === null)
    .map(({ path, value }) => ({ path, claim: value }));
  const { titles, found } = titleFindings({ core, claims: valid, suffix, now });
  const filed = filingProblems({
    paths: [...ledgers, ...claims, ...records].map(({ path }) => path).concat(dispositions),
    claims: valid.map(({ claim }) => claim),
  });
  const findings = [
    ...ledgers.map(parsed).flatMap(ledgerFindings),
    ...readClaims.flatMap(claimFindings),
    ...filed.map(({ path, detail }) => finding('record-layout', path, detail)),
    ...found,
    ...workflowFindings(workflow),
    ...generationReport({ records, readEntry, band }),
    ...bandRecord,
    ...history.findings,
  ];
  const counts = {
    ledgers: ledgers.length,
    claims: claims.length,
    lapsed: valid.filter(({ claim }) => !isHolding(claim, now)).length,
    titles: titles.length,
    jobs: REQUIRED_JOBS.length,
    commits: history.commits,
    records: records.length,
    dispositions: dispositions.length,
  };
  return { findings, counts };
}

const commitsPhrase = (commits) =>
  typeof commits === 'number' ? `${commits} pipeline commits judged` : 'pipeline commits not judged';

export const summaryLine = ({ findings, counts }) =>
  `autowriter: ${counts.ledgers} ledgers, ${counts.claims} claims (${counts.lapsed} lapsed), ` +
  `${counts.titles} generated titles, ${counts.jobs} CI jobs under the aggregate check, ` +
  `${commitsPhrase(counts.commits)}, ${counts.records} generation records, ` +
  `${counts.dispositions} dispositions, ${findings.length} findings`;

const readIfPresent = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null);

const readJsonFiles = (repo, family) =>
  recordFiles(repo, family).map((path) => ({ path, text: readFileSync(join(repo, path), 'utf8') }));

function main(repoArgument) {
  const repo = resolve(repoArgument ?? '..');
  const history = historyReport({ root: repo });
  const report = autowriterReport({
    ledgers: readJsonFiles(repo, 'ledger'),
    claims: readJsonFiles(repo, 'claim'),
    records: readJsonFiles(repo, 'generation'),
    dispositions: recordFiles(repo, 'disposition'),
    readEntry: (path) => readIfPresent(join(repo, path)),
    band: committedBand(repo),
    bandRecord: bandRecordFindings(repo),
    core: readIfPresent(join(repo, CORE_PATH)),
    workflow: readIfPresent(join(repo, WORKFLOW_PATH)),
    suffix: titleSuffix(brandFromDisk(join(repo, CONFIG_PATH))),
    now: new Date(),
    history,
  });
  for (const { rule, path, detail } of report.findings) console.error(`AUTOWRITER ${rule} ${path}: ${detail}`);
  if (history.skipped !== null) console.log(skippedLine(history.skipped));
  console.log(summaryLine(report));
  process.exitCode = report.findings.length === 0 ? 0 : 1;
}

if (invokedDirectly(import.meta.filename, process.argv[1])) main(process.argv[2]);
