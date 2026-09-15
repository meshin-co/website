import assert from 'node:assert/strict';
import { test } from 'node:test';

import { catalogDriftFindings } from './catalog-drift.mjs';

test('a catalog description matching the built page is clean', () => {
  assert.deepEqual(
    catalogDriftFindings([{ path: '/x', description: 'The real description.' }], {
      '/x': { description: 'The real description.' },
    }),
    []
  );
});

test('a catalog description that drifted from the built page is a finding naming both', () => {
  const findings = catalogDriftFindings([{ path: '/x', description: 'The stale description.' }], {
    '/x': { description: 'The real description.' },
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].detail, /stale description/);
  assert.match(findings[0].detail, /real description/);
});

test('a catalog entry for a route that no longer builds is a finding, not a silent skip', () => {
  const findings = catalogDriftFindings([{ path: '/gone', description: 'x' }], {});
  assert.deepEqual(
    findings.map((finding) => finding.rule),
    ['catalog-route-missing']
  );
});

test('whitespace and curly quotes do not count as drift', () => {
  assert.deepEqual(
    catalogDriftFindings([{ path: '/x', description: "It's  a   description." }], {
      '/x': { description: 'It\u2019s a description.' },
    }),
    []
  );
});
