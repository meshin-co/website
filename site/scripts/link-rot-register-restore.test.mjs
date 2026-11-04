import assert from 'node:assert/strict';
import { test } from 'node:test';

import { searchFallbackUrl } from '../src/utils/archive-url.mjs';
import { digestOf, planRegister, registerProblems, sealRegister } from './link-rot-register.mjs';

const GONE = 'https://example.org/gone';
const OTHER = 'https://example.org/other';
const ENTRY = 'site/src/data/glossary/evals.md';
const SECOND_ENTRY = 'site/src/data/post/a-post.md';
const SNAPSHOT = `https://web.archive.org/web/20230302214609/${GONE}`;
const SEARCH = searchFallbackUrl({ title: 'The gone report', publisher: 'Example Org' });

const search = (extra = {}) => ({
  original: GONE,
  entry: ENTRY,
  outcome: 'search',
  replacement: SEARCH,
  citedOn: '2023-03-01',
  firstSeenDead: '2026-10-20',
  why: 'no usable Internet Archive capture: the archive holds no snapshot of https://example.org/gone',
  ...extra,
});
const archive = (extra = {}) =>
  search({
    original: OTHER,
    outcome: 'archive',
    replacement: `https://web.archive.org/web/20230302214609/${OTHER}`,
    why: 'the Internet Archive capture of 2023-03-02 is 1 day from the citation date 2023-03-01 and carries the title',
    ...extra,
  });
const unplaced = (extra = {}) => ({
  original: 'https://example.org/template-link',
  entry: null,
  outcome: 'unplaced',
  replacement: null,
  citedOn: null,
  firstSeenDead: '2026-10-20',
  why: 'no collection entry cites it',
  pages: ['/', '/about'],
  ...extra,
});

const sealed = (rows, updatedOn = '2026-10-21') => sealRegister({ updatedOn, rows });
const key = ({ original, entry }) => ({ original, entry });

test('a row named as removed is dropped, the rest stay, and the register is sealed again for the day it changed', () => {
  const existing = sealed([archive(), search(), unplaced()]);

  const plan = planRegister({ existing, found: [], removed: [key(search())], today: '2026-11-03' });

  assert.equal(plan.changed, true);
  assert.deepEqual(
    plan.register.rows.map(({ original, outcome }) => [original, outcome]),
    [
      [OTHER, 'archive'],
      ['https://example.org/template-link', 'unplaced'],
    ]
  );
  assert.equal(plan.register.updatedOn, '2026-11-03');
  assert.equal(plan.register.digest, digestOf(plan.register));
  assert.deepEqual(registerProblems(plan.register), []);
  assert.equal(JSON.parse(plan.text).rows.length, 2);
});

test('removing the last row leaves a register with no rows, and a register that still passes its own guard', () => {
  const existing = sealed([search()]);

  const plan = planRegister({ existing, found: [], removed: [key(search())], today: '2026-11-03' });

  assert.equal(plan.changed, true);
  assert.deepEqual(plan.register.rows, []);
  assert.deepEqual(registerProblems(plan.register), []);
  assert.equal(JSON.parse(plan.text).rows.length, 0);
});

test('only the pair of original and entry that was named is removed: the same address in another entry stays', () => {
  const existing = sealed([search(), search({ entry: SECOND_ENTRY })]);

  const plan = planRegister({ existing, found: [], removed: [key(search())], today: '2026-11-03' });

  assert.deepEqual(
    plan.register.rows.map(({ entry }) => entry),
    [SECOND_ENTRY]
  );
});

test('removing a row the register does not hold changes nothing, so a run that restored an entry nobody recorded costs no commit', () => {
  const existing = sealed([archive()]);

  const plan = planRegister({ existing, found: [], removed: [key(search())], today: '2026-11-03' });

  assert.deepEqual(plan, { changed: false, register: existing, text: null });
  assert.deepEqual(planRegister({ existing: null, found: [], removed: [key(search())], today: '2026-11-03' }), {
    changed: false,
    register: null,
    text: null,
  });
});

test('a search row found again as an archive row is the same row moved up: it is replaced, never listed twice', () => {
  const existing = sealed([search()]);
  const moved = archive({ original: GONE, replacement: SNAPSHOT });

  const plan = planRegister({ existing, found: [moved], today: '2026-11-03' });

  assert.deepEqual(plan.register.rows, [moved]);
  assert.equal(plan.register.rows[0].firstSeenDead, '2026-10-20');
  assert.deepEqual(registerProblems(plan.register), []);
});

test('one plan can remove a restored row and move up another, and the rows come out sorted and sealed once', () => {
  const existing = sealed([search(), search({ original: OTHER, replacement: SEARCH }), unplaced()]);
  const moved = archive({ original: OTHER });

  const plan = planRegister({ existing, found: [moved], removed: [key(search())], today: '2026-11-03' });

  assert.deepEqual(
    plan.register.rows.map(({ original, outcome }) => [original, outcome]),
    [
      [OTHER, 'archive'],
      ['https://example.org/template-link', 'unplaced'],
    ]
  );
  assert.deepEqual(registerProblems(plan.register), []);
});

test('a plan that removes nothing named and finds nothing is the plan it always was', () => {
  const existing = sealed([search()]);

  assert.deepEqual(planRegister({ existing, found: [], today: '2026-11-03' }), {
    changed: false,
    register: existing,
    text: null,
  });
  assert.deepEqual(planRegister({ existing, found: [], removed: [], today: '2026-11-03' }).changed, false);
});
