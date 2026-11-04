import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import test from 'node:test';

import { archivedEntryText } from './citation-rewrites.mjs';
import { reexamineSearchRows } from './link-repair-reexamine.mjs';
import { citing } from './fixtures/link-repair-world.mjs';
import {
  GLOSSARY,
  NIST,
  PARKED,
  TODAY,
  page,
  reexamineWorld,
  searchOf,
  searched,
  unchecked,
  unreadable,
} from './fixtures/reexamine-world.mjs';

const SNAPSHOT = `https://web.archive.org/web/20230302214609/${NIST}`;

const run = async (t, options) => {
  const world = reexamineWorld(options);
  t.after(world.repo.remove);
  return { ...world, result: await reexamineSearchRows(world.inputs) };
};

const nothingChanged = (result) => {
  assert.deepEqual([...result.texts.keys()], []);
  assert.deepEqual(result.entries, []);
  assert.deepEqual([result.restored, result.upgraded], [[], []]);
};

test('a row whose original answers again with its title goes back to the original, and the entry is the one it was before the machine touched it', async (t) => {
  const { result, repo } = await run(t);

  assert.deepEqual(
    result.restored.map(({ original, entry, citedOn, firstSeenDead, checked }) => ({
      original,
      entry,
      citedOn,
      firstSeenDead,
      checked,
    })),
    [{ original: NIST, entry: GLOSSARY, citedOn: '2023-03-01', firstSeenDead: '2026-10-20', checked: true }]
  );
  assert.equal(
    result.restored[0].why,
    `on ${TODAY} the original address answers again and its page carries the source title`
  );
  assert.deepEqual([...result.texts], [[GLOSSARY, citing({ address: NIST })]]);
  assert.deepEqual(result.entries, [GLOSSARY]);
  assert.deepEqual([result.upgraded, result.waiting, result.failures], [[], [], []]);
  assert.match(repo.read(GLOSSARY), /original:/, 'the pass computes, it does not write');
});

test('the pass asks the probe once for every address it examines, reads each answering page once, and asks the archive for nothing it restored', async (t) => {
  const { probed, livePagesRead, archive } = await run(t);

  assert.deepEqual(probed, [[NIST]]);
  assert.deepEqual(livePagesRead, [NIST]);
  assert.deepEqual(archive.requests(), []);
});

test('an original that answers with a page that lacks the title is not a restore: it is asked of the archive, and with nothing there the row stays', async (t) => {
  const { result, archive, livePagesRead } = await run(t, { pages: { [NIST]: page(PARKED) } });

  nothingChanged(result);
  assert.deepEqual(result.waiting, []);
  assert.deepEqual(livePagesRead, [NIST]);
  assert.ok(archive.requests().length > 0, 'the archive was asked');
});

test('a parked page that lacks the title, with a usable capture in the archive, is a move up to the archive and not a restore', async (t) => {
  const { result } = await run(t, { pages: { [NIST]: page(PARKED) }, empty: [] });

  assert.deepEqual(result.restored, []);
  assert.deepEqual(
    result.upgraded.map(({ original, entry, outcome, replacement, citedOn, firstSeenDead }) => ({
      original,
      entry,
      outcome,
      replacement,
      citedOn,
      firstSeenDead,
    })),
    [
      {
        original: NIST,
        entry: GLOSSARY,
        outcome: 'archive',
        replacement: SNAPSHOT,
        citedOn: '2023-03-01',
        firstSeenDead: '2026-10-20',
      },
    ]
  );
  assert.match(
    result.upgraded[0].why,
    /capture of 2023-03-02 is 1 day from the citation date 2023-03-01 and carries the title/
  );
  assert.match(result.upgraded[0].why, /the original address answers, but its page does not carry the source title/);
});

test('a document that is not text, such as a PDF, is accepted unchecked at the original address, and the reason says it was never read', async (t) => {
  const { result, archive } = await run(t, { pages: { [NIST]: unchecked('application/pdf') } });

  assert.deepEqual(
    result.restored.map(({ checked }) => checked),
    [false]
  );
  assert.equal(
    result.restored[0].why,
    `on ${TODAY} the original address answers again. It was accepted unchecked because the page is application/pdf, which the machine cannot read; a person must judge it`
  );
  assert.deepEqual([...result.texts.keys()], [GLOSSARY]);
  assert.deepEqual(archive.requests(), []);
});

