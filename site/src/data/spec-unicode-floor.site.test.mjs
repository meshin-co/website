import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const folder = new URL('./spec/evals-baseline-1.0/', import.meta.url);
const suite = JSON.parse(readFileSync(new URL('vectors.json', folder), 'utf8'));
const page = readFileSync(new URL('./spec/evals-baseline-1.0.md', import.meta.url), 'utf8');
const section = page.slice(page.indexOf('### Printed lines'), page.indexOf('## The baseline file'));

const hex = (point) => point.toString(16);
const label = (point) => `U+${hex(point).toUpperCase().padStart(4, '0')}`;

const SEVEN = [
  [0x2800, 'BRAILLE PATTERN BLANK'],
  [0xfffc, 'OBJECT REPLACEMENT CHARACTER'],
  [0x13441, 'EGYPTIAN HIEROGLYPH FULL BLANK'],
  [0x13442, 'EGYPTIAN HIEROGLYPH HALF BLANK'],
  [0x16fe4, 'KHITAN SMALL SCRIPT FILLER'],
  [0x11d45, 'MASARAM GONDI VIRAMA'],
  [0x11d97, 'GUNJALA GONDI VIRAMA'],
];

const ASSIGNED_AT_THE_FLOOR = [
  [0x00, 0x1f],
  [0x7f, 0x9f],
  [0xad, 0xad],
  [0x200d, 0x200d],
  [0x2028, 0x2028],
  [0x202e, 0x202e],
  [0xfe0f, 0xfe0f],
  [0xff21, 0xff21],
  [0xff5e, 0xff5e],
  [0x1f600, 0x1f600],
  [0xe0020, 0xe007f],
];

function stringsIn(root) {
  const strings = [];
  const pending = [root];
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value === 'string') strings.push(value);
    else if (Array.isArray(value)) for (const item of value) pending.push(item);
    else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        strings.push(key);
        pending.push(item);
      }
    }
  }
  return strings;
}

const parsedOrText = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

function pointsInTheVectors() {
  const inputs = [
    ...Object.values(suite.files).map(parsedOrText),
    ...suite.vectors.flatMap((entry) => [
      entry.argv,
      entry.stdout,
      entry.stderr,
      entry.writes.map(({ content }) => parsedOrText(content)),
    ]),
  ];
  return new Set(stringsIn(inputs).flatMap((text) => Array.from(text, (character) => character.codePointAt(0))));
}

test('the page fixes the printed set to Unicode 15.1 and lets no later edition change it', () => {
  assert.match(section, /The printed set is fixed to Unicode 15\.1, and it does not grow with a later edition\./);
  assert.match(
    section,
    /The printed set is U\+0020 and each code point to which Unicode 15\.1 gives the General_Category [LMNPS](?:, [LMNPS])* or [LMNPS] and does not give the Default_Ignorable_Code_Point property, except the seven code points named below\./
  );
  assert.match(section, /A code point that a later edition assigns is replaced, as an unassigned code point is\./);
  assert.match(
    section,
    /An implementation MUST print exactly this set, whatever edition of Unicode its language or library carries\./
  );
  assert.match(
    section,
    /built from the files `UnicodeData\.txt` and `DerivedCoreProperties\.txt` of Unicode 15\.1\.0\. As a check, the set holds 149,351 code points, in 721 runs of consecutive code points\./
  );
  assert.doesNotMatch(page, /or a later edition/);
  assert.doesNotMatch(page, /may print it as it is/);
});

test('the page names the seven code points that draw no ink, each by the name Unicode 15.1 gives it', () => {
  const sentence = /The seven code points are (.+?)\. Each is/.exec(section)?.[1];
  assert.ok(sentence, 'the page has no sentence that names the seven code points');
  const named = [...sentence.matchAll(/U\+([0-9A-F]{4,6}) ([A-Z][A-Z ]*?)(?=,| and U\+|$)/g)].map(([, point, name]) => [
    parseInt(point, 16),
    name,
  ]);
  assert.deepEqual(named, SEVEN);
  for (const [point] of SEVEN) {
    const character = String.fromCodePoint(point);
    assert.match(
      character,
      /^[\p{L}\p{M}\p{N}\p{P}\p{S}]$/u,
      `${label(point)} is not a letter, mark, number, punctuation or symbol`
    );
    assert.doesNotMatch(character, /\p{Default_Ignorable_Code_Point}/u, `${label(point)} is default ignorable`);
  }
});

test('the vectors hold nothing newer than Unicode 15.1, and none of the seven code points', () => {
  for (const [from, to] of ASSIGNED_AT_THE_FLOOR) {
    for (let point = from; point <= to; point += 1) {
      assert.doesNotMatch(String.fromCodePoint(point), /\p{Cn}/u, `${label(point)} is unassigned on this runtime`);
    }
  }
  const points = pointsInTheVectors();
  const unchecked = [...points]
    .filter(
      (point) =>
        (point < 0x20 || point > 0x7e) && !ASSIGNED_AT_THE_FLOOR.some(([from, to]) => point >= from && point <= to)
    )
    .map(label);
  assert.deepEqual(unchecked, [], 'check these against Unicode 15.1, then add them to ASSIGNED_AT_THE_FLOOR');
  assert.deepEqual(
    SEVEN.filter(([point]) => points.has(point)).map(([point]) => label(point)),
    []
  );
  assert.match(
    page,
    /No vector holds a code point that Unicode 15\.1 leaves unassigned, or one of the seven code points\./
  );
});
