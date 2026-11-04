import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { searchFallbackUrl } from '../src/utils/archive-url.mjs';
import {
  REGISTER_PATH,
  digestOf,
  isSameRow,
  planRegister,
  readRegister,
  registerProblems,
  registerSummary,
  registerText,
  sealRegister,
  writeRegister,
} from './link-rot-register.mjs';

const GONE = 'https://example.org/gone';
const ENTRY = 'site/src/data/glossary/evals.md';
const SNAPSHOT = 'https://web.archive.org/web/20230302214609/https://example.org/gone';
const SEARCH = searchFallbackUrl({ title: 'The gone report', publisher: 'Example Org' });

const archive = (extra = {}) => ({
  original: GONE,
  entry: ENTRY,
  outcome: 'archive',
  replacement: SNAPSHOT,
  citedOn: '2023-03-01',
  firstSeenDead: '2026-11-03',
  why: 'the capture of 2023-03-02 is 1 day from the citation date and carries the title',
  ...extra,
});
const search = (extra = {}) =>
  archive({
    original: 'https://example.org/other',
    entry: 'site/src/data/post/a-post.md',
    outcome: 'search',
    replacement: SEARCH,
    why: 'the archive holds no snapshot of https://example.org/other',
    ...extra,
  });
const unplaced = (extra = {}) => ({
  original: 'https://example.org/template-link',
  entry: null,
  outcome: 'unplaced',
  replacement: null,
  citedOn: null,
  firstSeenDead: '2026-11-03',
  why: 'no collection entry cites it',
  pages: ['/', '/about'],
  ...extra,
});

const sealed = (rows = [archive(), search(), unplaced()], updatedOn = '2026-11-03') =>
  sealRegister({ updatedOn, rows });
const problemsOf = (register) => registerProblems(register);
const withDigest = (register) => ({ ...register, digest: digestOf(register) });

