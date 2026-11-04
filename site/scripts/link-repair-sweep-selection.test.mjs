import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import test from 'node:test';

import { SEARCH_ORIGIN, searchFallbackUrl } from '../src/utils/archive-url.mjs';
import { MAX_ADDRESSES_PER_RUN, SweepError, sweepLinks } from './link-repair-sweep.mjs';
import { REGISTER_PATH } from './link-rot-register.mjs';
import { citing, GLOSSARY, NIST, TITLE, TODAY, world } from './fixtures/link-repair-world.mjs';

const SNAPSHOT = 'https://web.archive.org/web/20230302214609/' + NIST;
const sweep = (scene, changes = {}) => sweepLinks({ ...scene.inputs, ...changes });
const rowsOf = (result) => result.register.register?.rows ?? [];

test('an address that could not be verified is not dead: nothing is repaired, nothing is counted, the archive is not asked', async (t) => {
  const scene = world({ files: { [GLOSSARY]: citing() }, verdicts: { [NIST]: 'unverified' } });
  t.after(scene.repo.remove);

  const result = await sweep(scene);

  assert.equal(result.files.size, 0);
  assert.deepEqual(result.counts, { dead: 0, archive: 0, search: 0, unplaced: 0, waiting: 0, watching: 0 });
  assert.deepEqual(scene.archive.requests(), []);
});

test('a dead address that no collection entry cites is unplaced, with the pages that carry it, and no file but the register is written', async (t) => {
  const template = 'https://template.example/gone';
  const scene = world({
    files: {},
    dist: { 'index.html': [template], 'about.html': [template, NIST], 'contact.html': [template] },
    verdicts: { [template]: 'dead' },
  });
  t.after(scene.repo.remove);

  const result = await sweep(scene);

  assert.deepEqual(rowsOf(result), [
    {
      original: template,
      entry: null,
      outcome: 'unplaced',
      replacement: null,
      citedOn: null,
      firstSeenDead: TODAY,
      why: 'no collection entry cites it, so it is linked from a template or a page that only a person can edit',
      pages: ['/', '/about', '/contact'],
    },
  ]);
  assert.deepEqual([...result.files.keys()], [REGISTER_PATH]);
  assert.deepEqual(result.counts, { dead: 1, archive: 0, search: 0, unplaced: 1, waiting: 0, watching: 0 });
  assert.deepEqual(scene.archive.requests(), []);
});

test('no more than twenty dead addresses are acted on in one run, the first twenty in sorted order, and the rest are counted as waiting', async (t) => {
  const addresses = Array.from(
    { length: 22 },
    (_, index) => 'https://gone.example/page-' + String(index).padStart(2, '0')
  );
  const scene = world({
    files: {},
    dist: { 'index.html': addresses },
    verdicts: Object.fromEntries(addresses.map((address) => [address, 'dead'])),
  });
  t.after(scene.repo.remove);

  const result = await sweep(scene);

  assert.equal(MAX_ADDRESSES_PER_RUN, 20);
  assert.equal(result.dead.length, 22);
  assert.deepEqual(result.waitingForCap, addresses.slice(20));
  assert.deepEqual(
    rowsOf(result).map(({ original }) => original),
    addresses.slice(0, 20)
  );
  assert.deepEqual(result.counts, { dead: 22, archive: 0, search: 0, unplaced: 20, waiting: 2, watching: 0 });
});

test('the cap can be set, and a run under it has nothing waiting for it', async (t) => {
  const addresses = ['https://gone.example/a', 'https://gone.example/b', 'https://gone.example/c'];
  const scene = world({
    files: {},
    dist: { 'index.html': addresses },
    verdicts: Object.fromEntries(addresses.map((address) => [address, 'dead'])),
  });
  t.after(scene.repo.remove);

  const capped = await sweep(scene, { maxAddresses: 1 });
  const free = await sweep(scene);

  assert.deepEqual(capped.waitingForCap, addresses.slice(1));
  assert.deepEqual(free.waitingForCap, []);
});

test('an address that is already a stand-in is never probed: not an archive snapshot, not a search link, and a row with an original is not asked about either', async (t) => {
  const search = searchFallbackUrl({ title: TITLE, publisher: 'NIST' });
  const scene = world({
    files: {},
    dist: {
      'index.html': [
        SNAPSHOT,
        search,
        'http://web.archive.org/web/2023/' + NIST,
        SEARCH_ORIGIN + '?q=anything',
        'https://alive.example/x',
      ],
    },
    verdicts: {},
  });
  t.after(scene.repo.remove);

  await sweep(scene);

  assert.deepEqual(scene.asked, [['https://alive.example/x']]);
});

test('an empty build is a job failure and not a clean bill: with no outbound address the run checked nothing', async (t) => {
  const scene = world({ files: {}, dist: { 'index.html': [] }, verdicts: {} });
  t.after(scene.repo.remove);

  await assert.rejects(
    sweep(scene),
    (error) => error instanceof SweepError && /holds no outbound address/.test(error.message)
  );
});

test('a build that is not there is a job failure that says to build first', async (t) => {
  const scene = world({ files: {}, dist: {}, verdicts: {} });
  t.after(scene.repo.remove);

  await assert.rejects(sweep(scene), (error) => error instanceof SweepError && /does not exist/.test(error.message));
});

test('a build whose only outbound links go to hosts the gate never asks is not empty, but nothing in it is asked either', async (t) => {
  const scene = world({ files: {}, dist: { 'index.html': ['https://www.linkedin.com/company/x'] }, verdicts: {} });
  t.after(scene.repo.remove);

  const result = await sweep(scene);

  assert.deepEqual(result.counts, { dead: 0, archive: 0, search: 0, unplaced: 0, waiting: 0, watching: 0 });
  assert.deepEqual(scene.asked, []);
});
