import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const folder = new URL('./spec/evals-baseline-1.0/', import.meta.url);
const suite = JSON.parse(readFileSync(new URL('vectors.json', folder), 'utf8'));
const page = readFileSync(new URL('./spec/evals-baseline-1.0.md', import.meta.url), 'utf8');
const section = page.slice(
  page.indexOf('## Exit codes'),
  page.indexOf('## Three properties every implementation keeps')
);

const REGRESSIONS = ['missing-metric', 'below-baseline', 'sample-count'];
const NOT_EVALUATED = ['unreadable-metric', 'no-baseline', 'bad-baseline', 'bad-run', 'internal-error'];
const FINDING = new RegExp(`^(${[...REGRESSIONS, ...NOT_EVALUATED, 'cases-changed'].join('|')})\\b`);

const rows = [...section.matchAll(/^\| (\d) +\| (.+?) +\|$/gm)].map(([, code, text]) => [Number(code), text]);
const named = (id) => `\`${id}\``;

const findingIds = (entry) => [...new Set(entry.stdout.map((line) => FINDING.exec(line)?.[1]).filter(Boolean))];
const strictCodeOf = (ids) => {
  if (ids.some((id) => REGRESSIONS.includes(id))) return 1;
  return ids.some((id) => NOT_EVALUATED.includes(id)) ? 3 : 0;
};

test('the page gives four exit codes, and each finding stands under the code that the rule gives it', () => {
  assert.match(section, /A command ends with one of four exit codes\./);
  assert.deepEqual(
    rows.map(([code]) => code),
    [0, 1, 2, 3]
  );
  const [zero, one, , three] = rows.map(([, text]) => text);
  assert.ok(zero.includes(named('cases-changed')));
  for (const id of REGRESSIONS) {
    assert.ok(one.includes(named(id)), `${id} is not in the row for 1`);
    assert.ok(!three.includes(named(id)), `${id} is in the row for 3`);
  }
  for (const id of NOT_EVALUATED) {
    assert.ok(three.includes(named(id)), `${id} is not in the row for 3`);
    assert.ok(!one.includes(named(id)), `${id} is in the row for 1`);
  }
  assert.match(
    section,
    /When a strict check holds a regression and a finding that could not be evaluated, the code is 1\./
  );
  assert.match(section, /The finding `cases-changed` is in neither kind and never changes the exit code\./);
});

test('every vector exits with the code that the page gives, and a code of 1 or 3 leaves standard error empty', () => {
  for (const entry of suite.vectors) {
    const [verb] = entry.argv;
    const text = entry.stdout.join('\n');
    if (entry.code === 2) {
      assert.deepEqual(entry.stdout, [], entry.id);
      assert.notDeepEqual(entry.stderr, [], entry.id);
      continue;
    }
    assert.deepEqual(entry.stderr, [], entry.id);
    let expected = 0;
    if (verb === 'check' && entry.argv.includes('--strict')) expected = strictCodeOf(findingIds(entry));
    if (verb === 'record' && / record: refused/.test(text)) expected = 3;
    if (verb === 'show' && / show: refused/.test(text)) expected = 3;
    assert.equal(entry.code, expected, entry.id);
  }
  const codes = new Set(suite.vectors.map((entry) => entry.code));
  assert.deepEqual([...codes].sort(), [0, 1, 2, 3]);
});

test('the code that a summary line names is the code that strict mode gives for the findings', () => {
  const checks = suite.vectors.filter((entry) => entry.argv[0] === 'check' && entry.code !== 2);
  const codesNamed = new Set();
  for (const entry of checks) {
    const summary = entry.stdout.find((line) => line.startsWith('evals-baseline: '));
    assert.ok(summary, entry.id);
    const code = /(?:to exit|; exit) ([13])\b/.exec(summary)?.[1];
    assert.equal(Number(code ?? 0), strictCodeOf(findingIds(entry)), `${entry.id}: ${summary}`);
    if (code) codesNamed.add(code);
  }
  assert.deepEqual([...codesNamed].sort(), ['1', '3']);
});

test('no vector holds a regression and a finding that could not be evaluated, and the page says so', () => {
  for (const entry of suite.vectors) {
    const ids = findingIds(entry);
    const both = ids.some((id) => REGRESSIONS.includes(id)) && ids.some((id) => NOT_EVALUATED.includes(id));
    assert.ok(!both, entry.id);
  }
  assert.match(page, /No vector holds a regression and a finding that could not be evaluated in one strict check\./);
});
