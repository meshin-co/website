import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('./spec/evals-baseline-1.0.md', import.meta.url), 'utf8');

const section = page.slice(page.indexOf('## Conformance vectors'));

const tableRows = section
  .split('\n')
  .filter((line) => /^\| /.test(line) && !/^\| -/.test(line) && !/\| Vectors \|/.test(line))
  .map((line) => line.split('|').map((cell) => cell.trim()))
  .map(([, covered, vectors, pairs]) => ({ covered, vectors: Number(vectors), pairs: Number(pairs) }));

const numberAfter = (phrase) => Number(section.match(new RegExp(`${phrase} (\\d+)`))[1]);

test('every row of the coverage table carries two whole numbers', () => {
  assert.ok(tableRows.length >= 10, `only ${tableRows.length} rows parsed`);
  for (const row of tableRows) {
    assert.ok(Number.isInteger(row.vectors) && row.vectors > 0, row.covered);
    assert.ok(Number.isInteger(row.pairs) && row.pairs > 0, row.covered);
    assert.ok(row.pairs <= row.vectors, `${row.covered}: more pairs than vectors`);
  }
});

test('the stated row total is the sum of the rows, and the prose does not claim the rows partition the vectors', () => {
  const summed = tableRows.reduce((total, row) => total + row.vectors, 0);
  assert.equal(summed, numberAfter('The rows therefore total'));
  assert.match(section, /do not partition/);
});

test('no row claims more vectors than the specification says exist', () => {
  const all = numberAfter('Version 1.0 has');
  for (const row of tableRows) assert.ok(row.vectors <= all, `${row.covered} claims ${row.vectors} of ${all}`);
});

test('the verbs stated in the prose sum to the stated total', () => {
  const all = numberAfter('Version 1.0 has');
  const parts = [
    /(\d+) run `check`/,
    /(\d+) run `record`/,
    /(\d+) run `show`/,
    /(\d+) asks for the version/,
    /(\d+) are usage errors/,
  ].map((pattern) => Number(section.match(pattern)[1]));
  assert.equal(
    parts.reduce((a, b) => a + b, 0),
    all,
    `the five verb counts are ${parts.join(', ')}`
  );
});