function scratch(t) {
  const root = mkdtempSync(join(tmpdir(), 'link-rot-register-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('a sealed register is the schema, the day it changed, its rows sorted by original then entry, and a digest over both', () => {
  const register = sealed([unplaced(), search(), archive()]);

  assert.deepEqual(Object.keys(register), ['schema', 'updatedOn', 'rows', 'digest']);
  assert.equal(register.schema, 1);
  assert.deepEqual(
    register.rows.map(({ original }) => original),
    ['https://example.org/gone', 'https://example.org/other', 'https://example.org/template-link']
  );
  assert.match(register.digest, /^[0-9a-f]{64}$/);
  assert.equal(register.digest, digestOf(register));
  assert.deepEqual(problemsOf(register), []);
});

test('the rows of one address sort by entry, and the row with no entry comes before the rows that have one', () => {
  const rows = [
    archive({ entry: 'site/src/data/post/b.md' }),
    unplaced({ original: GONE }),
    archive({ entry: 'site/src/data/post/a.md' }),
  ];

  const register = sealed(rows);

  assert.deepEqual(
    register.rows.map(({ entry }) => entry),
    [null, 'site/src/data/post/a.md', 'site/src/data/post/b.md']
  );
});

test('the text is two-space JSON with one newline and the keys of each row in reading order', () => {
  const text = registerText(sealed());

  assert.ok(text.endsWith('}\n'));
  assert.equal(text.replace(/\n$/, ''), JSON.stringify(JSON.parse(text), null, 2));
  const first = JSON.parse(text).rows[0];
  assert.deepEqual(Object.keys(first), [
    'original',
    'entry',
    'outcome',
    'replacement',
    'citedOn',
    'firstSeenDead',
    'why',
  ]);
  assert.deepEqual(Object.keys(JSON.parse(text).rows[2]).at(-1), 'pages');
});

test('the digest moves with every field of every row, and with the day', () => {
  const register = sealed();
  const changes = [
    ['updatedOn', (draft) => (draft.updatedOn = '2026-11-04')],
    ['original', (draft) => (draft.rows[0].original = 'https://example.org/gone2')],
    ['entry', (draft) => (draft.rows[0].entry = 'site/src/data/glossary/other.md')],
    ['outcome', (draft) => (draft.rows[0].outcome = 'search')],
    ['replacement', (draft) => (draft.rows[0].replacement = SNAPSHOT.replace('2023', '2022'))],
    ['citedOn', (draft) => (draft.rows[0].citedOn = '2023-03-02')],
    ['firstSeenDead', (draft) => (draft.rows[0].firstSeenDead = '2026-11-02')],
    ['why', (draft) => (draft.rows[0].why = 'a different reason')],
    ['pages', (draft) => draft.rows[2].pages.push('/zz')],
    ['a row removed', (draft) => draft.rows.pop()],
    ['a row added', (draft) => draft.rows.push(unplaced({ original: 'https://zz.example/x' }))],
  ];

  for (const [name, change] of changes) {
    const draft = structuredClone(register);
    change(draft);
    assert.notEqual(digestOf(draft), register.digest, name);
  }
});

test('the digest does not depend on the order the keys of a row were written in', () => {
  const register = sealed();
  const shuffled = structuredClone(register);
  shuffled.rows = shuffled.rows.map((row) => Object.fromEntries(Object.entries(row).reverse()));

  assert.equal(digestOf(shuffled), register.digest);
});

test('a register edited by hand is found: the digest no longer matches the rows', () => {
  const register = sealed();
  const edits = [
    ['a reason reworded', (draft) => (draft.rows[0].why = 'looks fine to me')],
    ['a row deleted', (draft) => draft.rows.splice(1, 1)],
    [
      'a replacement swapped',
      (draft) => (draft.rows[1].replacement = searchFallbackUrl({ title: 'Other', publisher: '' })),
    ],
    ['the day moved', (draft) => (draft.updatedOn = '2026-11-02')],
  ];

  for (const [name, edit] of edits) {
    const draft = structuredClone(register);
    edit(draft);
    const found = problemsOf(draft);
    assert.ok(
      found.some((problem) => /the digest does not match its rows/.test(problem)),
      name + ': ' + found.join(' | ')
    );
  }
});

test('the digest being rewritten by hand is found too, because it is not hex of the right length or does not match', () => {
  const register = sealed();

  assert.match(problemsOf({ ...register, digest: 'abc' })[0], /digest/);
  assert.match(problemsOf({ ...register, digest: 'a'.repeat(64) })[0], /the digest does not match its rows/);
  const { digest, ...without } = register;
  assert.match(problemsOf(without).join(' | '), /digest/, digest);
});

test('a register holds only what the writer writes: no other key, anywhere', () => {
  const register = sealed();

  assert.match(problemsOf({ ...register, note: 'x' }).join(' | '), /note/);
  const row = withDigest({ ...register, rows: [{ ...register.rows[0], note: 'x' }, ...register.rows.slice(1)] });
  assert.match(problemsOf(row).join(' | '), /rows\[0\].*note/);
  const pages = withDigest({
    ...register,
    rows: [{ ...register.rows[0], pages: ['/'] }, ...register.rows.slice(1)],
  });
  assert.match(problemsOf(pages).join(' | '), /rows\[0\].*pages/);
});

test('each row says what it must: an outcome, the address, the entry, the replacement, two days and a reason', () => {
  const cases = [
    ['an unknown outcome', archive({ outcome: 'guess' }), /outcome/],
    ['an original that is no address', archive({ original: 'not an address' }), /original/],
    ['an archive replacement that is no snapshot of the original', archive({ replacement: SEARCH }), /replacement/],
    [
      'an archive replacement that snapshots another address',
      archive({ replacement: 'https://web.archive.org/web/20230302214609/https://example.org/elsewhere' }),
      /replacement/,
    ],
    ['a search replacement off the search origin', search({ replacement: 'https://example.net/?q=x' }), /replacement/],
    ['no entry on a repair', archive({ entry: null }), /entry/],
    ['an entry that climbs out of the repository', archive({ entry: '../x.md' }), /entry/],
    ['no day it was cited', archive({ citedOn: null }), /citedOn/],
    ['a day that does not exist', archive({ citedOn: '2023-02-30' }), /citedOn/],
    ['a first sighting that is no day', archive({ firstSeenDead: 'yesterday' }), /firstSeenDead/],
    ['a first sighting after the register changed', archive({ firstSeenDead: '2026-11-04' }), /firstSeenDead/],
    ['no reason', archive({ why: '' }), /why/],
    ['an unplaced row with an entry', unplaced({ entry: ENTRY }), /entry/],
    ['an unplaced row with a replacement', unplaced({ replacement: SNAPSHOT }), /replacement/],
    ['an unplaced row with a citation day', unplaced({ citedOn: '2023-03-01' }), /citedOn/],
    ['an unplaced row without pages', unplaced({ pages: [] }), /pages/],
    ['an unplaced row with unsorted pages', unplaced({ pages: ['/b', '/a'] }), /pages/],
    ['an unplaced row with a page listed twice', unplaced({ pages: ['/a', '/a'] }), /pages/],
  ];

  for (const [name, row, pattern] of cases) {
    const found = problemsOf(withDigest({ schema: 1, updatedOn: '2026-11-03', rows: [row] }));
    assert.ok(found.length > 0, name + ' was accepted');
    assert.match(found.join(' | '), pattern, name);
  }
});

test('rows out of order, or one pair of original and entry twice, are found even when the digest matches', () => {
  const [first, second] = sealed([archive(), search()]).rows;

  const reversed = withDigest({ schema: 1, updatedOn: '2026-11-03', rows: [second, first] });
  const twice = withDigest({ schema: 1, updatedOn: '2026-11-03', rows: [first, { ...first, why: 'again' }] });

  assert.match(problemsOf(reversed).join(' | '), /not sorted/);
  assert.match(problemsOf(twice).join(' | '), /rows\[1\] repeats/);
});

test('a register with a schema other than 1, a day that does not exist or rows that are not a list is refused', () => {
  const register = sealed();

  assert.match(problemsOf({ ...register, schema: 2 }).join(' | '), /schema/);
  assert.match(problemsOf({ ...register, updatedOn: '2026-13-01' }).join(' | '), /updatedOn/);
  assert.match(problemsOf({ ...register, rows: {} }).join(' | '), /rows/);
  assert.match(problemsOf(null).join(' | '), /object/);
  assert.match(problemsOf([]).join(' | '), /object/);
});

test('a repository with no register reads as none, and nothing is wrong with that', (t) => {
  assert.deepEqual(readRegister(scratch(t)), { register: null, problems: [] });
});

test('a register on disk reads back what was written, and a file that is not JSON is a problem and not a crash', (t) => {
  const root = scratch(t);
  const register = sealed();
  writeRegister(root, registerText(register));

  assert.deepEqual(readRegister(root), { register, problems: [] });

  writeFileSync(join(root, REGISTER_PATH), '{ nope');
  const broken = readRegister(root);
  assert.equal(broken.register, null);
  assert.match(broken.problems[0], /is not JSON/);
});

test('writing creates the audits directory and leaves no temporary file behind', (t) => {
  const root = scratch(t);
  mkdirSync(dirname(join(root, REGISTER_PATH)), { recursive: true });

  writeRegister(root, registerText(sealed()));

  assert.equal(readFileSync(join(root, REGISTER_PATH), 'utf8'), registerText(sealed()));
});

test('a first run with rows makes a register dated that day, and a first run with none makes nothing', () => {
  const made = planRegister({ existing: null, found: [archive()], today: '2026-11-03' });
  const none = planRegister({ existing: null, found: [], today: '2026-11-03' });

  assert.equal(made.changed, true);
  assert.equal(made.register.updatedOn, '2026-11-03');
  assert.deepEqual(made.register.rows, [archive()]);
  assert.equal(made.text, registerText(made.register));
  assert.deepEqual(none, { changed: false, register: null, text: null });
});

test('merging the same rows again changes nothing, so a register is never rewritten for a day that found nothing new', () => {
  const first = planRegister({ existing: null, found: [archive(), search()], today: '2026-11-03' });

  const again = planRegister({ existing: first.register, found: [archive(), search()], today: '2026-11-09' });
  const empty = planRegister({ existing: first.register, found: [], today: '2026-11-09' });

  assert.equal(again.changed, false);
  assert.equal(again.register, first.register);
  assert.equal(empty.changed, false);
});

test('a repair is kept as history, and a new repair is added beside it, and the day moves only when a row did', () => {
  const first = planRegister({ existing: null, found: [archive()], today: '2026-11-03' });

  const next = planRegister({ existing: first.register, found: [search()], today: '2026-11-09' });

  assert.equal(next.changed, true);
  assert.equal(next.register.updatedOn, '2026-11-09');
  assert.deepEqual(
    next.register.rows.map(({ outcome }) => outcome),
    ['archive', 'search']
  );
  assert.deepEqual(problemsOf(next.register), []);
});

test('a repair of the same address in the same entry replaces its older row', () => {
  const first = planRegister({ existing: null, found: [archive()], today: '2026-11-03' });

  const next = planRegister({
    existing: first.register,
    found: [archive({ why: 'a newer capture of the same address' })],
    today: '2026-11-09',
  });

  assert.equal(next.register.rows.length, 1);
  assert.equal(next.register.rows[0].why, 'a newer capture of the same address');
});

test('an unplaced row is recomputed: it goes when the address was settled, stays when it was not looked at, and is replaced when found again', () => {
  const kept = unplaced({ original: 'https://example.org/b-not-looked-at' });
  const settled = unplaced({ original: 'https://example.org/a-fixed' });
  const refound = unplaced({ original: 'https://example.org/c-still-dead', why: 'old reason' });
  const first = planRegister({ existing: null, found: [kept, settled, refound], today: '2026-11-03' });

  const next = planRegister({
    existing: first.register,
    found: [unplaced({ original: 'https://example.org/c-still-dead', why: 'new reason' })],
    settled: new Set(['https://example.org/a-fixed', 'https://example.org/c-still-dead']),
    today: '2026-11-09',
  });

  assert.deepEqual(
    next.register.rows.map(({ original, why }) => [original, why]),
    [
      ['https://example.org/b-not-looked-at', 'no collection entry cites it'],
      ['https://example.org/c-still-dead', 'new reason'],
    ]
  );
});

test('an unplaced row found again with the same words is no change, so a template that stays broken costs no commit', () => {
  const first = planRegister({ existing: null, found: [unplaced()], today: '2026-11-03' });

  const again = planRegister({
    existing: first.register,
    found: [unplaced()],
    settled: new Set([unplaced().original]),
    today: '2026-11-09',
  });

  assert.equal(again.changed, false);
});

test('a planned register that comes out with a problem is refused, because the job must never write what the gate would fail', () => {
  assert.throws(
    () => planRegister({ existing: null, found: [archive({ replacement: SEARCH })], today: '2026-11-03' }),
    /replacement/
  );
});

test('the summary counts what the register holds and names the day it changed', () => {
  const register = sealed([archive(), search(), search({ original: 'https://example.org/c' }), unplaced()]);

  assert.equal(
    registerSummary(register),
    'link rot: 1 citation repaired from the archive, 2 resting on a search link, 1 unplaced address (audits/link-rot.json, changed 2026-11-03)'
  );
  assert.equal(registerSummary(null), 'link rot: no register yet (audits/link-rot.json is written by the repair job)');
});

test('two rows are the same row when every field the writer writes is the same, in whatever order the keys were made', () => {
  const row = unplaced();

  assert.equal(isSameRow(row, { ...row, pages: [...row.pages] }), true);
  assert.equal(isSameRow(row, Object.fromEntries(Object.entries(row).reverse())), true);
  assert.equal(isSameRow(row, { ...row, why: 'another reason' }), false);
  assert.equal(isSameRow(row, { ...row, pages: ['/'] }), false);
  assert.equal(isSameRow(archive(), search()), false);
});
