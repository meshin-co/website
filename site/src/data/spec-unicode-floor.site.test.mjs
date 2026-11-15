import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const folder = new URL('./spec/evals-baseline-1.0/', import.meta.url);
const suite = JSON.parse(readFileSync(new URL('vectors.json', folder), 'utf8'));
const page = readFileSync(new URL('./spec/evals-baseline-1.0.md', import.meta.url), 'utf8');
const section = page.slice(page.indexOf('### Printed lines'), page.indexOf('## The baseline file'));

const hex = (point) => point.toString(16);

const MEASURED_UNICODE_OF_NODE = { '22.0.0': '15.1' };

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

function floorOnPage() {
  const edition = /from Unicode (\d+\.\d+) or a later edition/.exec(section)?.[1];
  const runtime = /the edition that Node\.js (\d+\.\d+\.\d+) carries, and Node\.js \1 is the oldest runtime/.exec(
    section
  )?.[1];
  assert.ok(edition && runtime, 'the page names no Unicode floor, or no runtime that carries it');
  return { edition, runtime };
}

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

test('the page names the Unicode edition it is judged against, and the vectors hold nothing newer', () => {
  const { edition, runtime } = floorOnPage();
  assert.equal(
    MEASURED_UNICODE_OF_NODE[runtime],
    edition,
    `Node.js ${runtime} has no measured Unicode edition ${edition}; run process.versions.unicode on it`
  );
  assert.ok(
    process.versions.unicode.localeCompare(edition, 'en', { numeric: true }) >= 0,
    `this runtime carries Unicode ${process.versions.unicode}, which is older than the floor ${edition}`
  );
  for (const [from, to] of ASSIGNED_AT_THE_FLOOR) {
    for (let point = from; point <= to; point += 1) {
      assert.doesNotMatch(String.fromCodePoint(point), /\p{Cn}/u, `U+${hex(point)} is unassigned on this runtime`);
    }
  }
  const inputs = [
    ...Object.values(suite.files).map(parsedOrText),
    ...suite.vectors.flatMap((entry) => [
      entry.argv,
      entry.stdout,
      entry.stderr,
      entry.writes.map(({ content }) => parsedOrText(content)),
    ]),
  ];
  const points = new Set(
    stringsIn(inputs).flatMap((text) => Array.from(text, (character) => character.codePointAt(0)))
  );
  const unchecked = [...points]
    .filter(
      (point) =>
        (point < 0x20 || point > 0x7e) && !ASSIGNED_AT_THE_FLOOR.some(([from, to]) => point >= from && point <= to)
    )
    .map((point) => `U+${hex(point).toUpperCase().padStart(4, '0')}`);
  assert.deepEqual(unchecked, [], `check these against Unicode ${edition}, then add them to ASSIGNED_AT_THE_FLOOR`);
});

const siteRoot = fileURLToPath(new URL('../../', import.meta.url));
const mirror = JSON.parse(readFileSync(new URL('mirror.json', folder), 'utf8'))['vectors.json'];
const implementationPackage = resolve(siteRoot, mirror.checkout, 'package.json');

test(
  'the runtime the page names as the oldest is the one the implementation declares',
  {
    skip:
      !existsSync(implementationPackage) &&
      'the implementation checkout is not on this machine, so nothing was compared',
  },
  () => {
    const { engines } = JSON.parse(readFileSync(implementationPackage, 'utf8'));
    const [, version] = /^>=(\d+(?:\.\d+){0,2})$/.exec(engines.node) ?? [];
    assert.ok(version, `engines.node is ${engines.node}, which names no oldest runtime`);
    assert.equal([...version.split('.'), '0', '0'].slice(0, 3).join('.'), floorOnPage().runtime);
  }
);
