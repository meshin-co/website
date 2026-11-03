import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';

import { REPAIR_CHECKS, loadRepairModules, runRepairCheck } from './repair-guard-checks.mjs';
import { FAMILIES, manifestFamilies, provesOf } from './mutation-smoke.mjs';

const SITE = resolve(import.meta.dirname, '..');
const NAMES = ['repair-removal', 'repair-scope', 'repair-route-ledger', 'repair-attempt-cap'];
const REAL = await loadRepairModules(SITE);

const checkOf = (name) => {
  assert.equal(typeof REPAIR_CHECKS[name], 'function', `no check named ${name}`);
  return REPAIR_CHECKS[name];
};
const withGuard = (removalProblems) => ({ ...REAL, guard: { ...REAL.guard, removalProblems } });
const withScope = (scopeProblems) => ({ ...REAL, scope: { ...REAL.scope, scopeProblems } });
const withRouteLedger = (routeLedger) => ({ ...REAL, routeLedger: { ...REAL.routeLedger, ...routeLedger } });
const withAttempt = (ledgerWithAttempt) => ({ ...REAL, ledger: { ...REAL.ledger, ledgerWithAttempt } });

test('the four repair guards each have a check, and nothing else is named', () => {
  assert.deepEqual(Object.keys(REPAIR_CHECKS), NAMES);
});

test('every check passes on the repository as it is, and says what it saw', async () => {
  const expected = {
    'repair-removal': /takeaway-removed/,
    'repair-scope': /outside the entry/,
    'repair-route-ledger': /a dropped route is refused/,
    'repair-attempt-cap': /cap is 3/,
  };
  for (const name of NAMES) {
    const result = await runRepairCheck(name, SITE);
    assert.equal(result.ok, true, `${name}: ${result.reason}`);
    assert.match(result.reason, expected[name]);
  }
});

test('a check that does not exist is an error, not a pass', async () => {
  await assert.rejects(runRepairCheck('repair-nothing', SITE), /no repair check named repair-nothing/);
  await assert.rejects(runRepairCheck('constructor', SITE), /no repair check named constructor/);
});

test('a check reads the modules of the tree it is given, so a missing tree is an error', async () => {
  await assert.rejects(runRepairCheck('repair-removal', resolve(SITE, 'no-such-tree')));
});

test('the removal check fails when the guard stays green on dropped takeaways', () => {
  const result = checkOf('repair-removal')(withGuard(() => []));
  assert.equal(result.ok, false);
  assert.match(result.reason, /stayed green when every key takeaway was dropped/);
});

test('the removal check fails when the guard flags an entry handed back unchanged', () => {
  const result = checkOf('repair-removal')(withGuard(() => [{ rule: 'takeaway-removed' }]));
  assert.equal(result.ok, false);
  assert.match(result.reason, /flagged an entry handed back unchanged: takeaway-removed/);
});

test('the removal check fails when the guard ignores the takeaways allowance', () => {
  const unchanged = ({ before, after }) => (before === after ? [] : [{ rule: 'takeaway-removed' }]);
  const result = checkOf('repair-removal')(withGuard(unchanged));
  assert.equal(result.ok, false);
  assert.match(result.reason, /ignored the takeaways allowance/);
});

test('the removal check fails when the fixture holds no takeaway to drop', () => {
  const bare = { cleanDraft: () => ({ fields: { keyTakeaways: [] }, body: '' }) };
  const result = checkOf('repair-removal')({ ...REAL, drafts: bare });
  assert.equal(result.ok, false);
  assert.match(result.reason, /holds no key takeaway/);
});

test('the scope check fails when the check stays green on a file outside the entry or a refused record', () => {
  const result = checkOf('repair-scope')(withScope(() => []));
  assert.equal(result.ok, false);
  assert.match(result.reason, /stayed green on site\/src\/pages\/index\.astro/);
  const onlyOutside = ({ paths }) =>
    paths.includes('audits/lighthouse-green.json') ? [{ path: 'site/src/pages/index.astro', problem: 'x' }] : [];
  const second = checkOf('repair-scope')(withScope(onlyOutside));
  assert.equal(second.ok, false);
  assert.match(second.reason, /stayed green on audits\/lighthouse-green\.json/);
});

