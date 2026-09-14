import assert from 'node:assert/strict';
import { test } from 'node:test';

import { diffRoutes, phaseOrder } from './routes-gate.mjs';

test('a route that disappears without an explanation fails the gate', () => {
  const result = diffRoutes({ previous: ['/', '/blog'], current: ['/'], explained: [] });
  assert.deepEqual(result.unexplained, ['/blog']);
  assert.equal(result.ok, false);
});

test('a disappearance listed as explained passes', () => {
  const result = diffRoutes({ previous: ['/', '/speaking'], current: ['/'], explained: ['/speaking'] });
  assert.deepEqual(result.unexplained, []);
  assert.equal(result.ok, true);
});

test('an explanation for a route that still exists is rejected as stale', () => {
  const result = diffRoutes({ previous: ['/', '/blog'], current: ['/', '/blog'], explained: ['/blog'] });
  assert.deepEqual(result.staleExplanations, ['/blog']);
  assert.equal(result.ok, false);
});

test('growth alone passes', () => {
  const result = diffRoutes({ previous: ['/'], current: ['/', '/faq'], explained: [] });
  assert.deepEqual(result.added, ['/faq']);
  assert.equal(result.ok, true);
});

test('no previous phase means nothing to prove', () => {
  const result = diffRoutes({ previous: null, current: ['/'], explained: [] });
  assert.equal(result.ok, true);
  assert.equal(result.baseline, true);
});

test('phases sort by numeric position, not string order', () => {
  assert.deepEqual(phaseOrder(['phase-10', 'phase-2', 'phase-4.5', 'phase-4']), [
    'phase-2',
    'phase-4',
    'phase-4.5',
    'phase-10',
  ]);
});
