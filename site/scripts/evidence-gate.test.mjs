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
