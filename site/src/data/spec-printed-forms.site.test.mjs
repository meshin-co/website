import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const folder = new URL('./spec/evals-baseline-1.0/', import.meta.url);
const suite = JSON.parse(readFileSync(new URL('vectors.json', folder), 'utf8'));
const page = readFileSync(new URL('./spec/evals-baseline-1.0.md', import.meta.url), 'utf8');
const section = page.slice(page.indexOf('### Printed lines'), page.indexOf('## The baseline file'));

const standardOutput = suite.vectors.flatMap((entry) => entry.stdout);
const printed = suite.vectors.flatMap((entry) => [...entry.stdout, ...entry.stderr]);

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const spans = (pattern) => [...section.matchAll(pattern)].map((found) => found[1]);

const FINDINGS = '(?:1 finding|(?:[2-9]|[1-9]\\d+) findings)';
const summaryOf = (template) => new RegExp(`^${escapeRegExp(template).replace('<findings>', FINDINGS)}$`);

test('every summary line the vectors print is one of the four forms the page gives, and each form is printed', () => {
  const templates = spans(/`(evals-baseline: [^`]+)`/g);
  assert.equal(templates.length, 4);
  const summaries = standardOutput.filter((line) => line.startsWith('evals-baseline: '));
  for (const line of summaries) {
    assert.equal(templates.filter((template) => summaryOf(template).test(line)).length, 1, line);
  }
  for (const template of templates) {
    assert.ok(
      summaries.some((line) => summaryOf(template).test(line)),
      template
    );
  }
  assert.doesNotMatch(page, /finding\(s\)/);
});

const COUNTED = /\b(\d+) (finding|sample|case|metric|day)(s|\(s\))?(?![a-z(])/g;

test('a count takes the plural of its noun unless it is 1, and the page shows each form it names', () => {
  for (const line of printed) {
    for (const [, count, noun, ending] of line.matchAll(COUNTED)) {
      if (ending !== '(s)') assert.equal(ending === 's', count !== '1', `${noun} in ${line}`);
    }
  }
  for (const example of ['1 finding', '2 findings', '1 sample', '4 samples']) {
    assert.ok(section.includes(`\`${example}\``), example);
    assert.ok(
      printed.some((line) => line.includes(example)),
      example
    );
  }
});

test('the page names every text that prints (s) as written, and no other text does', () => {
  const forms = spans(/`(<n> [^`]*\(s\)[^`]*)`/g).map(
    (template) => new RegExp(escapeRegExp(template).replace('<n>', '\\d+'))
  );
  const literal = printed.filter((line) => line.includes('(s)'));
  assert.equal(forms.length, 4);
  for (const line of literal) {
    assert.ok(
      forms.some((form) => form.test(line)),
      line
    );
  }
  for (const form of forms) {
    assert.ok(
      literal.some((line) => form.test(line)),
      String(form)
    );
  }
});

test('every character the vectors show escaped is in the set the page lists, and a [ is escaped only after ##', () => {
  const [item] = /1\. Text that came from a file[\s\S]*?(?=\n2\. )/.exec(section);
  const ranges = [...item.matchAll(/U\+([0-9A-F]{4})(?: to U\+([0-9A-F]{4}))?/g)].map(([, from, to]) => [
    parseInt(from, 16),
    parseInt(to ?? from, 16),
  ]);
  const escapes = printed.flatMap((line) => [...line.matchAll(/(##)?\\u([0-9a-f]{4})/g)]);
  assert.ok(escapes.length >= 10);
  for (const [, afterHashes, hex] of escapes) {
    const point = parseInt(hex, 16);
    if (point === 0x5b) assert.equal(afterHashes, '##');
    else
      assert.ok(
        ranges.some(([from, to]) => point >= from && point <= to),
        `U+${hex}`
      );
  }
  assert.match(item, /`\[` that directly follows `##`/);
});

test('a usage error writes to standard error alone, and every other report writes to standard output alone', () => {
  for (const { id, code, stdout, stderr } of suite.vectors) {
    if (code === 2) {
      assert.deepEqual(stdout, [], id);
      assert.ok(stderr.length > 0, id);
    } else {
      assert.deepEqual(stderr, [], id);
      assert.ok(stdout.length > 0, id);
    }
  }
  assert.match(page, /writes nothing to standard output/);
});

const WRITTEN = /^-?(?:0|[1-9]\d*)(?:\.\d{0,5}[1-9])?$/;

test('a number in a message has at most six decimals, no trailing zero and no bare decimal point', () => {
  const numbers = standardOutput.flatMap((line) => [
    ...[...line.matchAll(/^metric .+? {2}(\S+) {2}\d+ samples?$/g)].map((found) => found[1]),
    ...[...line.matchAll(/is below the baseline (\S+) by (\S+), more than the tolerance (\S+)$/g)].flatMap((found) =>
      found.slice(1)
    ),
    ...[...line.matchAll(/the baseline names it \((\S+) over/g)].map((found) => found[1]),
  ]);
  assert.ok(numbers.length >= 40);
  for (const number of numbers) assert.match(number, WRITTEN);
  assert.match(section, /to six decimals with the trailing zeros removed, and without a decimal point/);
});

test('the page names every form of spec that the vectors refuse for a third number or a leading zero', () => {
  const refusal = /spec must be MAJOR\.MINOR with no third number and no leading zeros, such as "1\.0", got "([^"]+)"/g;
  const refused = new Set([...printed.join('\n').matchAll(refusal)].map(([, value]) => value));
  assert.ok(refused.size >= 4);
  for (const value of refused) assert.ok(page.includes(`\`${value}\``), value);
});

test('the page names the vectors as the normative annex for exact text', () => {
  assert.match(page, /The published vectors are the normative annex for exact text/);
});
