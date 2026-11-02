import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { entryPath } from './entry-files.mjs';
import { recordPath } from './record-layout.mjs';
import { ownPaths, scopeProblems } from './repair-scope.mjs';

const CLAIMED = '2026-11-02T06:00:00.000Z';
const ARTICLE = { slug: 'an-entry', format: 'article', claimedAt: CLAIMED };
const TERM = { slug: 'a-term', format: 'term', claimedAt: CLAIMED };
const ledgerOf = ({ slug, claimedAt }) => recordPath('ledger', slug, claimedAt);
const recordOf = ({ slug, claimedAt }) => recordPath('generation', slug, claimedAt);
const pathsOf = (entry) => ownPaths(entry);
const problemsFor = (entry, paths) => scopeProblems({ ...entry, paths });
const named = (problems) => problems.map(({ path }) => path);

test('the paths of an entry are the same ones the writer writes', () => {
  for (const entry of [ARTICLE, TERM]) {
    const own = pathsOf(entry);
    assert.ok(own.includes(entryPath(entry)), entry.format);
    assert.ok(own.includes(recordPath('disposition', entry.slug, entry.claimedAt)), entry.format);
    assert.ok(own.includes(ledgerOf(entry)), entry.format);
    assert.ok(own.includes(recordOf(entry)), entry.format);
    assert.ok(own.includes('docs/SEMANTIC-CORE.md'));
  }
});

test('the ledger, the record and the disposition of an entry sit under the month of its claim', () => {
  assert.deepEqual(pathsOf(ARTICLE), [
    entryPath(ARTICLE),
    'audits/autowriter/2026/11/an-entry.json',
    'audits/autowriter/generations/2026/11/an-entry.json',
    'audits/phase-4.7/dispositions/2026/11/generated-an-entry.json',
    'docs/SEMANTIC-CORE.md',
  ]);
  assert.deepEqual(pathsOf({ ...ARTICLE, claimedAt: '2026-12-01T00:00:00.000Z' }).slice(1, 4), [
    'audits/autowriter/2026/12/an-entry.json',
    'audits/autowriter/generations/2026/12/an-entry.json',
    'audits/phase-4.7/dispositions/2026/12/generated-an-entry.json',
  ]);
});

test('a claim time that is not a UTC instant gives the entry no month, and no path is judged against a guessed one', () => {
  for (const claimedAt of [undefined, '', '2026-11', 'yesterday'])
    assert.throws(() => scopeProblems({ ...ARTICLE, claimedAt, paths: [] }), /is not a UTC instant/, String(claimedAt));
});

test('a repair that changes the entry, its ledger, its record and the files derived from them is in scope', () => {
  assert.deepEqual(problemsFor(ARTICLE, pathsOf(ARTICLE)), []);
  assert.deepEqual(problemsFor(TERM, pathsOf(TERM)), []);
});

test('a hand-written disposition file the repair restated is in scope, a file of another kind is not', () => {
  const restated = 'audits/phase-4.7/dispositions/pages.json';
  assert.deepEqual(problemsFor(ARTICLE, [...pathsOf(ARTICLE), restated]), []);
  assert.deepEqual(named(problemsFor(ARTICLE, [...pathsOf(ARTICLE), 'audits/phase-4.7/dispositions/notes.md'])), [
    'audits/phase-4.7/dispositions/notes.md',
  ]);
});

test('a generated disposition of another entry, filed under its month, is in scope when the repair restated it', () => {
  const another = recordPath('disposition', 'another-entry', '2026-10-31T23:59:59.999Z');

  assert.equal(another, 'audits/phase-4.7/dispositions/2026/10/generated-another-entry.json');
  assert.deepEqual(problemsFor(ARTICLE, [...pathsOf(ARTICLE), another]), []);
});

test('a disposition that is not filed where the layout puts it is outside, whatever entry it belongs to', () => {
  const misfiled = [
    'audits/phase-4.7/dispositions/generated-an-entry.json',
    'audits/phase-4.7/dispositions/generated-another-entry.json',
    'audits/phase-4.7/dispositions/2026/11/extra/generated-another-entry.json',
    'audits/phase-4.7/dispositions/2026/13/generated-another-entry.json',
    'audits/phase-4.7/dispositions/26/11/generated-another-entry.json',
    'audits/phase-4.7/dispositions/2026/11/routes.json',
  ];
  const problems = problemsFor(ARTICLE, [...pathsOf(ARTICLE), ...misfiled]);

  assert.deepEqual(named(problems).sort(), [...misfiled].sort());
  for (const { problem } of problems) assert.match(problem, /outside/);
});