test('an original that is still gone, with a usable capture in the archive now, moves up to the archive and keeps the day it was first seen dead', async (t) => {
  const { result } = await run(t, { verdicts: { [NIST]: 'dead' }, empty: [] });

  assert.deepEqual(result.restored, []);
  assert.equal(result.upgraded.length, 1);
  const entry = result.texts.get(GLOSSARY);
  assert.equal(entry, archivedEntryText({ text: citing({ address: NIST }), url: NIST, archiveUrl: SNAPSHOT }));
  assert.ok(entry.includes(`url: '${SNAPSHOT}'`));
  assert.ok(entry.includes(`original: '${NIST}'`));
  assert.ok(entry.includes(`](${SNAPSHOT})`));
  assert.ok(!entry.includes('google.com'), 'the search link is gone from the entry, prose included');
  assert.equal(result.upgraded[0].firstSeenDead, '2026-10-20');
});

test('an original that is still gone, with nothing usable in the archive, stays on its search link and nothing is changed', async (t) => {
  const { result, archive } = await run(t, { verdicts: { [NIST]: 'dead' } });

  nothingChanged(result);
  assert.deepEqual([result.waiting, result.failures], [[], []]);
  assert.ok(archive.requests().length > 0);
});

test('a capture that does not carry the title is not a move up, so the row stays', async (t) => {
  const { result } = await run(t, {
    verdicts: { [NIST]: 'dead' },
    empty: [],
    capture: () => new Response(PARKED, { status: 200, headers: { 'content-type': 'text/html' } }),
  });

  nothingChanged(result);
  assert.deepEqual(result.waiting, []);
});

test('a host name that does not resolve is as gone as a 404 for this pass, so the row stays and is not counted as waiting', async (t) => {
  const { result } = await run(t, { verdicts: { [NIST]: 'unresolved' } });

  nothingChanged(result);
  assert.deepEqual(result.waiting, []);
});

test('an archive that does not answer changes nothing and counts the row as waiting, whatever the original did', async (t) => {
  for (const verdict of ['dead', 'unresolved', 'unverified']) {
    const { result } = await run(t, { verdicts: { [NIST]: verdict }, down: true });

    nothingChanged(result);
    assert.equal(result.waiting.length, 1, verdict);
    assert.deepEqual(
      { original: result.waiting[0].original, entry: result.waiting[0].entry },
      { original: NIST, entry: GLOSSARY }
    );
    assert.match(result.waiting[0].why, /the Internet Archive did not answer/);
  }
});

test('an original that could not be asked is never a restore, and with nothing in the archive the row waits for the next time it is asked', async (t) => {
  const { result, livePagesRead } = await run(t, { verdicts: { [NIST]: 'unverified' } });

  nothingChanged(result);
  assert.deepEqual(livePagesRead, [], 'an address the probe could not reach is not read');
  assert.equal(result.waiting.length, 1);
  assert.match(result.waiting[0].why, /the original address could not be asked/);
  assert.match(result.waiting[0].why, /no usable Internet Archive capture/);
});

test('an original that could not be asked, with a usable capture in the archive, still moves up: the capture is a better source than a search', async (t) => {
  const { result } = await run(t, { verdicts: { [NIST]: 'unverified' }, empty: [] });

  assert.deepEqual(result.restored, []);
  assert.deepEqual(
    result.upgraded.map(({ replacement }) => replacement),
    [SNAPSHOT]
  );
  assert.deepEqual(result.waiting, []);
});

test('an original that answered the probe but could not be read afterwards is not a restore: the capture wins, and with none the row waits', async (t) => {
  const broken = { pages: { [NIST]: unreadable() } };
  const moved = await run(t, { ...broken, empty: [] });
  const waits = await run(t, broken);

  assert.deepEqual(
    moved.result.upgraded.map(({ replacement }) => replacement),
    [SNAPSHOT]
  );
  nothingChanged(waits.result);
  assert.equal(waits.result.waiting.length, 1);
  assert.match(waits.result.waiting[0].why, /the original address answered, but its page could not be read/);
});

test('a title too short to check a page against is never a restore, so the row stays', async (t) => {
  const files = { [GLOSSARY]: searched({ title: 'NIST', publisher: 'NIST' }) };
  const { result } = await run(t, { files, pages: { [NIST]: page('<h1>NIST</h1>') } });

  nothingChanged(result);
});

test('a row that carries an original but rests on a search nobody built from the row is not a search stand-in, so nothing is asked about it', async (t) => {
  const handMade = 'https://www.google.com/search?q=something+else';
  const files = { [GLOSSARY]: searched().replace(searchOf(), handMade).replace(searchOf(), handMade) };
  const { result, probed } = await run(t, { files });

  nothingChanged(result);
  assert.deepEqual(probed, []);
  assert.equal(result.of, 0);
});
