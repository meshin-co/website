import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { mirrorProblems } from '../utils/spec-artefacts.mjs';

const folder = new URL('./spec/evals-baseline-1.0/', import.meta.url);
const suite = JSON.parse(readFileSync(new URL('vectors.json', folder), 'utf8'));
const page = readFileSync(new URL('./spec/evals-baseline-1.0.md', import.meta.url), 'utf8');
const section = page.slice(page.indexOf('## Conformance vectors'));
const version = page.match(/^version: '([^']+)'$/m)?.[1];

const LABELS = {
  'rule-1': 'Rule 1, `missing-metric`',
  'rule-2': 'Rule 2, `below-baseline`',
  'rule-3': 'Rule 3, the note for a metric only in a run',
  'rule-4': 'Rule 4, `sample-count`',
  'binding-check': 'The binding check, `cases-changed`',
  'no-baseline': '`no-baseline`',
  'bad-baseline': '`bad-baseline`',
  'bad-run': '`bad-run`',
  'unreadable-metric': '`unreadable-metric`',
  'internal-error': '`internal-error`',
};

const verbOf = (vector) => (vector.code === 2 ? 'usage' : vector.argv[0] === '--version' ? 'version' : vector.argv[0]);
const pairOf = (vector) => `${vector.baseline}|${vector.run}`;
const distinct = (vectors) => new Set(vectors.map(pairOf)).size;

function summarise(vectors) {
  const verbs = {};
  for (const vector of vectors) verbs[verbOf(vector)] = (verbs[verbOf(vector)] ?? 0) + 1;
  const tags = [...new Set(vectors.flatMap((vector) => vector.covers))];
  const covers = Object.fromEntries(
    tags.map((tag) => {
      const named = vectors.filter((vector) => vector.covers.includes(tag));
      const portable = named.filter((vector) => !vector.referenceOnly).length;
      return [tag, { vectors: named.length, pairs: distinct(named), portable }];
    })
  );
  const referenceOnly = vectors.filter((vector) => vector.referenceOnly);
  return {
    total: vectors.length,
    verbs,
    pairs: distinct(vectors.filter((vector) => verbOf(vector) === 'check')),
    covers,
    rowTotal: Object.values(covers).reduce((sum, row) => sum + row.vectors, 0),
    twoFindings: vectors.filter((vector) => vector.covers.length === 2).length,
    mostFindings: Math.max(...vectors.map((vector) => vector.covers.length)),
    noFinding: vectors.filter((vector) => vector.covers.length === 0).length,
    silentChecks: vectors.filter((vector) => verbOf(vector) === 'check' && vector.covers.length === 0).length,
    referenceOnly: referenceOnly.length,
    referenceOnlyInternal: referenceOnly.filter((vector) => vector.covers.includes('internal-error')).length,
    referenceOnlyUsage: referenceOnly.filter((vector) => vector.code === 2).length,
  };
}

const summary = summarise(suite.vectors);

const normal = (text) => text.replace(/\s+/g, ' ').trim();

function expectedSentences(s) {
  return [
    `Version ${version} has ${s.total} vectors. ${s.verbs.check} run \`check\`, ${s.verbs.record} run \`record\`, ${s.verbs.show} run \`show\`, ${s.verbs.version} asks for the version, and ${s.verbs.usage} are usage errors that exit 2. The ${s.verbs.check} check vectors are drawn from ${s.pairs} distinct pairs of a baseline and a run.`,
    `A vector appears in a row for each finding its report names, so the rows do not partition the ${s.total}.`,
    `Vectors that name two findings stand in two rows, and there are ${s.twoFindings} of them. Of the ${s.total}, ${s.noFinding} name no finding and stand in no row. Of those ${s.noFinding}, ${s.silentChecks} are \`check\` runs that must stay silent.`,
    `The other ${s.noFinding - s.silentChecks} run \`record\` or \`show\`, ask for the version, or are usage errors, and none of them reports a finding.`,
    `The rows therefore total ${s.rowTotal}.`,
    `No implementation is asked to reproduce the reference-only vectors, which number ${s.referenceOnly} of the ${s.total}. Of those ${s.referenceOnly}, ${s.referenceOnlyInternal} print the message a runtime raised, which is not this specification's text. The other ${s.referenceOnlyUsage} print the reason line before a usage error, which this specification does not fix.`,
  ];
}

function tableRows() {
  return section
    .split('\n')
    .filter((line) => /^\| /.test(line) && !/^\| -/.test(line) && !/^\| Covered /.test(line))
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim())
    );
}

