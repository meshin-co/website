import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { entryPath } from './entry-files.mjs';
import { dispositionFile } from './route-derive.mjs';
import { ownPaths, scopeProblems } from './repair-scope.mjs';

const ARTICLE = { slug: 'an-entry', format: 'article' };
const TERM = { slug: 'a-term', format: 'term' };
const pathsOf = (entry) => ownPaths(entry);
const problemsFor = (entry, paths) => scopeProblems({ ...entry, paths });
const named = (problems) => problems.map(({ path }) => path);

test('the paths of an entry are the same ones the writer writes', () => {
  for (const entry of [ARTICLE, TERM]) {
    const own = pathsOf(entry);
    assert.ok(own.includes(entryPath(entry)), entry.format);
    assert.ok(own.includes(dispositionFile(entry.slug)), entry.format);
    assert.ok(own.includes(`audits/autowriter/${entry.slug}.json`));
    assert.ok(own.includes(`audits/autowriter/generations/${entry.slug}.json`));
    assert.ok(own.includes('docs/SEMANTIC-CORE.md'));
  }
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

test('every path outside the entry and its bookkeeping is refused, and each is named', () => {
  const outside = [
    'site/content-facts.json',
    'site/src/data/post/another-entry.md',
    'site/src/data/glossary/an-entry.md',
    'audits/autowriter/another-entry.json',
    'audits/autowriter/generations/another-entry.json',
    'audits/autowriter/claims/an-entry.json',
    '.github/workflows/ci.yml',
    'site/scripts/write-entry.mjs',
    'site/package.json',
    'AGENTS.md',
  ];
  const problems = problemsFor(ARTICLE, [...pathsOf(ARTICLE), ...outside]);
  assert.deepEqual(named(problems).sort(), [...outside].sort());
  for (const { problem } of problems) assert.match(problem, /outside/);
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
  for (const missing of [
    entryPath(ARTICLE),
    'audits/autowriter/an-entry.json',
    'audits/autowriter/generations/an-entry.json',
  ]) {
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
