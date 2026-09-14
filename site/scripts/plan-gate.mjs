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
  const findings = [...statusFindings(phases), ...indexFindings({ listed, present: [...new Set(present)] })];

  for (const finding of findings) console.error(`PLAN ${finding.rule} ${finding.detail}`);
  console.log(`plan: ${present.length} phase files, ${findings.length} findings`);
  if (findings.length > 0) process.exitCode = 1;
}

if (import.meta.filename === process.argv[1]) main();
