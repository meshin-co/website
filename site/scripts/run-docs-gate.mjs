import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  citedCommands,
  discoverDocs,
  citedPaths,
  emptyDiscoveryFinding,
  enforcesRowRange,
  ignoredCitation,
  isBuildOutput,
  isExternal,
  isRecord,
  lockedRowClaims,
  mayBeRecord,
  parseIgnoreReport,
  resolveCandidates,
  summaryLine,
} from './docs-gate.mjs';

const repo = resolve(process.argv[2] ?? '..');

const walkMarkdown = (dir, prefix = '') => {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...walkMarkdown(join(dir, entry.name), relative));
    else if (entry.name.endsWith('.md')) found.push(relative);
  }
  return found;
};

const tracked = discoverDocs(
  () =>
    execFileSync('git', ['-C', repo, 'ls-files', '*.md'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
      .split('\n')
      .filter(Boolean),
  () => walkMarkdown(repo)
);

const docs = tracked.map((path) => join(repo, path)).filter((path) => existsSync(path));
const buildPresent = existsSync(join(repo, 'site/dist'));

const ignoredPaths = (paths) => {
  if (paths.length === 0) return new Map();
  try {
    const output = execFileSync('git', ['-C', repo, 'check-ignore', '--stdin', '-z', '-v'], {
      encoding: 'utf8',
      input: paths.join('\0'),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return parseIgnoreReport(output);
  } catch (error) {
    return error.status === 1 ? new Map() : null;
  }
};

const scripts = JSON.parse(readFileSync(join(repo, 'site/package.json'), 'utf8')).scripts;
const lockedRows = readFileSync(join(repo, 'docs/plan/reference/locked-decisions.md'), 'utf8');
const highestRow = Math.max(...[...lockedRows.matchAll(/^\| L(\d+)/gm)].map(([, number]) => Number(number)));

const findings = [];
const skippedBuildOutput = [];
let recordCount = 0;
const resolvedCitations = [];

const emptyFinding = emptyDiscoveryFinding(docs.length);
if (emptyFinding) findings.push(emptyFinding);

for (const doc of docs) {
  const text = readFileSync(doc, 'utf8');
  const relative = doc.slice(repo.length + 1);
  if (mayBeRecord(relative) && isRecord(text)) {
    recordCount += 1;
    continue;
  }

  for (const cited of citedPaths(text)) {
    if (isExternal(cited)) continue;
    if (isBuildOutput(cited) && !buildPresent) {
      skippedBuildOutput.push({ doc: relative, detail: cited });
      continue;
    }
    const present = resolveCandidates(cited, relative).filter((candidate) => {
      const absolute = join(repo, candidate);
      return existsSync(absolute) && statSync(absolute).isFile();
    });
    if (present.length === 0) {
      findings.push({ doc: relative, rule: 'dead-path', detail: cited });
      continue;
    }
    if (!isBuildOutput(cited)) resolvedCitations.push({ doc: relative, cited, present });
  }

  for (const command of citedCommands(text)) {
    if (scripts[command]) continue;
    findings.push({ doc: relative, rule: 'dead-command', detail: `npm run ${command}` });
  }

  for (const claimed of enforcesRowRange(relative) ? lockedRowClaims(text) : []) {
    if (claimed === highestRow) continue;
    findings.push({
      doc: relative,
      rule: 'stale-row-range',
      detail: `claims L1-L${claimed}, the reference holds L1-L${highestRow}`,
    });
  }
}

const ignoreReport = ignoredPaths([...new Set(resolvedCitations.flatMap(({ present }) => present))]);
for (const { doc, cited, present } of resolvedCitations) {
  const detail = ignoreReport && ignoredCitation(cited, present, ignoreReport);
  if (detail) findings.push({ doc, rule: 'ignored-path', detail });
}

console.log(
  summaryLine({
    fileCount: docs.length - recordCount,
    findingCount: findings.length,
    skippedBuildOutputCount: skippedBuildOutput.length,
    recordCount,
    ignoreCheckSkipped: ignoreReport === null,
  })
);
for (const finding of findings) console.log(`  ${finding.rule} ${finding.doc}: ${finding.detail}`);
for (const skipped of skippedBuildOutput) console.log(`  build-output-unverified ${skipped.doc}: ${skipped.detail}`);
process.exitCode = findings.length === 0 ? 0 : 1;