test('the counts the vectors file states about itself are the counts of its vectors', () => {
  const { counts } = suite;
  assert.equal(counts.vectors, summary.total);
  assert.equal(counts.referenceOnly, summary.referenceOnly);
  assert.equal(counts.pairs, summary.pairs);
  assert.deepEqual(counts.byVerb, summary.verbs);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(counts.covers).map(([tag, row]) => [
        tag,
        { vectors: row.vectors, pairs: row.pairs, portable: row.portableVectors },
      ])
    ),
    summary.covers
  );
});

test('the reference-only vectors are exactly those the page explains, so no other reason is left unexplained', () => {
  assert.equal(summary.referenceOnlyInternal + summary.referenceOnlyUsage, summary.referenceOnly);
});

test('the page names the one row with no vector to reproduce, and says why', () => {
  const empty = Object.entries(summary.covers)
    .filter(([, row]) => row.portable === 0)
    .map(([tag]) => tag);
  assert.deepEqual(empty, ['internal-error']);
  const text = normal(section);
  assert.ok(text.includes('The last column counts the vectors of a row that an implementation must reproduce.'));
  assert.ok(text.includes('The row for `internal-error` has none'));
});

test('every cover tag of the vectors has a row label on the page, and every label has vectors', () => {
  assert.deepEqual(Object.keys(summary.covers).sort(), Object.keys(LABELS).sort());
});

test('the coverage table holds one row per cover tag with the vectors and pairs counted from the file', () => {
  const expected = Object.entries(LABELS).map(([tag, label]) => [
    label,
    String(summary.covers[tag].vectors),
    String(summary.covers[tag].pairs),
    String(summary.covers[tag].portable),
  ]);
  const found = tableRows();
  assert.deepEqual(
    found,
    expected,
    `replace the rows of the coverage table with:\n${expected.map((row) => `| ${row.join(' | ')} |`).join('\n')}`
  );
});

test('the prose states the counts of the vectors file', () => {
  const text = normal(section);
  for (const sentence of expectedSentences(summary)) {
    assert.ok(
      text.includes(normal(sentence)),
      `the page no longer holds this sentence, derived from the vectors:\n${sentence}`
    );
  }
});

test('the page says the vectors file carries the input files exactly when it does', () => {
  assert.equal(/under the key `files`/i.test(section), suite.files !== undefined);
  assert.equal(/not contain them/.test(section), suite.files === undefined);
});

const mayBeAbsent = (vector, role) =>
  role === 'baseline'
    ? vector.covers.includes('no-baseline') || verbOf(vector) === 'record'
    : vector.covers.includes('bad-run');

test('every input file a vector names is carried by the vectors file, unless the vector makes it absent', () => {
  assert.ok(suite.files !== undefined && Object.keys(suite.files).length > 0, 'the vectors file carries no input file');
  for (const vector of suite.vectors) {
    for (const role of ['baseline', 'run']) {
      const path = vector[role];
      if (!path) continue;
      assert.ok(
        Object.hasOwn(suite.files, path) || mayBeAbsent(vector, role),
        `${vector.id}: the ${role} ${path} is neither carried nor absent on purpose`
      );
    }
  }
  for (const [path, text] of Object.entries(suite.files)) assert.equal(typeof text, 'string', path);
});

test('the page links both published files by their address', () => {
  for (const file of ['vectors.json', 'baseline.schema.json']) {
    const address = `/spec/evals-baseline/${version}/${file}`;
    assert.ok(section.includes(`](${address})`), `the conformance section does not link ${address}`);
  }
});

test('the page no longer says the vectors are unpublished', () => {
  assert.doesNotMatch(section, /not published yet|no reader can test/);
});

test('the rows count every vector once, and the vectors that name two findings twice', () => {
  assert.ok(summary.mostFindings <= 2, 'a vector names more than two findings, which the page does not say');
  assert.equal(summary.rowTotal, summary.total - summary.noFinding + summary.twoFindings);
});

test('every vector that is not a check run names no finding, so the other runs the page counts are all of them', () => {
  assert.equal(summary.noFinding - summary.silentChecks, summary.total - summary.verbs.check);
});

const siteRoot = fileURLToPath(new URL('../../', import.meta.url));
const mirror = JSON.parse(readFileSync(new URL('mirror.json', folder), 'utf8'))['vectors.json'];
const reference = resolve(siteRoot, mirror.checkout, mirror.path);

test(
  'the vendored vectors are byte for byte the implementation file they were copied from',
  { skip: !existsSync(reference) && 'the implementation checkout is not on this machine, so nothing was compared' },
  () => {
    assert.deepEqual(mirrorProblems({ filePath: 'src/data/spec/evals-baseline-1.0.md' }, { root: siteRoot }), []);
  }
);
