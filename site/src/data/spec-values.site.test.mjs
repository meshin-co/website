import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const folder = new URL('./spec/evals-baseline-1.0/', import.meta.url);
const suite = JSON.parse(readFileSync(new URL('vectors.json', folder), 'utf8'));
const page = readFileSync(new URL('./spec/evals-baseline-1.0.md', import.meta.url), 'utf8');

const ROUNDING_RULE = 'floor(x * 1,000,000 + 0.5)';
const MICRO = 1000000;

const vector = (id) => suite.vectors.find((entry) => entry.id === id);
const runOf = (id) => JSON.parse(suite.files[vector(id).run]);
const q = (x) => Math.floor(x * MICRO + 0.5);

function printedValues(id) {
  const lines = vector(id).stdout.flatMap((line) => {
    const found = /^metric (.+?) {2}(\S+) {2}\d+ samples?$/.exec(line);
    return found ? [[found[1], found[2]]] : [];
  });
  return new Map(lines);
}

function tableRows(header) {
  const lines = page.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`| ${header} `));
  assert.notEqual(start, -1, `the page has no table headed ${header}`);
  const rows = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith('| ')) break;
    rows.push(
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim())
    );
  }
  return rows;
}

const ties = printedValues('S14-deepeval-decimal-ties-show');

test('the page states the rounding rule, and that rule gives every tie the vectors print', () => {
  assert.ok(page.includes(ROUNDING_RULE));
  assert.ok(ties.size >= 9);
  for (const [metric, value] of ties) {
    assert.equal(q(Number(metric.replace(/^tie /, ''))) / MICRO, Number(value), metric);
  }
});

test('the rounding table lists each mean, the double its product gives, and the value the vectors print', () => {
  const rows = tableRows('Mean of the scores');
  assert.ok(rows.length >= 4);
  for (const [mean, product, value] of rows) {
    assert.equal(String(Number(mean) * MICRO), product, mean);
    assert.equal(ties.get(`tie ${mean}`), value, mean);
  }
});

function compensatedSum(values) {
  let sum = 0;
  let carry = 0;
  for (const value of values) {
    const next = sum + value;
    carry += Math.abs(sum) >= Math.abs(value) ? sum - next + value : value - next + sum;
    sum = next;
  }
  return sum + carry;
}

test('the vectors fix the order of a sum: one at a time gives what they print, a compensated sum does not', () => {
  const id = 'S14-deepeval-sum-order-show';
  const { scores } = runOf(id).metricsScores.find((entry) => entry.metric === 'Accuracy');
  const printed = Number(printedValues(id).get('Accuracy'));
  const valueOf = (sum) => q(sum / scores.length) / MICRO;
  assert.equal(valueOf(scores.reduce((sum, score) => sum + score, 0)), printed);
  assert.notEqual(valueOf(compensatedSum(scores)), printed);
  assert.match(page, /one at a time from the first to the last/);
});

test('every range the page states is the one the vectors enforce, to the last whole number', () => {
  const refusal = vector('S16-baseline-value-4000000001').stdout.join('\n');
  const [, bound] = /between -(\d+) and \1/.exec(refusal);
  assert.ok(vector(`S16-promptfoo-show-value-${bound}`));
  assert.ok(vector(`S16-baseline-value-${Number(bound) + 1}`));
  const valueRanges = [...page.matchAll(/from -(\d+) to (\d+)/g)];
  assert.ok(valueRanges.length >= 2);
  for (const [, low, high] of valueRanges) assert.deepEqual([low, high], [bound, bound]);
  const toleranceRanges = [...page.matchAll(/from 0 to (\d+)/g)];
  assert.ok(toleranceRanges.length >= 2);
  for (const [, high] of toleranceRanges) assert.equal(high, bound);
  const wholeNumbers = [...page.matchAll(/(?<![\d.])\d{10,}(?![\d.])/g)].map(([number]) => number);
  assert.ok(wholeNumbers.length >= valueRanges.length + toleranceRanges.length);
  for (const number of wholeNumbers) assert.equal(number, bound);
  assert.doesNotMatch(page, /no range is assumed/);
});

const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function byCodePoint(a, b) {
  const [left, right] = [a, b].map((text) => Array.from(text, (character) => character.codePointAt(0)));
  const at = left.findIndex((point, index) => point !== right[index]);
  return at === -1 ? left.length - right.length : left[at] - (right[at] ?? -1);
}

function canonical(value, compare) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item, compare)).join(',')}]`;
  const members = Object.keys(value)
    .sort(compare)
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key], compare)}`);
  return `{${members.join(',')}}`;
}

const digestOf = (identity, compare) =>
  createHash('sha256').update(canonical(identity, compare), 'utf8').digest('hex').slice(0, 12);

test('the vectors fix sorting by UTF-16 code unit, which gives another digest than sorting by code point', () => {
  const id = 'S15-promptfoo-key-order-code-unit';
  const printed = /digest ([0-9a-f]{12})/.exec(vector(id).stdout[0])[1];
  const identity = runOf(id).results.results[0].testCase.vars;
  assert.equal(digestOf(identity, byCodeUnit), printed);
  assert.notEqual(digestOf(identity, byCodePoint), printed);
  assert.match(page, /UTF-16 code-unit order/);
});
