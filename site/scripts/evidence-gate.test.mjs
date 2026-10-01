import assert from 'node:assert/strict';
import { test } from 'node:test';

import { provenanceFindings } from './evidence-gate.mjs';

const generated = (body) => `# Report\n\nGenerated from raw check output by \`scripts/report.mjs\`.\n\n${body}`;

test('a generated artefact that names no revision is a finding, because a stale report reads like a fresh one', () => {
  const findings = provenanceFindings([{ path: 'audits/phase-9/REPORT.md', text: generated('Result: PASS') }]);
  assert.deepEqual(
    findings.map(({ rule }) => rule),
    ['no-provenance']
  );
});

test('a generated artefact naming its revision passes', () => {
  const findings = provenanceFindings([
    { path: 'audits/phase-9/REPORT.md', text: generated('Generated-from: abc1234\n\nResult: PASS') },
  ]);
  assert.deepEqual(findings, []);
});

test('a hand-written document is not asked for provenance', () => {
  assert.deepEqual(provenanceFindings([{ path: 'docs/PRD.md', text: '# PRD\n\nHand written.' }]), []);
});

test('every markdown file under a phase directory needs a revision, even one that never says it is generated', () => {
  const findings = provenanceFindings([
    { path: 'audits/phase-0/BASELINE.md', text: '# Baseline\n\nMedian of 3 runs.\n' },
  ]);
  assert.deepEqual(
    findings.map(({ rule }) => rule),
    ['no-provenance']
  );
});

test('a file under a phase directory that names its revision passes', () => {
  const findings = provenanceFindings([
    { path: 'audits/phase-0/BASELINE.md', text: '# Baseline\n\nGenerated-from: 9fd5605\n\nMedian of 3 runs.\n' },
  ]);
  assert.deepEqual(findings, []);
});

test('records nested below a phase directory are covered, at the absolute paths the runner supplies', () => {
  const findings = provenanceFindings([
    { path: '/repo/audits/phase-4.5/adhd/kiss.md', text: '# ADHD branch\n' },
    { path: '/repo/audits/phase-4.5/adhd/rival.md', text: '# ADHD branch\n\nGenerated-from: 332b4c7\n' },
  ]);
  assert.deepEqual(
    findings.map(({ path }) => path),
    ['/repo/audits/phase-4.5/adhd/kiss.md']
  );
});

test('the hand-written audits README is not an artefact', () => {
  assert.deepEqual(provenanceFindings([{ path: 'audits/README.md', text: '# Audits\n' }]), []);
});
