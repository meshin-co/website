import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import test from 'node:test';

import { SEARCH_ORIGIN, searchFallbackUrl } from '../src/utils/archive-url.mjs';
import { archivedEntryText } from './citations.mjs';
import { sweepLinks } from './link-repair-sweep.mjs';
import { REGISTER_PATH, registerProblems } from './link-rot-register.mjs';
import { ok } from './fixtures/wayback-fakes.mjs';
import { citing, EMPTY_ADDRESS, GLOSSARY, NIST, TITLE, TODAY, world } from './fixtures/link-repair-world.mjs';

const SNAPSHOT = 'https://web.archive.org/web/20230302214609/' + NIST;
const STUB = '<html><body><h1>Page not found</h1><p>Nothing lives here any more.</p></body></html>';
const sweep = (scene, changes = {}) => sweepLinks({ ...scene.inputs, ...changes });
const rowsOf = (result) => result.register.register?.rows ?? [];
const registerOf = (result) => JSON.parse(result.files.get(REGISTER_PATH));

test('a dead address in a citation is replaced by the capture nearest the day it was cited, in the entry, and the register keeps the row', async (t) => {
  const scene = world({ files: { [GLOSSARY]: citing() } });
  t.after(scene.repo.remove);
  const before = scene.repo.read(GLOSSARY);

  const result = await sweep(scene);

  const rewritten = result.files.get(GLOSSARY);
  assert.equal(rewritten, archivedEntryText({ text: before, url: NIST, archiveUrl: SNAPSHOT }));
  assert.match(rewritten, new RegExp("url: '" + SNAPSHOT.replaceAll('.', '\\.') + "'"));
  assert.match(rewritten, new RegExp("original: '" + NIST.replaceAll('.', '\\.') + "'"));
  assert.match(
    rewritten,
    /\(https:\/\/web\.archive\.org\/web\/20230302214609\//,
    'the prose link points at the capture too'
  );
  assert.deepEqual(rowsOf(result), [
    {
      original: NIST,
      entry: GLOSSARY,
      outcome: 'archive',
      replacement: SNAPSHOT,
      citedOn: '2023-03-01',
      firstSeenDead: TODAY,
      why: 'the Internet Archive capture of 2023-03-02 is 1 day from the citation date 2023-03-01 and carries the title',
    },
  ]);
  assert.deepEqual(result.counts, { dead: 1, archive: 1, search: 0, unplaced: 0, waiting: 0 });
  assert.deepEqual([...result.files.keys()].sort(), [REGISTER_PATH, GLOSSARY]);
  assert.deepEqual(registerProblems(registerOf(result)), []);
});

test('only the address moves: every other byte of the entry is the one that was there', async (t) => {
  const scene = world({ files: { [GLOSSARY]: citing() } });
  t.after(scene.repo.remove);
  const before = scene.repo.read(GLOSSARY);

  const result = await sweep(scene);

  const after = result.files.get(GLOSSARY);
  const undone = after.replace(/\n {4}original: '[^']*'/g, '').replaceAll(SNAPSHOT, NIST);
  assert.equal(undone, before);
});

test('an archive with nothing near the citation date sends the citation to the search link built from its title and publisher, and the register says why', async (t) => {
  const scene = world({
    files: {
      [GLOSSARY]: citing({
        address: EMPTY_ADDRESS,
        retrieved: '2025-10-25',
        updatedDate: '2025-10-25',
        body: 'A sentence with no link.\n',
      }),
    },
    dist: { 'index.html': [EMPTY_ADDRESS] },
    verdicts: { [EMPTY_ADDRESS]: 'dead' },
  });
  t.after(scene.repo.remove);
  const search = searchFallbackUrl({ title: TITLE, publisher: 'NIST' });

  const result = await sweep(scene);

  const rewritten = result.files.get(GLOSSARY);
  assert.ok(rewritten.includes("url: '" + search + "'"), rewritten);
  assert.ok(rewritten.includes("original: '" + EMPTY_ADDRESS + "'"));
  const [row] = rowsOf(result);
  assert.equal(row.outcome, 'search');
  assert.equal(row.replacement, search);
  assert.ok(row.replacement.startsWith(SEARCH_ORIGIN));
  assert.match(row.why, /no usable Internet Archive capture: the archive holds no snapshot of https:\/\/doi\.org/);
  assert.equal(row.citedOn, '2025-10-25');
  assert.deepEqual(result.counts, { dead: 1, archive: 0, search: 1, unplaced: 0, waiting: 0 });
});

test('a capture whose page lacks the title is not the document that was cited, so the citation rests on a search link', async (t) => {
  const scene = world({ files: { [GLOSSARY]: citing() }, capture: ok(STUB, 'text/html') });
  t.after(scene.repo.remove);

  const result = await sweep(scene);

  const [row] = rowsOf(result);
  assert.equal(row.outcome, 'search');
  assert.match(row.why, /capture of 2023-03-02 does not carry the source title/);
  assert.ok(result.files.get(GLOSSARY).includes("url: '" + SEARCH_ORIGIN));
  assert.ok(!result.files.get(GLOSSARY).includes('web.archive.org'));
});

test('an archive that does not answer changes nothing, counts the citation as waiting and never falls to the search link', async (t) => {
  const scene = world({ files: { [GLOSSARY]: citing() }, down: true });
  t.after(scene.repo.remove);

  const result = await sweep(scene);

  assert.equal(result.files.size, 0);
  assert.equal(result.register.changed, false);
  assert.deepEqual(result.rows, []);
  assert.deepEqual(result.counts, { dead: 1, archive: 0, search: 0, unplaced: 0, waiting: 1 });
  assert.deepEqual(result.waitingForArchive, [{ address: NIST, entry: GLOSSARY }]);
});

test('a capture that is a PDF is accepted unchecked, and the register row says it was not checked', async (t) => {
  const scene = world({ files: { [GLOSSARY]: citing() }, capture: ok('%PDF-1.4', 'application/pdf') });
  t.after(scene.repo.remove);

  const result = await sweep(scene);

  const [row] = rowsOf(result);
  assert.equal(row.outcome, 'archive');
  assert.equal(row.replacement, SNAPSHOT);
  assert.match(row.why, /accepted unchecked/);
  assert.match(row.why, /application\/pdf/);
});

test('one entry citing two dead addresses is rewritten once, with both repairs in the one text', async (t) => {
  const second = 'https://other.example/gone';
  const both =
    "---\ntitle: 'Two sources'\nshortAnswer: 'x'\nupdatedDate: 2023-03-01\nsources:\n  - title: 'AI Risk Management Framework'\n    url: '" +
    NIST +
    "'\n    publisher: 'NIST'\n    retrieved: 2023-03-01\n  - title: 'AI Risk Management Framework'\n    url: '" +
    second +
    "'\n    publisher: 'NIST'\n    retrieved: 2023-03-01\n---\n\nBody.\n";
  const scene = world({
    files: { [GLOSSARY]: both },
    dist: { 'index.html': [NIST, second] },
    verdicts: { [NIST]: 'dead', [second]: 'dead' },
  });
  t.after(scene.repo.remove);

  const result = await sweep(scene);

  const text = result.files.get(GLOSSARY);
  assert.equal([...text.matchAll(/original: /g)].length, 2);
  assert.ok(text.includes("'" + NIST + "'") && text.includes(second));
  assert.deepEqual(
    rowsOf(result).map(({ original, outcome }) => [original, outcome]),
    [
      [second, 'archive'],
      [NIST, 'archive'],
    ].sort(([a], [b]) => (a < b ? -1 : 1))
  );
});

test('two entries citing one dead address on the same day cost one question to the archive, and both are repaired', async (t) => {
  const scene = world({ files: { [GLOSSARY]: citing(), 'site/src/data/post/second.md': citing() } });
  t.after(scene.repo.remove);

  const result = await sweep(scene);

  assert.equal(result.counts.archive, 2);
  assert.equal(scene.archive.requests().length, 2, 'one availability question and one capture read');
});

test('the archive is called ten seconds apart when the spacing is the real one, so a sweep of many citations never trips the 429', async (t) => {
  const second = 'https://other.example/gone';
  const scene = world({
    files: {
      [GLOSSARY]: citing(),
      'site/src/data/post/other.md': citing({ address: second, retrieved: '2023-03-01' }),
    },
    dist: { 'index.html': [NIST, second] },
    verdicts: { [NIST]: 'dead', [second]: 'dead' },
  });
  t.after(scene.repo.remove);

  await sweep(scene, { spacingMs: 10_000 });

  assert.deepEqual(scene.archive.naps, [10_000, 10_000, 10_000]);
});
