import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  WATCH_SCHEMA,
  advanceWatch,
  emptyWatch,
  readWatch,
  watchProblems,
  watchText,
  writeWatch,
} from './link-rot-watch.mjs';

const HOST = 'lapsed.example';
const day = (number) => `2026-11-${String(number).padStart(2, '0')}`;
const entry = (firstSeen, lastSeen, runs) => ({ firstSeen: day(firstSeen), lastSeen: day(lastSeen), runs });
const stateOf = (hosts) => ({ schema: WATCH_SCHEMA, hosts });
const unresolvedPage = new Map([[`https://${HOST}/page-0`, 'unresolved']]);
const WITNESS = 'https://witness.example/ok';

function scratch(t) {
  const directory = mkdtempSync(join(tmpdir(), 'link-rot-watch-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

const VALID = stateOf({ [HOST]: entry(1, 3, 3) });
const INVALID = [
  ['not an object', null, /not a JSON object/],
  ['an array', [], /not a JSON object/],
  ['another schema', { ...VALID, schema: 2 }, /schema must be 1/],
  ['no hosts', { schema: 1 }, /hosts must be an object/],
  ['hosts as a list', { schema: 1, hosts: [] }, /hosts must be an object/],
  ['a key the writer never writes', { ...VALID, extra: 1 }, /key "extra"/],
  ['an entry that is not an object', stateOf({ [HOST]: 3 }), /lapsed\.example is not an object/],
  [
    'no runs',
    stateOf({ [HOST]: { firstSeen: day(1), lastSeen: day(1) } }),
    /lapsed\.example: runs must be a whole number/,
  ],
  ['zero runs', stateOf({ [HOST]: entry(1, 1, 0) }), /runs must be a whole number of at least 1/],
  ['half a run', stateOf({ [HOST]: entry(1, 1, 1.5) }), /runs must be a whole number of at least 1/],
  ['runs as text', stateOf({ [HOST]: { ...entry(1, 1, 1), runs: '1' } }), /runs must be a whole number of at least 1/],
  [
    'a first day that is not a day',
    stateOf({ [HOST]: { ...entry(1, 1, 1), firstSeen: '2026-02-30' } }),
    /firstSeen must be a calendar day/,
  ],
  [
    'a last day that is not a day',
    stateOf({ [HOST]: { ...entry(1, 1, 1), lastSeen: 'yesterday' } }),
    /lastSeen must be a calendar day/,
  ],
  ['a streak that ends before it began', stateOf({ [HOST]: entry(3, 1, 1) }), /firstSeen is after lastSeen/],
  ['a key an entry never has', stateOf({ [HOST]: { ...entry(1, 1, 1), note: 'x' } }), /key "note"/],
];

test('a state the writer could have written has no problem', () => {
  assert.deepEqual(watchProblems(VALID), []);
  assert.deepEqual(watchProblems(emptyWatch()), []);
});

for (const [name, state, problem] of INVALID) {
  test(`a state with ${name} is a problem the guard names`, () => {
    const problems = watchProblems(state);

    assert.ok(
      problems.some((line) => problem.test(line)),
      JSON.stringify(problems)
    );
  });
}

test('the text of a state is JSON with the hosts sorted, however they were added, and ends in a newline', () => {
  const state = stateOf({ 'b.example': entry(1, 1, 1), 'a.example': entry(2, 2, 1) });

  const text = watchText(state);

  assert.ok(text.endsWith('\n'));
  assert.deepEqual(Object.keys(JSON.parse(text).hosts), ['a.example', 'b.example']);
  assert.deepEqual(Object.keys(JSON.parse(text).hosts['a.example']), ['firstSeen', 'lastSeen', 'runs']);
  assert.equal(watchText(JSON.parse(text)), text);
});

test('a watch file that is not there reads as an empty state, and says so', (t) => {
  const path = join(scratch(t), 'missing', 'watch.json');

  const { state, note } = readWatch(path);

  assert.deepEqual(state, emptyWatch());
  assert.match(
    note,
    /the watch file .*missing\/watch\.json does not exist yet, so every host that does not resolve starts its count today/
  );
});

test('a watch file that is not JSON, or fails its guard, reads as an empty state with the reason, and never throws', (t) => {
  const directory = scratch(t);
  const cases = [
    ['{"schema": 1,', /is not JSON/],
    ['', /is not JSON/],
    ['{"schema":2,"hosts":{}}', /fails its guard \(schema must be 1/],
    [
      JSON.stringify(stateOf({ [HOST]: entry(1, 1, 0) })),
      /fails its guard \(lapsed\.example: runs must be a whole number/,
    ],
  ];
  for (const [index, [text, reason]] of cases.entries()) {
    const path = join(directory, `watch-${index}.json`);
    writeFileSync(path, text);

    const { state, note } = readWatch(path);

    assert.deepEqual(state, emptyWatch(), text);
    assert.match(note, reason);
    assert.match(note, /treated as empty/);
  }
});

test('a watch path that cannot be read, because it is a directory, reads as an empty state and says it cannot be read, not that it is not JSON', (t) => {
  const directory = scratch(t);

  const { state, note } = readWatch(directory);

  assert.deepEqual(state, emptyWatch());
  assert.match(note, /cannot be read \(EISDIR.*\), so it is treated as empty/);
  assert.ok(!note.includes('is not JSON'), note);
});

test('a corrupt watch file can never make a host dead: the streak it would have held starts again at one', (t) => {
  const path = join(scratch(t), 'watch.json');
  writeFileSync(path, '{ not json');

  const { state } = readWatch(path);
  const { lapsed, watching } = advanceWatch({ state, today: day(9), verdicts: unresolvedPage, responders: [WITNESS] });

  assert.deepEqual(lapsed, []);
  assert.deepEqual(
    watching.map(({ runs }) => runs),
    [1]
  );
});

test('a state that is written reads back the same, with no note', (t) => {
  const path = join(scratch(t), 'nested', 'watch.json');
  const state = stateOf({ [HOST]: entry(1, 2, 2) });

  writeWatch(path, state);
  const back = readWatch(path);

  assert.deepEqual(back.state, state);
  assert.equal(back.note, null);
  assert.equal(readFileSync(path, 'utf8'), watchText(state));
});

test('the file is written to a temporary name and renamed over the old one, so a reader never sees half a file', (t) => {
  const directory = scratch(t);
  const path = join(directory, 'watch.json');
  writeWatch(path, stateOf({ 'a.example': entry(1, 1, 1) }));

  writeWatch(path, stateOf({ [HOST]: entry(2, 2, 1) }));

  assert.deepEqual(readdirSync(directory), ['watch.json']);
  assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')).hosts, { [HOST]: entry(2, 2, 1) });
});

test('an empty state is written too, because a run that watches nothing still moves the file on', (t) => {
  const path = join(scratch(t), 'watch.json');
  mkdirSync(join(path, '..'), { recursive: true });
  writeWatch(path, stateOf({ [HOST]: entry(1, 1, 1) }));

  writeWatch(path, emptyWatch());

  assert.ok(existsSync(path));
  assert.deepEqual(readWatch(path).state, emptyWatch());
});
