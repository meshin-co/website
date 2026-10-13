import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PENDING } from './mutation-pending.mjs';

const ARCHIVE_DATE = /^\d{4}-\d{2}-\d{2}-/;
const UNWAIVABLE = new Set([
  'gate:spec',
  'gate:docs',
  'gate:plan',
  'gate:skills',
  'gate:evidence',
  'gate:brand',
  'test:smoke',
]);

const cellsOf = (line) =>
  line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());

export function knownGapRows(markdown) {
  return markdown
    .split('\n')
    .filter((line) => line.trim().startsWith('|'))
    .map(cellsOf)
    .filter((cells) => cells[0] !== 'id' && !/^-+$/.test(cells[0] ?? ''));
}

export function knownGapsFindings(markdown) {
  const candidates = knownGapRows(markdown);

  const findings = [];
  for (const cells of candidates.filter((cells) => cells.length !== 5 && /^G\d+$/.test(cells[0] ?? ''))) {
    findings.push({
      rule: 'known-gap-malformed-row',
      detail: `docs/plan/reference/known-gaps.md row ${cells[0]} has ${cells.length} cells, not 5`,
    });
  }
  const rows = candidates.filter((cells) => cells.length === 5);
  const seen = new Set();
  for (const [id, , reason] of rows) {
    if (!id) {
      findings.push({
        rule: 'known-gap-missing-id',
        detail: 'docs/plan/reference/known-gaps.md has a row with no id',
      });
      continue;
    }
    if (seen.has(id)) {
      findings.push({
        rule: 'known-gap-duplicate-id',
        detail: `docs/plan/reference/known-gaps.md uses id ${id} more than once`,
      });
    }
    seen.add(id);
    if (!reason) {
      findings.push({
        rule: 'known-gap-empty-reason',
        detail: `docs/plan/reference/known-gaps.md row ${id} has no reason why it is not closed`,
      });
    }
  }
  return findings;
}

function stripYamlComments(workflow) {
  return workflow
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
}

