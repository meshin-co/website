import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ledgerFindings, mergeLedger } from './editorial-gate.mjs';

test('a fresh ledger keeps every row unreviewed, so the gate fails until the pass is done', () => {
  const findings = ledgerFindings({ rows: [{ text: 'a', status: 'unreviewed', usedIn: ['x'] }] });
  assert.equal(findings.length, 1);
  assert.match(findings[0], /unreviewed/);
});

test('shipped text that traces to no source row is its own finding', () => {
  const findings = ledgerFindings({ rows: [], untraceable: [{ route: '/x', text: 'ships untraceable' }] });
  assert.equal(findings.length, 1);
  assert.match(findings[0], /\/x/);
});

test('a dispositioned ledger with nothing unrowed passes', () => {
  assert.deepEqual(ledgerFindings({ rows: [{ text: 'a', status: 'verified', usedIn: ['x'] }] }), []);
});

test('re-running the extractors keeps the disposition already recorded for a text that has not changed', () => {
  const merged = mergeLedger(
    [{ text: 'unchanged', status: 'unreviewed', usedIn: ['a.astro'] }],
    [{ text: 'unchanged', status: 'rewritten', reason: 'tightened', usedIn: ['a.astro'] }]
  );
  assert.equal(merged[0].status, 'rewritten');
  assert.equal(merged[0].reason, 'tightened');
});

test('a text that changed since it was dispositioned comes back as unreviewed, because the disposition was about the old words', () => {
  const merged = mergeLedger(
    [{ text: 'new words', status: 'unreviewed', usedIn: ['a.astro'] }],
    [{ text: 'old words', status: 'verified', usedIn: ['a.astro'] }]
  );
  assert.deepEqual(
    merged.map((entry) => [entry.text, entry.status]),
    [['new words', 'unreviewed']]
  );
});
