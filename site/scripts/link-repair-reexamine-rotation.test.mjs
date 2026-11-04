import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import test from 'node:test';

import { MAX_REEXAMINED_PER_RUN, reexamineSearchRows, rotationOf } from './link-repair-reexamine.mjs';
import { reexamineWorld, registerRow, searched } from './fixtures/reexamine-world.mjs';

const originals = (count) =>
  Array.from({ length: count }, (_, index) => `https://example.org/doc-${String(index).padStart(3, '0')}`);
const dayAfter = (day, count) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + count * 86_400_000).toISOString().slice(0, 10);
const DAY = '2026-11-03';
const epochDays = (day) => Date.parse(`${day}T00:00:00Z`) / 86_400_000;

test('the limit is twenty originals a run', () => {
  assert.equal(MAX_REEXAMINED_PER_RUN, 20);
});

test('twenty originals or fewer are all examined, in sorted order, each once, whatever order they were listed in', () => {
  const list = originals(20);
  const shuffled = [...list].reverse();

  assert.deepEqual(rotationOf({ originals: shuffled, today: DAY }), list);
  assert.deepEqual(rotationOf({ originals: [...list.slice(0, 7), ...list.slice(0, 7)], today: DAY }), list.slice(0, 7));
  assert.deepEqual(rotationOf({ originals: [], today: DAY }), []);
});

test('more than twenty originals are cut to twenty, starting at the day number times twenty, counted round the sorted list', () => {
  const list = originals(45);
  const start = (epochDays(DAY) * 20) % 45;
  const chosen = rotationOf({ originals: list, today: DAY });

  assert.equal(chosen.length, 20);
  assert.deepEqual(
    chosen,
    Array.from({ length: 20 }, (_, offset) => list[(start + offset) % 45])
  );
  assert.equal(new Set(chosen).size, 20);
});

test('the choice is a function of the day and the list alone, so a second run on the same day chooses the same, and the next day another', () => {
  const list = originals(45);

  assert.deepEqual(
    rotationOf({ originals: list, today: DAY }),
    rotationOf({ originals: [...list].reverse(), today: DAY })
  );
  assert.notDeepEqual(
    rotationOf({ originals: list, today: DAY }),
    rotationOf({ originals: list, today: dayAfter(DAY, 1) })
  );
});

test('forty-five originals are all reached within three consecutive days, from whatever day the rotation starts', () => {
  const list = originals(45);
  for (let first = 0; first < 90; first += 1) {
    const reached = new Set(
      [0, 1, 2].flatMap((offset) => rotationOf({ originals: list, today: dayAfter('2026-01-01', first + offset) }))
    );
    assert.equal(reached.size, 45, `starting ${dayAfter('2026-01-01', first)}`);
  }
});

test('whatever the number of originals, the days walk the whole sorted list round and round with no original left out for ever', () => {
  for (const count of [21, 25, 39, 40, 41, 60, 61, 99, 100, 101, 237]) {
    const list = originals(count);
    const reached = new Set();
    const days = Math.ceil(count / MAX_REEXAMINED_PER_RUN) + 1;
    for (let offset = 0; offset < days; offset += 1) {
      for (const address of rotationOf({ originals: list, today: dayAfter(DAY, offset) })) reached.add(address);
    }
    assert.equal(reached.size, count, `${count} originals in ${days} days`);
  }
});

test('a day that is not a calendar day is refused, so the rotation can never start nowhere', () => {
  for (const today of ['', 'today', '2026-13-01', undefined]) {
    assert.throws(() => rotationOf({ originals: originals(30), today }), /calendar day/, String(today));
  }
});

test('through the whole pass, forty-five search rows that stay are all examined within three consecutive days, and never more than twenty in a run', async (t) => {
  const addresses = originals(45);
  const files = Object.fromEntries(
    addresses.map((original, index) => [`site/src/data/glossary/entry-${index}.md`, searched({ original })])
  );
  const rows = addresses.map((original, index) =>
    registerRow({ original, entry: `site/src/data/glossary/entry-${index}.md` })
  );
  const verdicts = Object.fromEntries(addresses.map((original) => [original, 'dead']));
  const reached = new Set();

  for (const offset of [0, 1, 2]) {
    const world = reexamineWorld({ files, rows, verdicts, empty: addresses });
    t.after(world.repo.remove);
    const result = await reexamineSearchRows({ ...world.inputs, today: dayAfter(DAY, offset) });

    assert.equal(result.of, 45);
    assert.equal(result.examined.length, 20);
    assert.equal(world.probed.length, 1);
    assert.equal(world.probed[0].length, 20);
    assert.deepEqual([...result.texts.keys()], []);
    for (const address of result.examined) reached.add(address);
  }
  assert.equal(reached.size, 45);
});