test('every path outside the entry and its bookkeeping is refused, and each is named', () => {
  const outside = [
    'site/content-facts.json',
    'site/src/data/post/another-entry.md',
    'site/src/data/glossary/an-entry.md',
    'audits/autowriter/another-entry.json',
    'audits/autowriter/generations/another-entry.json',
    'audits/autowriter/claims/an-entry.json',
    ledgerOf({ slug: 'another-entry', claimedAt: CLAIMED }),
    recordOf({ slug: 'another-entry', claimedAt: CLAIMED }),
    recordPath('claim', 'an-entry', CLAIMED),
    recordPath('claim', 'another-entry', CLAIMED),
    '.github/workflows/ci.yml',
    'site/scripts/write-entry.mjs',
    'site/package.json',
    'AGENTS.md',
  ];
  const problems = problemsFor(ARTICLE, [...pathsOf(ARTICLE), ...outside]);
  assert.deepEqual(named(problems).sort(), [...outside].sort());
  for (const { problem } of problems) assert.match(problem, /outside/);
});

test('a ledger and a record at the flat paths of the old layout are outside, and the month paths they should have are missing', () => {
  const flat = ['audits/autowriter/an-entry.json', 'audits/autowriter/generations/an-entry.json'];
  const month = [ledgerOf(ARTICLE), recordOf(ARTICLE)];
  const problems = problemsFor(ARTICLE, [...pathsOf(ARTICLE).filter((path) => !month.includes(path)), ...flat]);
  const kind = (pattern) => named(problems.filter(({ problem }) => pattern.test(problem))).sort();

  assert.deepEqual(kind(/outside/), [...flat].sort());
  assert.deepEqual(kind(/missing/), [...month].sort());
});

test('a repair is judged against the month of its claim, so the paths of another month are outside and the right ones missing', () => {
  const december = { ...ARTICLE, claimedAt: '2026-12-01T00:00:00.000Z' };
  const problems = problemsFor(december, pathsOf(ARTICLE));

  assert.deepEqual(
    named(problems).sort(),
    [ledgerOf(ARTICLE), recordOf(ARTICLE), ledgerOf(december), recordOf(december)].sort()
  );
});

test('a path that climbs out, starts at the root or uses a backslash is refused even if it ends on an own file', () => {
  const sneaky = [
    `../${pathsOf(ARTICLE)[0]}`,
    `/${pathsOf(ARTICLE)[0]}`,
    pathsOf(ARTICLE)[0].replaceAll('/', '\\'),
    `site/src/data/post/../post/${ARTICLE.slug}.md`,
    `audits/phase-4.7/dispositions/../../../site/package.json`,
  ];
  assert.deepEqual(named(problemsFor(ARTICLE, [...pathsOf(ARTICLE), ...sneaky])), sneaky);
});

test('the band, the length record, the Lighthouse records and the reports are refused by name, not only as outside', () => {
  const refused = [
    'audits/sentence-band.json',
    'audits/entry-length.json',
    'audits/lighthouse-green.json',
    'audits/phase-19-write-to-demand/lh-measured.json',
    'audits/phase-19-write-to-demand/lh-mobile/report.json',
  ];
  const problems = problemsFor(ARTICLE, [...pathsOf(ARTICLE), ...refused]);
  assert.deepEqual(named(problems).sort(), [...refused].sort());
  assert.match(problems.find(({ path }) => path === 'audits/sentence-band.json').problem, /sentence-band/);
  assert.match(problems.find(({ path }) => path === 'audits/entry-length.json').problem, /entry-length/);
  assert.match(problems.find(({ path }) => path === 'audits/lighthouse-green.json').problem, /lighthouse-record/);
});

test('a repair that leaves out the entry, the ledger or the record is refused, because it repairs nothing it can show', () => {
  for (const missing of [entryPath(ARTICLE), ledgerOf(ARTICLE), recordOf(ARTICLE)]) {
    const paths = pathsOf(ARTICLE).filter((path) => path !== missing);
    const problems = problemsFor(ARTICLE, paths);
    assert.deepEqual(named(problems), [missing]);
    assert.match(problems[0].problem, /missing/);
  }
});

test('an empty change is refused', () => {
  assert.equal(problemsFor(ARTICLE, []).length, 3);
});

test('the module imports nothing that needs an install, so the job that holds the token can run it', () => {
  const copy = mkdtempSync(join(tmpdir(), 'repair-scope-'));
  const scripts = join(copy, 'site', 'scripts');
  try {
    mkdirSync(scripts, { recursive: true });
    for (const name of readdirSync(import.meta.dirname).filter(
      (file) => file.endsWith('.mjs') || file.endsWith('.json')
    ))
      cpSync(join(import.meta.dirname, name), join(scripts, name));
    cpSync(join(import.meta.dirname, '..', 'engine.config.json'), join(copy, 'site', 'engine.config.json'));
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./repair-scope.mjs')"], {
      cwd: scripts,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});
