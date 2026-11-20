import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { cleanup, world } from './fixtures/repair-world.mjs';
import { RepairStop } from './repair-outcome.mjs';
import { repairRun } from './repair-run.mjs';

after(cleanup);

const refusing = (...refused) => ({ judgeFindings: () => ({ rewrite: [], refused }), allowancesOf: () => [] });

const refusal = (overrides) => ({
  gate: 'gate:orphans',
  rule: 'chrome-only',
  subjects: ['/blog/a'],
  reason: 'not-prose',
  why: 'a person places the link.',
  ...overrides,
});

async function messageOf(...refused) {
  const { io, adapter } = world({ kinds: refusing(...refused) });
  try {
    await repairRun(io);
  } catch (error) {
    assert.ok(error instanceof RepairStop, error.stack);
    assert.equal(error.outcome, 'unrepairable');
    assert.equal(adapter.requests.length, 0);
    return error.message;
  }
  return assert.fail('expected the repair to stop');
}

test('a refusal names the gate, the rule, the reason, the page and why a rewrite cannot answer it', async () => {
  assert.equal(
    await messageOf(refusal()),
    'a rewrite cannot answer gate:orphans chrome-only (not-prose) on /blog/a: a person places the link.'
  );
});

test('two refusals are told apart and joined', async () => {
  const message = await messageOf(refusal(), refusal({ rule: 'orphans', subjects: ['/lonely'], why: 'x.' }));

  assert.equal(
    message,
    'a rewrite cannot answer gate:orphans chrome-only (not-prose) on /blog/a: a person places the link.; ' +
      'gate:orphans orphans (not-prose) on /lonely: x.'
  );
});

test('more than three pages are cut to three and a count of the rest', async () => {
  const message = await messageOf(refusal({ subjects: ['/a', '/b', '/c', '/d', '/e'] }));

  assert.match(message, /\(not-prose\) on \/a, \/b, \/c and 2 more: /);
});

test('a refusal that names no page says so by leaving the page out', async () => {
  const message = await messageOf(refusal({ subjects: [], reason: 'unattributed', why: 'nobody owns it.' }));

  assert.equal(message, 'a rewrite cannot answer gate:orphans chrome-only (unattributed): nobody owns it.');
});
