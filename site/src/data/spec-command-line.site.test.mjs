import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const folder = new URL('./spec/evals-baseline-1.0/', import.meta.url);
const suite = JSON.parse(readFileSync(new URL('vectors.json', folder), 'utf8'));
const page = readFileSync(new URL('./spec/evals-baseline-1.0.md', import.meta.url), 'utf8');

const sectionOf = (heading, level = '##') => {
  const opening = `\n${level} ${heading}\n`;
  const start = page.indexOf(opening);
  assert.notEqual(start, -1, `the page has no section headed ${heading}`);
  const ends = page.slice(start + opening.length).search(new RegExp(`\n#{1,${level.length}} `));
  return page.slice(start, ends === -1 ? undefined : start + opening.length + ends);
};

const FLAG_NAME = /--[a-z]+/g;
const TOLERANCE_TEXT = /^(?:\d+\.?\d*|\.\d+)$/;

function verbsOfThePage() {
  const rows = sectionOf('The command line').matchAll(/^\| `(check|record|show)` +\| (.+?) +\|$/gm);
  return new Map(
    [...rows].map(([, verb, cell]) => [
      verb,
      new Map([...cell.matchAll(/(--[a-z]+)( <[a-z]+>)?/g)].map(([, name, value]) => [name, value !== undefined])),
    ])
  );
}

function toleranceBoundOfThePage() {
  const bound = /Or the number it gives is not from 0 to (\d+)\./.exec(sectionOf('Usage errors', '###'))?.[1];
  assert.ok(bound, 'the usage errors name no tolerance bound');
  return Number(bound);
}

function isUsageError(argv) {
  const verbs = verbsOfThePage();
  if (argv.length === 1 && argv[0] === '--version') return false;
  const own = verbs.get(argv[0]);
  if (own === undefined) return true;
  const named = new Set([...verbs.values()].flatMap((flags) => [...flags.keys()]));
  const given = new Set();
  const runFiles = [];
  for (let at = 1; at < argv.length; at += 1) {
    const argument = argv[at];
    if (!argument.startsWith('-')) {
      runFiles.push(argument);
      continue;
    }
    if (!named.has(argument) || !own.has(argument) || given.has(argument)) return true;
    given.add(argument);
    if (own.get(argument)) {
      const value = argv[at + 1];
      if (value === undefined || value.startsWith('-')) return true;
      const tolerable = TOLERANCE_TEXT.test(value) && Number(value) <= toleranceBoundOfThePage();
      if (argument === '--tolerance' && !tolerable) return true;
      at += 1;
    }
  }
  return runFiles.length !== 1;
}

const usageErrors = suite.vectors.filter((vector) => vector.code === 2);

test('the page gives the flags of each verb in a table, and show takes none', () => {
  const verbs = verbsOfThePage();
  assert.deepEqual([...verbs.keys()].sort(), ['check', 'record', 'show']);
  assert.equal(verbs.get('show').size, 0);
  assert.ok(verbs.get('check').size > 0 && verbs.get('record').size > 0);
});

test('the seven conditions of the page, read as code, classify every vector as the vector says', () => {
  const flagged = suite.vectors.filter(
    (vector) => vector.code !== 2 && vector.argv.some((token) => token.startsWith('--'))
  );
  assert.ok(flagged.length > 100);
  for (const vector of suite.vectors) assert.equal(isUsageError(vector.argv), vector.code === 2, vector.id);
});

test('the usage line of every usage error names the flags of that table and no other', () => {
  const named = new Set([...verbsOfThePage().values()].flatMap((flags) => [...flags.keys()]));
  assert.ok(usageErrors.length > 0);
  for (const usage of usageErrors) {
    const line = usage.stderr.at(-1);
    assert.match(line, /^usage: /, usage.id);
    assert.deepEqual(new Set(line.match(FLAG_NAME)), named, usage.id);
  }
});

test('a usage error prints nothing to standard output and writes no file, as the page says', () => {
  for (const usage of usageErrors) {
    assert.deepEqual(usage.stdout, [], usage.id);
    assert.deepEqual(usage.writes, [], usage.id);
  }
});

test('a vector that names no baseline reads or writes the default path that the page gives', () => {
  const fallback = /When it is not given, the baseline is `([^`]+)`/.exec(sectionOf('The command line'))?.[1];
  assert.ok(fallback, 'the page names no default baseline path');
  const unnamed = suite.vectors.filter(
    (vector) => vector.code !== 2 && ['check', 'record'].includes(vector.argv[0]) && !vector.argv.includes('--baseline')
  );
  assert.ok(unnamed.length > 20);
  for (const vector of unnamed) assert.equal(vector.baseline, `${vector.dir}/${fallback}`, vector.id);
});

test('the page lists seven usage-error conditions, and the exit table sends the reader to them', () => {
  assert.equal((sectionOf('Usage errors', '###').match(/^\d+\. /gm) ?? []).length, 7);
  const row = /^\| 2 +\| (.+?) +\|$/m.exec(sectionOf('Exit codes'))?.[1];
  assert.match(row, /^A usage error, as The command line defines it\. /);
});

test('the page makes the clauses decide, and says in one paragraph what a reader does when a vector disagrees', () => {
  const paragraphs = sectionOf('How to read this specification').split('\n\n');
  const deciding = paragraphs.filter((paragraph) => /The clauses on this page are the specification/.test(paragraph));
  assert.equal(deciding.length, 1);
  assert.match(deciding[0], /conforms to a version when it does what every clause of that version requires/);
  const settling = paragraphs.filter((paragraph) => /When this page and a vector disagree/.test(paragraph));
  assert.equal(settling.length, 1);
  assert.match(settling[0], /follow this page/);
  assert.match(settling[0], /\]\(\/contact\)/);
});

test('no sentence of the page lets a vector decide over a clause, or defines conformance by the vectors alone', () => {
  assert.doesNotMatch(page, /the vector decides/i);
  const sentences = page.split(/(?<=[.!?])\s+/);
  assert.deepEqual(
    sentences.filter((sentence) => /conform/i.test(sentence) && /reproduc/i.test(sentence)),
    []
  );
});
