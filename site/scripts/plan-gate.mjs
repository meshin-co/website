import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PLAN_DIR = resolve(process.cwd(), '..', 'docs', 'plan');
const STATUSES = new Set(['done', 'active', 'next', 'planned', 'dropped']);
const SINGLETONS = [
  ['active', 'multiple-active'],
  ['next', 'multiple-next'],
];

export function parseStatus(file) {
  const match = /\.([a-z]+)\.md$/.exec(file);
  return match ? match[1] : null;
}

export function statusFindings(phases) {
  const findings = [];
  for (const phase of phases) {
    if (!STATUSES.has(phase.status)) {
      findings.push({
        rule: 'unknown-status',
        detail: `${phase.file} carries status "${phase.status}", not one of ${[...STATUSES].join(', ')}`,
      });
    }
  }
  for (const [status, rule] of SINGLETONS) {
    const held = phases.filter((phase) => phase.status === status);
    if (held.length > 1) {
      findings.push({ rule, detail: `${held.map((phase) => phase.file).join(', ')} are all ${status}` });
    }
  }
  return findings;
}

export function indexFindings({ listed, present }) {
  const findings = [];
  for (const file of present) {
    if (!listed.includes(file)) {
      findings.push({ rule: 'unlisted-phase', detail: `${file} exists but docs/plan/INDEX.md never lists it` });
    }
  }
  for (const file of listed) {
    if (!present.includes(file)) {
      findings.push({ rule: 'missing-phase', detail: `docs/plan/INDEX.md lists ${file}, which does not exist` });
    }
  }
  return findings;
}

function main() {
  const present = readdirSync(join(PLAN_DIR, 'phases')).filter((name) => name.endsWith('.md'));
  const index = readFileSync(join(PLAN_DIR, 'INDEX.md'), 'utf8');
  const listed = [...index.matchAll(/\(phases\/([^)]+\.md)\)/g)].map((match) => match[1]);

  const phases = present.map((file) => ({ file, status: parseStatus(file) }));

  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const scripts = manifest.scripts;
  const localOnly = manifest.localOnlyGates ?? {};
  const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const scriptIndex = readFileSync(new URL('./README.md', import.meta.url), 'utf8');
  const playwrightConfig = readFileSync(new URL('../playwright.config.ts', import.meta.url), 'utf8');
  const installLine = /npx playwright install[^\n]*/.exec(workflow)?.[0] ?? '';

  const findings = [
    ...statusFindings(phases),
    ...indexFindings({ listed, present: [...new Set(present)] }),
    ...staleGateDeclarations(scripts, localOnly).map((gate) => ({
      rule: 'stale-gate-declaration',
      detail: `package.json declares ${gate} local-only, but no such gate exists`,
    })),
    ...gatesMissingFromCi(scripts, workflow, localOnly).map((gate) => ({
      rule: 'gate-not-in-ci',
      detail: `${gate} is defined in package.json but never runs in ci.yml; L36 says a gate not in ci.yml is not a gate`,
    })),
    ...gatesCitedButUndefined(scripts, scriptIndex).map((gate) => ({
      rule: 'gate-undefined',
      detail: `scripts/README.md names ${gate}, which package.json does not define`,
    })),
    ...browsersMissingFromCi(playwrightConfig, installLine).map((browser) => ({
      rule: 'browser-not-installed',
      detail: `playwright.config.ts runs a ${browser} project, and ci.yml installs only: ${installLine || 'nothing'}`,
    })),
  ];

  for (const finding of findings) console.error(`PLAN ${finding.rule} ${finding.detail}`);
  console.log(`plan: ${present.length} phase files, ${findings.length} findings`);
  if (findings.length > 0) process.exitCode = 1;
}

if (import.meta.filename === process.argv[1]) main();

function gateNames(scripts) {
  return Object.keys(scripts).filter((name) => name.startsWith('gate:'));
}

export function gatesMissingFromCi(scripts, workflow, localOnly = {}) {
  return gateNames(scripts)
    .filter((gate) => !new RegExp(`npm run ${gate}(?![\\w:-])`).test(workflow))
    .filter((gate) => !localOnly[gate]);
}

export function staleGateDeclarations(scripts, localOnly = {}) {
  const defined = new Set(gateNames(scripts));
  return Object.keys(localOnly).filter((gate) => !defined.has(gate));
}

export function gatesCitedButUndefined(scripts, index) {
  const cited = [...index.matchAll(/`(gate:[a-z:-]+)`/g)].map(([, gate]) => gate);
  const defined = new Set(gateNames(scripts));
  return [...new Set(cited)].filter((gate) => !defined.has(gate));
}

export function browsersMissingFromCi(playwrightConfig, ciInstallLine) {
  const browserOf = { 'Desktop Safari': 'webkit', 'Desktop Firefox': 'firefox', 'Desktop Chrome': 'chromium' };
  const needed = new Set(
    Object.entries(browserOf)
      .filter(([device]) => playwrightConfig.includes(device))
      .map(([, browser]) => browser)
  );
  return [...needed].filter((browser) => !ciInstallLine.includes(browser));
}
