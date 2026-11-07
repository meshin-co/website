import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { slotStanding } from './slot-standing.mjs';

const TIMES = ['03:17', '15:17'];
const DELAYS = [120, 240];

const claimAt = (claimedAt, extra = {}) => ({
  path: `audits/autowriter/claims/2026/11/${extra.slug ?? 'a-slug'}.json`,
  claim: { slug: 'a-slug', format: 'article', status: 'claimed', claimedAt, ...extra },
});

const standingAt = (now, claims = [], delays = DELAYS, forgivenPerDay = 0) =>
  slotStanding({ times: TIMES, catchUpMinutes: delays, claims, now: new Date(now), forgivenPerDay });

test('a slot GitHub never fired is due two hours late, and the run is labelled with the slot it fills and how late it is', () => {
  const found = standingAt('2026-11-05T05:17:04Z');
  assert.equal(found.due, true);
  assert.deepEqual(found.catchUp, { slot: '03:17', lateMinutes: 120 });
});

test('a slot that already produced an entry is not due again, so two slots never make three entries', () => {
  const claims = [claimAt('2026-11-05T03:20:00Z', { slug: 'first' })];
  const found = standingAt('2026-11-05T05:17:04Z', claims);
  assert.equal(found.due, false);
  assert.equal(found.catchUp, null);
});

test('a slot that ran on time is due with no catch-up label', () => {
  const found = standingAt('2026-11-05T03:20:00Z');
  assert.equal(found.due, true);
  assert.deepEqual(found.catchUp, null);
  assert.equal(found.slot, '03:17');
  assert.equal(found.lateMinutes, 3);
});

test('a run GitHub delayed by less than the first catch-up is still on time', () => {
  const found = standingAt('2026-11-05T05:16:59Z');
  assert.equal(found.due, true);
  assert.equal(found.catchUp, null);
  assert.equal(found.lateMinutes, 119);
});

test('the second slot is due when only the first has an entry, and its catch-up is named for the second slot', () => {
  const claims = [claimAt('2026-11-05T03:20:00Z', { slug: 'first' })];
  assert.deepEqual(standingAt('2026-11-05T15:30:00Z', claims).catchUp, null);
  assert.equal(standingAt('2026-11-05T15:30:00Z', claims).slot, '15:17');
  assert.deepEqual(standingAt('2026-11-05T17:17:30Z', claims).catchUp, { slot: '15:17', lateMinutes: 120 });
  assert.deepEqual(standingAt('2026-11-05T19:17:30Z', claims).catchUp, { slot: '15:17', lateMinutes: 240 });
});

test('both slots satisfied: every later attempt of the day is a no-op', () => {
  const claims = [
    claimAt('2026-11-05T03:20:00Z', { slug: 'first' }),
    claimAt('2026-11-05T15:20:00Z', { slug: 'second' }),
  ];
  for (const now of ['2026-11-05T17:17:00Z', '2026-11-05T19:17:00Z', '2026-11-05T23:59:00Z']) {
    assert.equal(standingAt(now, claims).due, false, now);
  }
});

test('the first slot missed and the second on time: one entry is owed at 15:17 and a second is owed after it', () => {
  assert.equal(standingAt('2026-11-05T15:20:00Z').slot, '03:17');
  const claims = [claimAt('2026-11-05T15:20:00Z', { slug: 'late-first' })];
  assert.equal(standingAt('2026-11-05T15:21:00Z', claims).due, true);
  assert.equal(standingAt('2026-11-05T15:21:00Z', claims).slot, '15:17');
});

test('an entry claimed yesterday does not satisfy today', () => {
  const claims = [claimAt('2026-11-04T23:59:59Z', { slug: 'yesterday' })];
  assert.equal(standingAt('2026-11-05T03:20:00Z', claims).due, true);
});

test('a glossary term claimed today is not an article, so it satisfies no slot', () => {
  const claims = [claimAt('2026-11-05T03:20:00Z', { slug: 'a-term', format: 'term' })];
  assert.equal(standingAt('2026-11-05T05:17:00Z', claims).due, true);
});

test('a claim whose write stopped is forgiven once, so the slot it held is owed again', () => {
  const stopped = claimAt('2026-11-05T03:20:00Z', { slug: 'stopped', status: 'abandoned' });
  const found = standingAt('2026-11-05T05:17:00Z', [stopped], DELAYS, 1);
  assert.equal(found.due, true);
  assert.equal(found.slot, '03:17');
  assert.equal(found.forgiven, 1);
});