function hasReason(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function auditOutputScriptNames(index) {
  const names = new Set();
  for (const line of index.split('\n')) {
    const cells = line.split('|').slice(1, -1);
    if (cells.length !== 3) continue;
    const [script, invokedBy, produces] = cells.map((cell) => cell.trim());
    if (!/^`[^`]+\.mjs`$/.test(script) || !produces.includes('audits/')) continue;
    for (const match of invokedBy.matchAll(/`([a-z]+(?::[a-z-]+)+)`/g)) names.add(match[1]);
  }
  return names;
}

function namesRequiringCi(scripts, index) {
  const names = new Set(gateNames(scripts));
  if ('test:smoke' in scripts) names.add('test:smoke');
  for (const name of auditOutputScriptNames(index)) {
    if (name in scripts) names.add(name);
  }
  return [...names];
}

const directoryNames = (dir) =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

export function changeDirectories(changesDir) {
  return {
    active: directoryNames(changesDir).filter((name) => name !== 'archive'),
    archived: directoryNames(join(changesDir, 'archive')),
  };
}

export function pendingChangeFindings(pending, { active, archived }) {
  const archivedAs = new Map(archived.map((dir) => [dir.replace(ARCHIVE_DATE, ''), dir]));
  const findings = [];
  for (const entry of pending) {
    if (archivedAs.has(entry.change)) {
      findings.push({
        rule: 'pending-specimen-change-archived',
        detail: `mutation-pending.mjs owes ${entry.gate} to ${entry.change}, which is archived as openspec/changes/archive/${archivedAs.get(entry.change)}/, so the specimen is overdue`,
      });
    } else if (!active.includes(entry.change)) {
      findings.push({
        rule: 'pending-specimen-unknown-change',
        detail: `mutation-pending.mjs owes ${entry.gate} to ${entry.change}, which names no change under openspec/changes/`,
      });
    }
    if (!hasReason(entry.reason)) {
      findings.push({
        rule: 'pending-specimen-no-reason',
        detail: `mutation-pending.mjs lists ${entry.gate} with no reason why its specimen is owed`,
      });
    }
  }
  return findings;
}

export function summaryLine({ scripts, gapRows, pending, findings }) {
  return `plan: ${scripts} scripts checked against ci.yml, ${gapRows} gap rows, ${pending} pending specimens, ${findings} findings`;
}

function main() {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const scripts = manifest.scripts;
  const localOnly = manifest.localOnlyGates ?? {};
  const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const scriptIndex = readFileSync(new URL('./README.md', import.meta.url), 'utf8');
  const playwrightConfig = readFileSync(new URL('../playwright.config.ts', import.meta.url), 'utf8');
  const installLines = [...workflow.matchAll(/npx playwright install[^\n]*/g)].map((match) => match[0]);
  const knownGaps = readFileSync(new URL('../../docs/plan/reference/known-gaps.md', import.meta.url), 'utf8');
  const changes = changeDirectories(fileURLToPath(new URL('../../openspec/changes', import.meta.url)));

  const findings = [
    ...staleGateDeclarations(scripts, localOnly).map((gate) => ({
      rule: 'stale-gate-declaration',
      detail: `package.json declares ${gate} local-only, but no such gate exists`,
    })),
    ...unwaivableGates(localOnly).map((gate) => ({
      rule: 'unwaivable-gate-declared-local-only',
      detail: `package.json waives ${gate} out of CI; a harness-integrity gate has no waiver`,
    })),
    ...gatesMissingFromCi(scripts, workflow, localOnly, scriptIndex).map((gate) => ({
      rule: 'gate-not-in-ci',
      detail: `${gate} is defined in package.json but never runs in ci.yml; L36 says a gate not in ci.yml is not a gate`,
    })),
    ...gatesCitedButUndefined(scripts, scriptIndex).map((gate) => ({
      rule: 'gate-undefined',
      detail: `scripts/README.md names ${gate}, which package.json does not define`,
    })),
    ...browsersMissingFromCi(playwrightConfig, installLines).map((browser) => ({
      rule: 'browser-not-installed',
      detail: `playwright.config.ts runs a ${browser} project, and at least one npx playwright install line in ci.yml does not include it`,
    })),
    ...knownGapsFindings(knownGaps),
    ...pendingChangeFindings(PENDING, changes),
  ];

  for (const finding of findings) console.error(`PLAN ${finding.rule} ${finding.detail}`);
  console.log(
    summaryLine({
      scripts: namesRequiringCi(scripts, scriptIndex).length,
      gapRows: knownGapRows(knownGaps).length,
      pending: PENDING.length,
      findings: findings.length,
    })
  );
  if (findings.length > 0) process.exitCode = 1;
}

if (import.meta.filename === process.argv[1]) main();

function gateNames(scripts) {
  return Object.keys(scripts).filter((name) => name.startsWith('gate:'));
}

export function gatesMissingFromCi(scripts, workflow, localOnly = {}, index = '') {
  const cleanWorkflow = stripYamlComments(workflow);
  return namesRequiringCi(scripts, index)
    .filter((gate) => !new RegExp(`npm run ${gate}(?![\\w:-])`).test(cleanWorkflow))
    .filter((gate) => !hasReason(localOnly[gate]));
}

export function staleGateDeclarations(scripts, localOnly = {}) {
  return Object.keys(localOnly).filter((gate) => !(gate in scripts));
}

export function unwaivableGates(localOnly = {}) {
  return Object.keys(localOnly).filter((gate) => UNWAIVABLE.has(gate));
}

export function gatesCitedButUndefined(scripts, index) {
  const cited = [...index.matchAll(/`(gate:[a-z:-]+)`/g)].map(([, gate]) => gate);
  const defined = new Set(gateNames(scripts));
  return [...new Set(cited)].filter((gate) => !defined.has(gate));
}

export function browsersMissingFromCi(playwrightConfig, ciInstallLines) {
  const lines = Array.isArray(ciInstallLines) ? ciInstallLines : [ciInstallLines];
  const browserOf = { Safari: 'webkit', Firefox: 'firefox', Chrome: 'chromium' };
  const deviceBrowsers = Object.entries(browserOf)
    .filter(([device]) => playwrightConfig.includes(device))
    .map(([, browser]) => browser);
  const explicitBrowsers = [...playwrightConfig.matchAll(/browserName:\s*['"](webkit|firefox|chromium)['"]/g)].map(
    (match) => match[1]
  );
  const needed = new Set([...deviceBrowsers, ...explicitBrowsers]);
  return [...needed].filter((browser) => lines.length === 0 || lines.some((line) => !line.includes(browser)));
}
