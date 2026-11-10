import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';

import { KEYWORD_CHECKS, loadKeywordModules, runKeywordCheck } from './keyword-guard-checks.mjs';
import { FAMILIES, manifestFamilies, provesOf } from './mutation-smoke.mjs';

const SITE = resolve(import.meta.dirname, '..');
const NAME = 'keyword-rung-in-the-ladder';
const REAL = await loadKeywordModules(SITE);
const real = REAL.selection.selectTopic;
const check = KEYWORD_CHECKS[NAME];

const withSelect = (selectTopic) => ({ ...REAL, selection: { ...REAL.selection, selectTopic } });
const withReader = (readKeywords) => ({ ...REAL, keywords: { ...REAL.keywords, readKeywords } });
const changing = (change) => (inputs) => real({ ...inputs, ...change(inputs) });
const failing = (modules, pattern) => {
  const result = check(modules);
  assert.equal(result.ok, false, result.reason);
  assert.match(result.reason, pattern);
};

const writtenKeyword = (decision) => decision.decision === 'write' && decision.entries[0]?.origin === 'keyword';
const topOnly = ({ candidates }) => [...candidates].sort((first, second) => second.exact - first.exact).slice(0, 1);
const leastExactFirst = ({ keywords }) => ({
  keywords: { ...keywords, candidates: keywords.candidates.map((row) => ({ ...row, exact: 1000 - row.exact })) },
});
const stopsAtTheFirstRefusal = (inputs) =>
  inputs.claims.length === 0
    ? real(inputs)
    : real({ ...inputs, keywords: { ...inputs.keywords, candidates: topOnly(inputs.keywords) } });
const withoutRotation = (inputs) => {
  const decision = real(inputs);
  return decision.decision === 'write' ? decision : { ...decision, fallback: null };
};
const unadvised = (inputs) => ({ ...real(inputs), strengthen: null, advisories: [] });
const positionFromBing = (inputs) => {
  const decision = real(inputs);
  if (!writtenKeyword(decision)) return decision;
  const [entry, ...rest] = decision.entries;
  return { ...decision, entries: [{ ...entry, demand: { ...entry.demand, position: 1 } }, ...rest] };
};
const keepsARotation = (inputs) => {
  const decision = real(inputs);
  return writtenKeyword(decision) ? { ...decision, fallback: { categories: ['governance'] } } : decision;
};
const walksPastALead = (inputs) => {
  const decision = real(inputs);
  const lead = decision.decision === 'write' && decision.entries[0].origin === 'demand';
  const step = { arm: 'keyword', query: 'ai governance framework', outcome: 'slug-held' };
  return lead ? { ...decision, trail: [...decision.trail, step] } : decision;
};
const writesOnAnEmptyReport = (inputs) =>
  inputs.keywords.candidates.length === 0
    ? { ...real(inputs), entries: [{ topic: { title: 'Invented' }, origin: 'category' }] }
    : real(inputs);

test('the keyword guard has one check, and nothing else is named', () => {
  assert.deepEqual(Object.keys(KEYWORD_CHECKS), [NAME]);
  assert.equal(typeof check, 'function');
});

test('the check passes on the repository as it is, and says what it saw', async () => {
  const result = await runKeywordCheck(NAME, SITE);
  assert.equal(result.ok, true, result.reason);
  assert.match(result.reason, /with no Search Console lead the keyword with the most exact impressions/);
  assert.ok(result.reason.includes('"ai governance framework"'), result.reason);
  assert.ok(result.reason.includes('/glossary/evals'), result.reason);
});

test('a check that does not exist is an error, not a pass', async () => {
  await assert.rejects(runKeywordCheck('keyword-nothing', SITE), /no keyword check named keyword-nothing/);
  await assert.rejects(runKeywordCheck('constructor', SITE), /no keyword check named constructor/);
});

test('a check reads the modules of the tree it is given, so a missing tree is an error', async () => {
  await assert.rejects(runKeywordCheck(NAME, resolve(SITE, 'no-such-tree')));
});

test('the check fails when keyword candidates are never walked, so the category rotation takes the slot', () => {
  failing(
    withSelect(changing(({ keywords }) => ({ keywords: { ...keywords, candidates: [] } }))),
    /ended in a none decision, not a write ahead of the category rotation/
  );
});

test('the check fails when the keyword written is not the one with the most exact impressions', () => {
  failing(withSelect(changing(leastExactFirst)), /was not the only entry written, marked keyword/);
});

