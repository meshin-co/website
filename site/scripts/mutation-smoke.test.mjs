import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { FAMILIES, label, manifestFamilies, provesOf, stalePending, tally, unprovenGates } from './mutation-smoke.mjs';
import { PENDING } from './mutation-pending.mjs';
import { SPECIMENS } from './mutation-specimens.mjs';

const packageScripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts;

test('every gate:* script is proven by a family or named as pending with the phase that adds it', () => {
  assert.deepEqual(unprovenGates(packageScripts, manifestFamilies(FAMILIES), PENDING), []);
});

test('a gate with no family and no pending entry is reported, and a pending one is not', () => {
  const scripts = { 'gate:a': 'x', 'gate:b': 'x', 'gate:c': 'x', build: 'x' };
  const families = [{ id: 'f', kind: 'pure', proves: 'gate:a' }];
  const pending = [{ gate: 'gate:c', phase: 'phase-5', reason: 'no baselines yet' }];
  assert.deepEqual(unprovenGates(scripts, families, pending), ['gate:b']);
});

test('a specimen family proves the gate its specimen runs, so the two cannot disagree', () => {
  const [family] = manifestFamilies([{ id: 'h', kind: 'specimen', specimen: 'html' }]);
  assert.equal(provesOf(family), SPECIMENS.html.gate);
  assert.deepEqual(unprovenGates({ 'gate:html': 'x' }, [family], []), []);
});

test('a family naming a specimen that does not exist fails at collection, never at run time', () => {
  assert.throws(() => manifestFamilies([{ id: 'x', kind: 'specimen', specimen: 'nope' }]), /unknown specimen nope/);
});

test('a pagination family naming a scope that does not exist fails at collection, never by quietly running the blog family', () => {
  const family = { id: 'x', kind: 'pagination', proves: 'build', fixture: 'live-post.md' };
  assert.throws(() => manifestFamilies([{ ...family, scope: 'tags' }]), /unknown scope tags/);
  assert.deepEqual(
    manifestFamilies([{ ...family, scope: 'tag' }]).map((entry) => entry.scope),
    ['tag']
  );
});

test('the free pass is gone: a family kind that runs nothing is rejected', () => {
  assert.throws(() => manifestFamilies([{ id: 'x', kind: 'unit-covered' }]), /unknown kind unit-covered/);
});

test('a family that does not say which gate it proves is rejected, because the coverage check reads that field', () => {
  assert.throws(
    () => manifestFamilies([{ id: 'x', kind: 'gate', gate: 'budget', tokens: ['OVER BUDGET'] }]),
    /family x \(gate\) is missing proves/
  );
});

test('a pending entry for a gate that has a family is stale, because the debt is paid and the entry would excuse a later removal', () => {
  const scripts = { 'gate:a': 'x', 'gate:b': 'x' };
  const families = [{ id: 'f', kind: 'pure', proves: 'gate:a' }];
  const pending = [
    { gate: 'gate:a', phase: 'phase-5', reason: 'paid' },
    { gate: 'gate:b', phase: 'phase-5', reason: 'owed' },
  ];
  assert.deepEqual(stalePending(scripts, families, pending), ['gate:a']);
});

test('a pending entry for a gate that no script defines is stale', () => {
  assert.deepEqual(stalePending({ 'gate:a': 'x' }, [], [{ gate: 'gate:gone', phase: 'phase-5', reason: 'x' }]), [
    'gate:gone',
  ]);
});

test('the real pending list owes only gates that exist and still have no family', () => {
  assert.deepEqual(stalePending(packageScripts, manifestFamilies(FAMILIES), PENDING), []);
});

test('every family proves the build or a gate the package defines', () => {
  for (const family of manifestFamilies(FAMILIES)) {
    const proves = provesOf(family);
    assert.ok(
      proves === 'build' || proves in packageScripts,
      `${family.id} proves ${proves}, which is neither the build nor a script in package.json`
    );
  }
});

test('every specimen in the registry is run by a family, because an unreferenced specimen proves nothing', () => {
  const used = manifestFamilies(FAMILIES)
    .filter((family) => family.kind === 'specimen')
    .map((family) => family.specimen);
  assert.deepEqual(Object.keys(SPECIMENS).sort(), [...new Set(used)].sort());
});

const proven = (id) => ({ id, ok: true, reason: 'guard failed on the specimen' });

test('the tally counts families proven, never the synthetic baseline row', () => {
  const results = [
    { id: 'baseline-green-copy', ok: true, reason: 'pristine copy builds green' },
    proven('a'),
    proven('b'),
  ];
  assert.equal(tally(results, 2, 40), 'mutation smoke: 2/2 families proven in 40s');
});

test('a skipped family is never reported as proven, because --fast must not read as a full run', () => {
  const results = [
    { id: 'baseline-green-copy', ok: true, reason: 'pristine copy builds green' },
    proven('a'),
    { id: 'slow-one', skipped: true, reason: 'skipped: --fast' },
  ];
  assert.equal(tally(results, 2, 9), 'mutation smoke: 1/2 families proven, 1 skipped in 9s');
  assert.equal(label(results[2]), 'skip');
});

test('a failed family is named in the tally', () => {
  const results = [proven('a'), { id: 'b', ok: false, reason: 'guard stayed green on the specimen' }];
  assert.equal(tally(results, 2, 30), 'mutation smoke: 1/2 families proven, 1 FAILED in 30s');
  assert.equal(label(results[1]), 'FAIL');
});
