import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const folder = new URL('./spec/evals-baseline-1.0/', import.meta.url);
const suite = JSON.parse(readFileSync(new URL('vectors.json', folder), 'utf8'));
const page = readFileSync(new URL('./spec/evals-baseline-1.0.md', import.meta.url), 'utf8');
const between = (from, to) => page.slice(page.indexOf(from), page.indexOf(to));
const section = between('### Printed lines', '## The baseline file');
const rules = between('## Four comparison rules', '## Binding check');

const standardOutput = suite.vectors.flatMap((entry) => entry.stdout);
const printed = suite.vectors.flatMap((entry) => [...entry.stdout, ...entry.stderr]);

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const spans = (pattern) => [...section.matchAll(pattern)].map((found) => found[1]);

const FINDINGS = '(?:1 finding|(?:[2-9]|[1-9]\\d+) findings)';
const summaryOf = (template) =>
  new RegExp(`^${escapeRegExp(template).replace('<findings>', FINDINGS).replace('<code>', '[13]')}$`);
const NO_INK = new Set([0x2800, 0xfffc, 0x13441, 0x13442, 0x16fe4, 0x11d45, 0x11d97]);

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

const SPAN_BODY = String.raw`(?:[^"\\]|\\\\|\\u[0-9a-f]{4}|\\u\{[0-9a-f]{5,6}\})*`;
const QUOTED_SPANS = new RegExp(`"(${SPAN_BODY})"`, 'g');
const FIRST_CLAUSE = /1\. Text that came from a file[\s\S]*?(?=\n2\. )/;

const hex = (point) => point.toString(16);
const escapeOf = (point) => (point > 0xffff ? `\\u{${hex(point)}}` : `\\u${hex(point).padStart(4, '0')}`);

function printedRule() {
  const clause = FIRST_CLAUSE.exec(section)?.[0];
  assert.ok(clause, 'the page has no first clause under Printed lines');
  const categories = /General_Category ([LMNPS](?:, [LMNPS])* or [LMNPS])/.exec(clause)?.[1];
  assert.ok(categories, 'the page names no General_Category allow list');
  assert.doesNotMatch(
    clause,
    /U\+[0-9A-F]{4,6}(?: to | and )U\+[0-9A-F]{4,6}/,
    'the page still lists code points by range'
  );
  const classes = [...categories.matchAll(/[LMNPS]/g)].map(([category]) => `\\p{${category}}`).join('');
  const printedAsIs = new RegExp(`^(?: |(?!\\p{Default_Ignorable_Code_Point})[${classes}])$`, 'u');
  return { clause, isPrintedAsIs: (character) => !NO_INK.has(character.codePointAt(0)) && printedAsIs.test(character) };
}

function printedForm(text, isPrintedAsIs) {
  const characters = Array.from(text);
  return characters
    .map((character, index) => {
      if (character === '\\') return '\\\\';
      if (character === '"') return '\\u0022';
      const afterHashes = characters[index - 2] === '#' && characters[index - 1] === '#';
      const replaced = !isPrintedAsIs(character) || (character === '[' && afterHashes);
      return replaced ? escapeOf(character.codePointAt(0)) : character;
    })
    .join('');
}

const decoded = (body) =>
  body.replace(/\\(\\|u[0-9a-f]{4}|u\{[0-9a-f]{5,6}\})/g, (_, escape) =>
    escape === '\\' ? '\\' : String.fromCodePoint(parseInt(escape.slice(1).replace(/[{}]/g, ''), 16))
  );