test('the check fails when the keyword entry carries a position, which Bing does not measure', () => {
  failing(withSelect(positionFromBing), /not its exact count with no position/);
});

test('the check fails when a keyword pick leaves a category rotation for a model call to try', () => {
  failing(withSelect(keepsARotation), /a keyword pick left a category rotation for a model call to try/);
});

test('the check fails when a keyword candidate is written ahead of a Search Console lead', () => {
  failing(
    withSelect(changing(() => ({ report: REAL.scene.reportOf([]) }))),
    /a Search Console lead lost to a keyword candidate/
  );
});

test('the check fails when a Search Console lead still walks the keyword candidates', () => {
  failing(withSelect(walksPastALead), /a Search Console lead still walked keyword candidates/);
});

test('the check fails when a candidate a claim holds is written, as when the occupancy checks are skipped', () => {
  failing(withSelect(changing(() => ({ claims: [] }))), /a candidate a claim holds was not skipped for the next one/);
});

test('the check fails when a refused candidate ends the walk, so the next candidate is never tried', () => {
  failing(withSelect(stopsAtTheFirstRefusal), /a candidate a claim holds was not skipped: the decision is none/);
});

test('the check fails when occupied candidates leave no category rotation, because no model call could then write', () => {
  failing(withSelect(withoutRotation), /occupied candidates left no category rotation to fall to/);
});

test('the check fails when a candidate that names a register concept is written as a page', () => {
  failing(
    withSelect(changing(() => ({ concepts: [] }))),
    /a candidate that names a register concept was not set aside for the next one/
  );
});

test('the check fails when the register-owned candidate leaves no advisory behind', () => {
  failing(withSelect(unadvised), /no advisory names \/glossary\/evals with the 1200 exact impressions/);
});

const handledWith =
  (impressions) =>
  ({ keywords }) => ({
    keywords: { ...keywords, handled: (keywords.handled ?? []).map((row) => ({ ...row, impressions })) },
  });
const forgetsTheLedger = ({ keywords }) => ({ keywords: { ...keywords, handled: [] } });

test('the check fails when a pair the ledger records as handled is advised again', () => {
  failing(
    withSelect(changing(forgetsTheLedger)),
    /a pair recorded as handled was advised again: \/glossary\/evals for "evals checklist"/
  );
});

test('the check fails when a handled pair whose impressions grew stays quiet', () => {
  failing(
    withSelect(changing(handledWith(1200))),
    /a handled pair whose exact impressions grew from 100 to 1200 was not advised again/
  );
});

test('the check fails when handling one pair silences a pair that was never recorded', () => {
  const silencesAll = (inputs) => {
    const decision = real(inputs);
    return (inputs.keywords.handled ?? []).length === 0 ? decision : { ...decision, strengthen: null, advisories: [] };
  };
  failing(
    withSelect(silencesAll),
    /handling one pair silenced \/glossary\/ai-register, which was never recorded as handled/
  );
});

test('the check fails when a missing keyword report is an error', () => {
  failing(
    withReader(() => {
      throw new Error('ENOENT');
    }),
    /a missing keyword report is an error: ENOENT/
  );
});

test('the check fails when a missing keyword report offers candidates', () => {
  const offered = () => REAL.scene.keywordsOf([REAL.scene.keywordRow('invented phrase', 5)]);
  failing(withReader(offered), /a missing keyword report offered candidates/);
});

test('the check fails when a report with no candidate does not leave the decision to the category rotation', () => {
  failing(
    withSelect(writesOnAnEmptyReport),
    /a report with no candidate did not leave the decision to the category rotation/
  );
});

test('the check passes again once the real function is back', () => {
  assert.equal(check(REAL).ok, true);
});

test('the check has one smoke family that proves pick:topic, and no other family names it', () => {
  const families = manifestFamilies(FAMILIES).filter(
    (family) => family.kind === 'pure' && family.check in KEYWORD_CHECKS
  );
  assert.deepEqual(
    families.map(({ check: name }) => name),
    [NAME]
  );
  assert.equal(provesOf(families[0]), 'pick:topic');
});

test('the smoke harness takes the check by name, and a bad check name stays refused', () => {
  assert.throws(
    () => manifestFamilies([{ id: 'x', kind: 'pure', proves: 'pick:topic', check: 'keyword-nothing' }]),
    /unknown check keyword-nothing/
  );
  assert.equal(manifestFamilies([{ id: 'x', kind: 'pure', proves: 'pick:topic', check: NAME }]).length, 1);
});