test('a second stopped claim is not forgiven, so a model that keeps failing cannot spend all day', () => {
  const stopped = [
    claimAt('2026-11-05T03:20:00Z', { slug: 'stopped-once', status: 'abandoned' }),
    claimAt('2026-11-05T05:20:00Z', { slug: 'stopped-twice', status: 'abandoned' }),
  ];
  const found = standingAt('2026-11-05T07:17:00Z', stopped, DELAYS, 1);
  assert.equal(found.due, false);
  assert.equal(found.entries, 1);
  assert.equal(found.forgiven, 1);
});

test('the afternoon slot is still owed after a stopped morning run, because a day owes one entry per slot', () => {
  const stopped = [
    claimAt('2026-11-05T03:20:00Z', { slug: 'stopped-once', status: 'abandoned' }),
    claimAt('2026-11-05T05:20:00Z', { slug: 'stopped-twice', status: 'abandoned' }),
  ];
  const found = standingAt('2026-11-05T15:17:00Z', stopped, DELAYS, 1);
  assert.equal(found.due, true);
  assert.equal(found.slot, '15:17');
});

test('forgiving nothing keeps a stopped claim counting, so the day stops and the owner looks', () => {
  const stopped = claimAt('2026-11-05T03:20:00Z', { slug: 'stopped', status: 'abandoned' });
  assert.equal(standingAt('2026-11-05T05:17:00Z', [stopped], DELAYS, 0).due, false);
});

test('a written claim is never forgiven, so an entry the day produced is never written twice', () => {
  const written = claimAt('2026-11-05T03:20:00Z', { slug: 'written', status: 'written' });
  const found = standingAt('2026-11-05T05:17:00Z', [written], DELAYS, 1);
  assert.equal(found.due, false);
  assert.equal(found.forgiven, 0);
});

test('a claim before any slot has elapsed leaves the day owed nothing, so a run before 03:17 has nothing to catch up', () => {
  const found = standingAt('2026-11-05T01:00:00Z');
  assert.equal(found.due, false);
  assert.equal(found.catchUp, null);
});

test('with no catch-up configured a late run is due but never labelled', () => {
  const found = standingAt('2026-11-05T08:00:00Z', [], []);
  assert.equal(found.due, true);
  assert.equal(found.catchUp, null);
  assert.equal(found.lateMinutes, 283);
});

test('the same article claimed twice is one entry', () => {
  const claims = [claimAt('2026-11-05T03:20:00Z', { slug: 'same' }), claimAt('2026-11-05T03:25:00Z', { slug: 'same' })];
  assert.equal(standingAt('2026-11-05T15:30:00Z', claims).slot, '15:17');
});

test('three slots in a day owe three entries, and the count follows the configuration', () => {
  const three = (now, claims) =>
    slotStanding({ times: ['03:17', '11:17', '19:17'], catchUpMinutes: [60], claims, now: new Date(now) });
  const claims = [claimAt('2026-11-05T03:20:00Z', { slug: 'one' }), claimAt('2026-11-05T11:20:00Z', { slug: 'two' })];
  assert.equal(three('2026-11-05T19:20:00Z', claims).due, true);
  assert.equal(
    three('2026-11-05T19:20:00Z', [...claims, claimAt('2026-11-05T19:20:00Z', { slug: 'three' })]).due,
    false
  );
});

const afterLead = (now, claims = []) =>
  slotStanding({ times: ['06:00', '15:00'], catchUpMinutes: DELAYS, claims, now: new Date(now) });

test('a run on time at 22:40, the cron of the 06:00 slot set 440 minutes before it, lands on the evening before the slot and writes no extra article when that day holds both its entries', () => {
  const claims = [
    claimAt('2026-11-06T06:02:10Z', { slug: 'morning' }),
    claimAt('2026-11-06T15:01:30Z', { slug: 'afternoon' }),
  ];
  const found = afterLead('2026-11-06T22:40:00Z', claims);
  assert.deepEqual([found.day, found.passed, found.entries, found.due, found.slot], ['2026-11-06', 2, 2, false, null]);
});

test('the same run is owed the entry of the afternoon slot when that day holds only one, because a day owes one entry for each slot that has passed and no more', () => {
  const found = afterLead('2026-11-06T22:40:00Z', [claimAt('2026-11-06T06:02:10Z', { slug: 'morning' })]);
  assert.deepEqual([found.due, found.slot, found.lateMinutes], [true, '15:00', 460]);
});

test('a run that starts before the first slot of its day owes nothing even when the day holds no entry, and the slot is owed from its own minute', () => {
  assert.equal(afterLead('2026-11-07T05:37:00Z').due, false);
  assert.equal(afterLead('2026-11-07T05:59:59Z').due, false);
  const found = afterLead('2026-11-07T06:00:00Z');
  assert.deepEqual([found.due, found.slot, found.lateMinutes, found.catchUp], [true, '06:00', 0, null]);
});
