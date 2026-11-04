import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { FIRST_RUN_WINDOW_MS, StateError, announce, readState, selectEntries, writeState } from './live-state.mjs';

const NOW = new Date('2026-11-03T09:00:00.000Z');
const AT = '2026-11-03T08:59:00.000Z';
const HOUR = 60 * 60 * 1000;

const carriedAt = (route, ageMs) => ({ route, generatedAt: new Date(NOW.getTime() - ageMs).toISOString() });
const OLD = carriedAt('/blog/old', 30 * 24 * HOUR);
const YESTERDAY = carriedAt('/blog/yesterday', 24 * HOUR);
const JUST_NOW = carriedAt('/glossary/just-now', HOUR / 2);
const routesOf = (entries) => entries.map(({ route }) => route);

function inDirectory(body) {
  const directory = mkdtempSync(join(tmpdir(), 'live-state-'));
  try {
    return body(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const stateFileWith = (directory, content) => {
  const path = join(directory, '.live-entries.json');
  writeFileSync(path, content);
  return path;
};

test('a state file that does not exist is no state at all, which is how the first run is told from the others', () => {
  inDirectory((directory) => assert.equal(readState(join(directory, '.live-entries.json')), null));
});

test('a state file written is the state read back, with the routes in order and a final newline', () => {
  inDirectory((directory) => {
    const path = join(directory, 'nested', '.live-entries.json');
    writeState(path, { announced: { '/glossary/b': AT, '/blog/a': AT } });
    assert.equal(
      readFileSync(path, 'utf8'),
      `{\n  "announced": {\n    "/blog/a": "${AT}",\n    "/glossary/b": "${AT}"\n  }\n}\n`
    );
    assert.deepEqual(readState(path), { announced: { '/blog/a': AT, '/glossary/b': AT } });
  });
});

test('a state file that holds nothing yet is state, and not the first run', () => {
  inDirectory((directory) => {
    const path = join(directory, '.live-entries.json');
    writeState(path, { announced: {} });
    assert.deepEqual(readState(path), { announced: {} });
  });
});

const BROKEN = [
  ['text that is not JSON', 'not json', /is not readable JSON/],
  ['an empty file', '', /is not readable JSON/],
  ['a list', '[]', /must be a JSON object with one key, "announced"/],
  ['null', 'null', /must be a JSON object with one key, "announced"/],
  ['an object with no "announced"', '{}', /must be a JSON object with one key, "announced"/],
  ['a key besides "announced"', `{"announced":{},"seen":{}}`, /must be a JSON object with one key, "announced"/],
  ['an "announced" that is a list', '{"announced":["/blog/a"]}', /"announced" must map each route to/],
  ['a route that is no route', `{"announced":{"blog/a":"${AT}"}}`, /"blog\/a" is not a route/],
  [
    'an instant that is no instant',
    '{"announced":{"/blog/a":"yesterday"}}',
    /"\/blog\/a": "yesterday" is not a UTC instant/,
  ],
  ['an instant that is a number', '{"announced":{"/blog/a":1}}', /"\/blog\/a": 1 is not a UTC instant/],
];

for (const [name, content, problem] of BROKEN)
  test(`a state file holding ${name} is refused by name, so a damaged memory is never read as an empty one`, () => {
    inDirectory((directory) => {
      const path = stateFileWith(directory, content);
      assert.throws(
        () => readState(path),
        (error) => error instanceof StateError && error.message.includes(path) && problem.test(error.message)
      );
    });
  });

test('a state path that cannot be read at all is refused by name', () => {
  inDirectory((directory) => {
    const path = join(directory, 'a-directory');
    mkdirSync(path);
    assert.throws(
      () => readState(path),
      (error) => error instanceof StateError && error.message.includes(path)
    );
  });
});

test('announcing routes adds them with the instant, keeps the older ones as they were, and leaves the state it was given untouched', () => {
  const before = { announced: { '/blog/a': '2026-11-01T00:00:00.000Z' } };
  const after = announce(before, ['/blog/a', '/blog/b'], AT);
  assert.deepEqual(after, { announced: { '/blog/a': '2026-11-01T00:00:00.000Z', '/blog/b': AT } });
  assert.deepEqual(before, { announced: { '/blog/a': '2026-11-01T00:00:00.000Z' } });
  assert.deepEqual(announce(null, ['/blog/b'], AT), { announced: { '/blog/b': AT } });
  assert.deepEqual(announce(null, [], AT), { announced: {} });
});

test('once a state exists, an entry is new exactly when its route is not in it, whatever its age', () => {
  const state = { announced: { '/blog/yesterday': AT } };
  const { fresh, seeded } = selectEntries({ carried: [OLD, YESTERDAY, JUST_NOW], state, instant: NOW });
  assert.deepEqual(routesOf(fresh), ['/blog/old', '/glossary/just-now']);
  assert.deepEqual(seeded, []);
});

test('with every entry already announced, nothing is new and nothing is seeded', () => {
  const state = { announced: { '/blog/old': AT, '/blog/yesterday': AT } };
  assert.deepEqual(selectEntries({ carried: [OLD, YESTERDAY], state, instant: NOW }), { fresh: [], seeded: [] });
});

test('on the first run an entry made in the 48 hours before the publish is new, and every older one is only recorded', () => {
  const { fresh, seeded } = selectEntries({ carried: [OLD, YESTERDAY, JUST_NOW], state: null, instant: NOW });
  assert.deepEqual(routesOf(fresh), ['/blog/yesterday', '/glossary/just-now']);
  assert.deepEqual(routesOf(seeded), ['/blog/old']);
});

test('the first-run window is 48 hours exactly: an entry of exactly that age is new, one a second older is not', () => {
  assert.equal(FIRST_RUN_WINDOW_MS, 48 * HOUR);
  const edge = carriedAt('/blog/edge', 48 * HOUR);
  const past = carriedAt('/blog/past', 48 * HOUR + 1000);
  const { fresh, seeded } = selectEntries({ carried: [edge, past], state: null, instant: NOW });
  assert.deepEqual(routesOf(fresh), ['/blog/edge']);
  assert.deepEqual(routesOf(seeded), ['/blog/past']);
});

test('an entry dated after the publish, because two clocks disagree, is new rather than lost', () => {
  const future = carriedAt('/blog/future', -5 * HOUR);
  assert.deepEqual(routesOf(selectEntries({ carried: [future], state: null, instant: NOW }).fresh), ['/blog/future']);
});

test('the new entries come oldest first, so a message lists them in the order they were written', () => {
  const carried = [JUST_NOW, YESTERDAY, carriedAt('/blog/twin', 24 * HOUR)];
  const { fresh } = selectEntries({ carried, state: { announced: {} }, instant: NOW });
  assert.deepEqual(routesOf(fresh), ['/blog/twin', '/blog/yesterday', '/glossary/just-now']);
});

test('nothing carried is nothing new and nothing seeded, on the first run too', () => {
  assert.deepEqual(selectEntries({ carried: [], state: null, instant: NOW }), { fresh: [], seeded: [] });
});