test('the scope check fails when the check flags the files of the entry itself', () => {
  const result = checkOf('repair-scope')(
    withScope(() => [{ path: 'site/src/data/post/zz-specimen.md', problem: 'is wrong' }])
  );
  assert.equal(result.ok, false);
  assert.match(result.reason, /flagged the files of the entry itself: site\/src\/data\/post\/zz-specimen\.md is wrong/);
});

test('the cap check fails when a fourth attempt is recorded', () => {
  const never = (ledger, attempt) => ({ ...ledger, attempts: [...ledger.attempts, attempt] });
  const result = checkOf('repair-attempt-cap')(withAttempt(never));
  assert.equal(result.ok, false);
  assert.match(result.reason, /attempt 4 was recorded/);
});

test('the cap check fails when the refusal does not name the cap, and when an attempt below it is refused', () => {
  const check = checkOf('repair-attempt-cap');
  const real = REAL.ledger.ledgerWithAttempt;
  const silent = (ledger, attempt) => {
    if (ledger.attempts.length >= 3) throw new Error('too many');
    return real(ledger, attempt);
  };
  const unnamed = check(withAttempt(silent));
  assert.equal(unnamed.ok, false);
  assert.match(unnamed.reason, /does not name the cap: too many/);
  const early = check(
    withAttempt((ledger, attempt) => {
      if (ledger.attempts.length >= 2) throw new Error('the cap is 3');
      return real(ledger, attempt);
    })
  );
  assert.equal(early.ok, false);
  assert.match(early.reason, /attempt 3 was refused below the cap: the cap is 3/);
});

test('the route ledger check fails when the ledger step stays green on a dropped route', async () => {
  const result = await checkOf('repair-route-ledger')(
    withRouteLedger({ regenerateRouteLedger: async () => ({ changed: true }) })
  );
  assert.equal(result.ok, false);
  assert.match(result.reason, /stayed green when the build dropped \/blog\/b/);
});

test('the route ledger check fails when the ledger step does not carry a route the build added', async () => {
  const real = REAL.routeLedger.regenerateRouteLedger;
  const blind = async (input) => ({ ...(await real(input)), changed: false });
  const result = await checkOf('repair-route-ledger')(withRouteLedger({ regenerateRouteLedger: blind }));
  assert.equal(result.ok, false);
  assert.match(result.reason, /did not carry a route the build added/);
});

test('the route ledger check fails when the ledger step carries a ledger the build left as it was', async () => {
  const real = REAL.routeLedger.regenerateRouteLedger;
  const always = async (input) => ({ ...(await real(input)), changed: true });
  const result = await checkOf('repair-route-ledger')(withRouteLedger({ regenerateRouteLedger: always }));
  assert.equal(result.ok, false);
  assert.match(result.reason, /carried a ledger the build left as it was/);
});

test('the route ledger check fails when a repair may not carry the ledger', async () => {
  const result = await checkOf('repair-route-ledger')(
    withScope(({ paths }) =>
      paths.includes('audits/routes.json') ? [{ path: 'audits/routes.json', problem: 'is outside the entry' }] : []
    )
  );
  assert.equal(result.ok, false);
  assert.match(result.reason, /scope check refused the route ledger: is outside the entry/);
});

test('every check passes again once the real functions are back', async () => {
  for (const name of NAMES) assert.equal((await checkOf(name)(REAL)).ok, true, name);
});

test('each check has one smoke family that proves repair:entry, and no such family names another check', () => {
  const families = manifestFamilies(FAMILIES).filter(
    (family) => family.kind === 'pure' && family.check in REPAIR_CHECKS
  );
  assert.deepEqual(families.map(({ check }) => check).sort(), [...NAMES].sort());
  for (const family of families) assert.equal(provesOf(family), 'repair:entry', family.id);
  assert.equal(new Set(families.map(({ id }) => id)).size, NAMES.length);
});

test('the smoke harness runs a repair family through its check, and a bad check name stays refused', async () => {
  const { manifestFamilies: manifest } = await import('./mutation-smoke.mjs');
  assert.throws(
    () => manifest([{ id: 'x', kind: 'pure', proves: 'repair:entry', check: 'repair-nothing' }]),
    /unknown check repair-nothing/
  );
  assert.equal(manifest([{ id: 'x', kind: 'pure', proves: 'repair:entry', check: 'repair-scope' }]).length, 1);
});