test('every quoted span the vectors print is its text written by the rule the page states, and nothing replaced is raw', () => {
  const { isPrintedAsIs } = printedRule();
  const quoted = printed.flatMap((line) =>
    [...line.matchAll(QUOTED_SPANS)].map(([span, body]) => ({ line, span, body }))
  );
  assert.ok(quoted.length >= 400, `only ${quoted.length} quoted spans are printed`);
  for (const { line, span, body } of quoted) {
    assert.equal(`"${printedForm(decoded(body), isPrintedAsIs)}"`, span, line);
  }
  for (const line of printed) {
    for (const character of line) {
      assert.ok(isPrintedAsIs(character), `U+${hex(character.codePointAt(0))} is raw in ${line}`);
    }
    assert.doesNotMatch(line, /##\[/);
  }
  const shown = {
    'an escape': /\\u(?:[0-9a-f]{4}|\{[0-9a-f]{5,6}\})/,
    'a code point above U+FFFF': /\\u\{[0-9a-f]{5,6}\}/,
    'a [ after ##': /##\\u005b/,
    'a doubled backslash': /\\\\/,
    'a double quote': /\\u0022/,
  };
  for (const [what, pattern] of Object.entries(shown)) {
    assert.ok(
      quoted.some(({ body }) => pattern.test(body)),
      `no vector prints ${what}`
    );
  }
});

test('the page shows each escape form it names, and the vectors print it', () => {
  const { clause } = printedRule();
  assert.match(clause, /`\\u` and four lowercase hexadecimal digits/);
  assert.match(clause, /`\\u\{`, five or six lowercase hexadecimal digits and `\}`/);
  assert.match(clause, /a backslash is written as two backslashes, and a double quote is written as `\\u0022`/);
  assert.match(clause, /`\[` that directly follows `##`/);
  for (const example of ['\\u000a', '\\u{e0069}', '\\u0022']) {
    assert.ok(clause.includes(`\`${example}\``), example);
    assert.ok(
      printed.some((line) => line.includes(example)),
      example
    );
  }
});

const WRITTEN_FILE_RULE =
  /A character that the printed lines replace and that `JSON\.stringify` leaves as it is needs one more step\. It is then written as `\\u` and four lowercase hexadecimal digits for each of its UTF-16 code units\. The file does not replace a `\[` that follows `##`\./;

test('a baseline that record writes keeps no replaced character raw, and spells each UTF-16 code unit of one', () => {
  const { isPrintedAsIs } = printedRule();
  const written = suite.vectors.flatMap((entry) => entry.writes.map(({ content }) => content));
  const replaced = new Set();
  for (const content of written) {
    for (const character of content.replaceAll('\n', '')) {
      assert.ok(isPrintedAsIs(character), `U+${hex(character.codePointAt(0))} is raw in a written file`);
    }
    for (const key of Object.keys(JSON.parse(content).metrics)) {
      for (const character of Array.from(key).filter((each) => each.codePointAt(0) > 0x7e && !isPrintedAsIs(each))) {
        const units = Array.from({ length: character.length }, (_, index) => escapeOf(character.charCodeAt(index)));
        assert.ok(
          content.includes(units.join('')),
          `U+${hex(character.codePointAt(0))} is not spelled by its code units`
        );
        replaced.add(character);
      }
    }
  }
  assert.ok(replaced.size >= 4, 'no written file holds a replaced character');
  assert.ok(
    [...replaced].some((character) => character.length === 2),
    'no written file holds a replaced code point above U+FFFF'
  );
  assert.match(page, WRITTEN_FILE_RULE);
});

const SPAN_SOURCE = `"${SPAN_BODY}"`;
const NUMBER_SOURCE = String.raw`-?\d+(?:\.\d+)?`;
const SAMPLES_SOURCE = String.raw`(?:1 sample|(?!1 )\d+ samples)`;
const PLACEHOLDERS = {
  '"<key>"': SPAN_SOURCE,
  '<keys>': String.raw`${SPAN_SOURCE}(?:, ${SPAN_SOURCE})*(?:, and \d+ more)?`,
  '<n> samples': SAMPLES_SOURCE,
  '<b> samples': SAMPLES_SOURCE,
  '<r> samples': SAMPLES_SOURCE,
  '<n>': String.raw`\d+`,
  '<r>': String.raw`\d+`,
  '<value>': NUMBER_SOURCE,
  '<run value>': NUMBER_SOURCE,
  '<baseline value>': NUMBER_SOURCE,
  '<drop>': NUMBER_SOURCE,
  '<tolerance>': NUMBER_SOURCE,
  '<reason>': '.+',
};

const patternOf = (template) =>
  new RegExp(
    `^${template
      .split(/("<key>"|<[nbr]> samples|<[a-z ]+>)/)
      .map((part) => (Object.hasOwn(PLACEHOLDERS, part) ? PLACEHOLDERS[part] : escapeRegExp(part)))
      .join('')}$`
  );

function ruleLineTemplates() {
  const form = /`(<id> "<key>": <text>)`/.exec(rules)?.[1];
  assert.ok(form, 'the page gives no form for a finding line');
  const rows = rules
    .split('\n')
    .filter((line) => /^\| [1-4] /.test(line))
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim().replaceAll('`', ''))
    );
  assert.equal(rows.length, 4);
  const findings = new Map(
    rows
      .filter(([, , , id]) => id !== 'none')
      .map(([, , , id, message]) => [id, form.replace('<id>', id).replace('<text>', message)])
  );
  findings.set('unreadable-metric', form.replace('<id>', 'unreadable-metric').replace('<text>', '<reason>'));
  const notes = rows.filter(([, , , id]) => id === 'none').map(([, , , , message]) => message);
  return { findings, notes };
}

const noteTemplates = () =>
  [...page.matchAll(/^- .*, as `("<key>"[^`]*)`$/gm)].map(([, template]) => `note: ${template}`);

test('every finding and note form the page gives for a key is the form the vectors print', () => {
  const { findings, notes } = ruleLineTemplates();
  const forms = noteTemplates();
  assert.equal(forms.length, 3);
  for (const template of [...findings.values(), ...notes, ...forms]) {
    assert.ok(
      standardOutput.some((line) => patternOf(template).test(line)),
      `no vector prints ${template}`
    );
  }
  for (const line of standardOutput.map((each) => each.trimStart())) {
    for (const [id, template] of findings) {
      if (line.startsWith(`${id} `)) assert.match(line, patternOf(template), line);
    }
  }
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
const BELOW_BASELINE =
  /(\S+) over \d+ samples? is below the baseline (\S+) over \d+ samples? by (\S+), more than the tolerance (\S+)$/g;

test('a number in a message has at most six decimals, no trailing zero and no bare decimal point', () => {
  const numbers = standardOutput.flatMap((line) => [
    ...[...line.matchAll(/^metric .+? {2}(\S+) {2}\d+ samples?$/g)].map((found) => found[1]),
    ...[...line.matchAll(BELOW_BASELINE)].flatMap((found) => found.slice(1)),
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

test('the page names the vectors as the annex for exact text, and the clauses as what decides', () => {
  assert.match(page, /The published vectors are the annex for exact text/);
  assert.doesNotMatch(page, /normative annex/);
  assert.match(page, /Where this page gives only the form of a message, the vector gives its words/);
});
