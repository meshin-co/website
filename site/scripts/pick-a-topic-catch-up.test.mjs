import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';

import { newClaim, writeClaim } from './autowriter-claim-store.mjs';
import { unprovenPrompt, reportText, withPickRepo } from './fixtures/pick-scene.mjs';
import { recordPath } from './record-layout.mjs';

const SCHEDULE = { times: ['03:17', '15:17'], catchUpMinutes: [120, 240] };
const REPORT = reportText({ prompts: [unprovenPrompt(1, 'fractional CAIO pricing')] });
const OUTPUT = 'out/decision.json';

async function pickAt(now, { before = [] } = {}) {
  return withPickRepo({ report: REPORT }, async (picker) => {
    for (const [slug, at] of before) {
      const claimedAt = new Date(at);
      const claim = newClaim({
        slug,
        title: `Earlier ${slug}`,
        format: 'article',
        query: 'an earlier query',
        demand: { impressions: 0, position: null },
        origin: 'category',
        category: 'governance',
        runId: `run-${slug}`,
        now: claimedAt,
      });
      writeClaim(join(picker.root, recordPath('claim', slug, claimedAt)), claim);
    }
    const picked = await picker.run(['--write', '--output', join(picker.root, OUTPUT)], {
      now: () => new Date(now),
      schedule: SCHEDULE,
    });
    assert.equal(picked.exit, 0, picked.stderr.join('\n'));
    return picker.json(OUTPUT);
  });
}

test('a run that starts two hours after a slot nothing filled files claims that say it is a catch-up of that slot', async () => {
  const decision = await pickAt('2026-11-05T05:17:04Z');
  assert.equal(decision.decision, 'write');
  for (const { claim } of decision.entries) assert.deepEqual(claim.catchUp, { slot: '03:17', lateMinutes: 120 });
});

test('a run on time files claims with no catchUp key, and the origin of the topic is untouched', async () => {
  const decision = await pickAt('2026-11-05T03:20:00Z');
  const [{ claim }] = decision.entries;
  assert.equal(Object.hasOwn(claim, 'catchUp'), false);
  assert.equal(claim.origin, 'demand');
});

test('the second slot caught up is named for the second slot when the first already has its article', async () => {
  const decision = await pickAt('2026-11-05T17:17:30Z', { before: [['first-of-the-day', '2026-11-05T03:20:00Z']] });
  assert.deepEqual(decision.entries[0].claim.catchUp, { slot: '15:17', lateMinutes: 120 });
});

test("yesterday's article does not hide today's missed slot", async () => {
  const decision = await pickAt('2026-11-05T05:17:04Z', { before: [['yesterdays', '2026-11-04T15:20:00Z']] });
  assert.deepEqual(decision.entries[0].claim.catchUp, { slot: '03:17', lateMinutes: 120 });
});
