import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import test from 'node:test';

import { searchFallbackUrl } from '../src/utils/archive-url.mjs';
import { archivedEntryText } from './citation-rewrites.mjs';
import { sweepLinks } from './link-repair-sweep.mjs';
import { REGISTER_PATH, registerProblems, sealRegister } from './link-rot-register.mjs';
import { WATCH_SCHEMA, emptyWatch, lapseEvidence, lapseSummary } from './link-rot-watch.mjs';
import { EMPTY_ADDRESS, GLOSSARY, NIST, TITLE, TODAY, citing, world } from './fixtures/link-repair-world.mjs';

const HOST = 'www.nist.gov';
const SNAPSHOT = 'https://web.archive.org/web/20230302214609/' + NIST;
const TEMPLATE = 'https://template.example/gone';
const sweep = (scene, changes = {}) => sweepLinks({ ...scene.inputs, ...changes });
const rowsOf = (result) => result.register.register?.rows ?? [];
const watchOf = (host, firstSeen, lastSeen, runs) => ({
  schema: WATCH_SCHEMA,
  hosts: { [host]: { firstSeen, lastSeen, runs } },
});
const lapseOf = (host, runs, firstSeen, lastSeen = TODAY) => ({ host, runs, firstSeen, lastSeen });
const IN_ONE_RUN = emptyWatch();
const IN_TWO_RUNS = watchOf(HOST, '2026-11-02', '2026-11-02', 1);
const IN_THREE_RUNS = watchOf(HOST, '2026-11-01', '2026-11-02', 2);
const unresolved = (...addresses) => Object.fromEntries(addresses.map((address) => [address, 'unresolved']));

const WITNESS = 'https://witness.example/ok';
const withWitness = (dist) =>
  Object.fromEntries(Object.entries(dist).map(([page, addresses]) => [page, [...addresses, WITNESS]]));
const lapsingWorld = ({ dist = { 'index.html': [NIST] }, ...options }) =>
  world({ ...options, dist: withWitness(dist) });
const probing = (resultOf) => async (addresses) =>
  new Map([...addresses].sort().map((address) => [address, { url: address, ...resultOf(address) }]));
const LAPSED_RESULT = { verdict: 'unresolved', status: null, reason: 'ENOTFOUND, ENOTFOUND, ENOTFOUND' };

test('with no watch state a name that does not resolve is nothing: no row, no file, no count, and the archive is not asked', async (t) => {
  const scene = lapsingWorld({ files: { [GLOSSARY]: citing() }, verdicts: unresolved(NIST) });
  t.after(scene.repo.remove);

  const result = await sweep(scene);

  assert.equal(result.files.size, 0);
  assert.deepEqual(result.counts, { dead: 0, archive: 0, search: 0, unplaced: 0, waiting: 0, watching: 0 });
  assert.deepEqual([result.lapsed, result.watching, result.watchState], [[], [], null]);
  assert.equal(result.witnessed, null);
  assert.deepEqual(scene.archive.requests(), []);
});

for (const [runs, watch, firstSeen] of [
  [1, IN_ONE_RUN, TODAY],
  [2, IN_TWO_RUNS, '2026-11-02'],
]) {
  test(`a host on its run number ${runs} is watched and nothing else: no file, no register row, no archive call, and the count says one host is watched`, async (t) => {
    const scene = lapsingWorld({ files: { [GLOSSARY]: citing() }, verdicts: unresolved(NIST) });
    t.after(scene.repo.remove);

    const result = await sweep(scene, { watch });

    assert.equal(result.files.size, 0);
    assert.equal(result.register.changed, false);
    assert.deepEqual(result.rows, []);
    assert.deepEqual(result.counts, { dead: 0, archive: 0, search: 0, unplaced: 0, waiting: 0, watching: 1 });
    assert.deepEqual(result.lapsed, []);
    assert.deepEqual(result.watching, [{ ...lapseOf(HOST, runs, firstSeen), addresses: [NIST] }]);
    assert.deepEqual(result.watchState.hosts, { [HOST]: { firstSeen, lastSeen: TODAY, runs } });
    assert.deepEqual(scene.archive.requests(), []);
  });
}

test('a host on its third run is dead: every citation of every address on it goes through the chain, with the evidence in each why', async (t) => {
  const second = 'site/src/data/post/second.md';
  const scene = lapsingWorld({ files: { [GLOSSARY]: citing(), [second]: citing() }, verdicts: unresolved(NIST) });
  t.after(scene.repo.remove);
  const before = scene.repo.read(GLOSSARY);

  const result = await sweep(scene, { watch: IN_THREE_RUNS });

  assert.equal(result.files.get(GLOSSARY), archivedEntryText({ text: before, url: NIST, archiveUrl: SNAPSHOT }));
  assert.deepEqual([...result.files.keys()].sort(), [REGISTER_PATH, GLOSSARY, second].sort());
  const evidence = lapseEvidence(lapseOf(HOST, 3, '2026-11-01'));
  assert.equal(
    evidence,
    'the host name www.nist.gov did not resolve on 3 consecutive scheduled runs, from 2026-11-01 to 2026-11-03'
  );
  assert.deepEqual(
    rowsOf(result).map(({ entry, outcome, replacement, firstSeenDead, why }) => [
      entry,
      outcome,
      replacement,
      firstSeenDead,
      why,
    ]),
    [GLOSSARY, second].map((entry) => [
      entry,
      'archive',
      SNAPSHOT,
      '2026-11-01',
      evidence +
        '; the Internet Archive capture of 2023-03-02 is 1 day from the citation date 2023-03-01 and carries the title',
    ])
  );
  assert.deepEqual(result.counts, { dead: 1, archive: 2, search: 0, unplaced: 0, waiting: 0, watching: 0 });
  assert.deepEqual(result.lapsed, [{ ...lapseOf(HOST, 3, '2026-11-01'), addresses: [NIST] }]);
  assert.deepEqual(registerProblems(JSON.parse(result.files.get(REGISTER_PATH))), []);
});

test('a host that is repaired is dropped from the state, so a name that comes back and goes again starts at one', async (t) => {
  const scene = lapsingWorld({ files: { [GLOSSARY]: citing() }, verdicts: unresolved(NIST) });
  t.after(scene.repo.remove);

  const result = await sweep(scene, { watch: IN_THREE_RUNS });

  assert.deepEqual(result.watchState, emptyWatch());
});

test('when the archive holds nothing the dead host rests on the search link, with the same evidence', async (t) => {
  const files = {
    [GLOSSARY]: citing({
      address: EMPTY_ADDRESS,
      retrieved: '2025-10-25',
      updatedDate: '2025-10-25',
      body: 'A sentence with no link.\n',
    }),
  };
  const scene = lapsingWorld({ files, dist: { 'index.html': [EMPTY_ADDRESS] }, verdicts: unresolved(EMPTY_ADDRESS) });
  t.after(scene.repo.remove);

  const result = await sweep(scene, { watch: watchOf('doi.org', '2026-11-01', '2026-11-02', 2) });

  const [row] = rowsOf(result);
  assert.equal(row.outcome, 'search');
  assert.equal(row.replacement, searchFallbackUrl({ title: TITLE, publisher: 'NIST' }));
  assert.equal(row.firstSeenDead, '2026-11-01');
  assert.ok(
    row.why.startsWith(lapseEvidence(lapseOf('doi.org', 3, '2026-11-01')) + '; no usable Internet Archive capture:'),
    row.why
  );
  assert.deepEqual(result.counts, { dead: 1, archive: 0, search: 1, unplaced: 0, waiting: 0, watching: 0 });
});

test('a dead host whose address no entry cites is unplaced, and its why carries no day that would change the row on the next find', async (t) => {
  const scene = lapsingWorld({ files: {}, dist: { 'index.html': [TEMPLATE] }, verdicts: unresolved(TEMPLATE) });
  t.after(scene.repo.remove);

  const first = await sweep(scene, { watch: watchOf('template.example', '2026-11-01', '2026-11-02', 2) });
  const [row] = rowsOf(first);

  assert.equal(row.outcome, 'unplaced');
  assert.equal(row.firstSeenDead, '2026-11-01');
  assert.equal(
    row.why,
    lapseSummary({ host: 'template.example' }) +
      '; no collection entry cites it, so it is linked from a template or a page that only a person can edit'
  );

  const later = await sweep(scene, {
    existing: first.register.register,
    today: '2026-11-09',
    watch: watchOf('template.example', '2026-11-07', '2026-11-08', 2),
  });

  assert.equal(later.register.changed, false);
  assert.equal(later.files.size, 0);
  assert.deepEqual(later.newUnplaced, []);
});

test('an archive that does not answer leaves the citation and keeps the host in the state, so the next day it is still dead', async (t) => {
  const scene = lapsingWorld({ files: { [GLOSSARY]: citing() }, verdicts: unresolved(NIST), down: true });
  t.after(scene.repo.remove);

  const waiting = await sweep(scene, { watch: IN_THREE_RUNS });

  assert.equal(waiting.files.size, 0);
  assert.deepEqual(waiting.counts, { dead: 1, archive: 0, search: 0, unplaced: 0, waiting: 1, watching: 0 });
  assert.deepEqual(waiting.watchState.hosts, { [HOST]: { firstSeen: '2026-11-01', lastSeen: TODAY, runs: 3 } });

  const up = lapsingWorld({ files: { [GLOSSARY]: citing() }, verdicts: unresolved(NIST) });
  t.after(up.repo.remove);
  const next = await sweep(up, { watch: waiting.watchState, today: '2026-11-04' });

  assert.equal(rowsOf(next)[0].outcome, 'archive');
  assert.match(
    rowsOf(next)[0].why,
    /^the host name www\.nist\.gov did not resolve on 4 consecutive scheduled runs, from 2026-11-01 to 2026-11-04;/
  );
  assert.deepEqual(next.watchState, emptyWatch());
});

test('addresses beyond the cap on a dead host wait for the next run, and the host stays in the state until none waits', async (t) => {
  const addresses = ['a', 'b', 'c'].map((name) => 'https://' + HOST + '/' + name);
  const scene = lapsingWorld({
    files: {},
    dist: { 'index.html': addresses },
    verdicts: unresolved(...addresses),
  });
  t.after(scene.repo.remove);

  const result = await sweep(scene, { watch: IN_THREE_RUNS, maxAddresses: 2 });

  assert.deepEqual(result.counts, { dead: 3, archive: 0, search: 0, unplaced: 2, waiting: 1, watching: 0 });
  assert.deepEqual(result.waitingForCap, [addresses[2]]);
  assert.deepEqual(result.watchState.hosts, { [HOST]: { firstSeen: '2026-11-01', lastSeen: TODAY, runs: 3 } });
});

test('a dead host and an address that answered 404 twice are both dead in one run, and only the host carries the evidence', async (t) => {
  const gone = 'https://other.example/gone';
  const scene = lapsingWorld({
    files: { [GLOSSARY]: citing(), 'site/src/data/post/other.md': citing({ address: gone }) },
    dist: { 'index.html': [NIST, gone] },
    verdicts: { [NIST]: 'unresolved', [gone]: 'dead' },
  });
  t.after(scene.repo.remove);

  const result = await sweep(scene, { watch: IN_THREE_RUNS });

  const byAddress = new Map(rowsOf(result).map((row) => [row.original, row]));
  assert.match(byAddress.get(NIST).why, /^the host name www\.nist\.gov did not resolve/);
  assert.ok(!byAddress.get(gone).why.includes('did not resolve'), byAddress.get(gone).why);
  assert.deepEqual(result.counts, { dead: 2, archive: 2, search: 0, unplaced: 0, waiting: 0, watching: 0 });
  assert.deepEqual(
    result.lapsed.map(({ host }) => host),
    [HOST]
  );
});

test('the earlier day a register already holds for an address wins over the day the streak began', async (t) => {
  const scene = lapsingWorld({ files: { [GLOSSARY]: citing() }, verdicts: unresolved(NIST) });
  t.after(scene.repo.remove);
  const existing = sealRegister({
    updatedOn: '2026-10-20',
    rows: [
      {
        original: NIST,
        entry: 'site/src/data/post/earlier.md',
        outcome: 'search',
        replacement: searchFallbackUrl({ title: TITLE, publisher: 'NIST' }),
        citedOn: '2023-03-01',
        firstSeenDead: '2026-10-20',
        why: 'an earlier repair',
      },
    ],
  });

  const result = await sweep(scene, { watch: IN_THREE_RUNS, existing });

  assert.equal(rowsOf(result).find(({ entry }) => entry === GLOSSARY).firstSeenDead, '2026-10-20');
});

test('one address answering is enough to clear a host: a host with a dead address and an answering one is not dead', async (t) => {
  const answering = 'https://' + HOST + '/answers';
  const scene = lapsingWorld({
    files: { [GLOSSARY]: citing() },
    dist: { 'index.html': [NIST, answering] },
    verdicts: { [NIST]: 'unresolved', [answering]: 'answered' },
  });
  t.after(scene.repo.remove);

  const result = await sweep(scene, { watch: IN_THREE_RUNS });

  assert.equal(result.files.size, 0);
  assert.deepEqual(result.watchState, emptyWatch());
  assert.deepEqual(result.counts, { dead: 0, archive: 0, search: 0, unplaced: 0, waiting: 0, watching: 0 });
});

test('a run that could not verify the host forgets its streak, and so does one that finds the host answering', async (t) => {
  for (const verdict of ['unverified', 'answered', 'dead']) {
    const scene = lapsingWorld({ files: {}, verdicts: { [NIST]: verdict } });
    t.after(scene.repo.remove);

    const result = await sweep(scene, { watch: IN_THREE_RUNS });

    assert.deepEqual(result.watchState, emptyWatch(), verdict);
    assert.deepEqual(result.lapsed, [], verdict);
  }
});

test('a host that is no longer linked anywhere in the build is pruned from the state', async (t) => {
  const scene = lapsingWorld({ files: {}, verdicts: {} });
  t.after(scene.repo.remove);
  const stale = watchOf('gone.example', '2026-11-01', '2026-11-02', 2);

  const result = await sweep(scene, { watch: stale });

  assert.deepEqual(result.watchState, emptyWatch());
});

test('a name that is unresolved is never counted dead by the 404 rule, so the dead list holds nothing for it before its third run', async (t) => {
  const scene = lapsingWorld({ files: { [GLOSSARY]: citing() }, verdicts: unresolved(NIST) });
  t.after(scene.repo.remove);

  const result = await sweep(scene, { watch: IN_TWO_RUNS });

  assert.deepEqual(result.dead, []);
  assert.deepEqual(result.waitingForCap, []);
});

test('a run in which no host answered is no sample at all: the state is exactly what it was, nothing is repaired even on a third day, and the run says it had no witness', async (t) => {
  const addresses = [NIST, TEMPLATE];
  const scene = world({
    files: { [GLOSSARY]: citing() },
    dist: { 'index.html': addresses },
    verdicts: unresolved(...addresses),
  });
  t.after(scene.repo.remove);
  const start = {
    schema: WATCH_SCHEMA,
    hosts: { ...IN_THREE_RUNS.hosts, 'template.example': { firstSeen: '2026-11-02', lastSeen: '2026-11-02', runs: 1 } },
  };

  const result = await sweep(scene, { watch: start });

  assert.equal(result.witnessed, false);
  assert.equal(result.files.size, 0);
  assert.deepEqual(result.watchState, start);
  assert.deepEqual(result.counts, { dead: 0, archive: 0, search: 0, unplaced: 0, waiting: 0, watching: 0 });
  assert.deepEqual([result.lapsed, result.watching, result.dead], [[], [], []]);
  assert.deepEqual(scene.archive.requests(), []);
});

test('a host that is alone in the build has no witness, so a third day does not make it dead (single-host world)', async (t) => {
  const scene = world({ files: { [GLOSSARY]: citing() }, verdicts: unresolved(NIST) });
  t.after(scene.repo.remove);

  const result = await sweep(scene, { watch: IN_THREE_RUNS });

  assert.equal(result.witnessed, false);
  assert.equal(result.files.size, 0);
  assert.deepEqual(result.watchState, IN_THREE_RUNS);
});

const OTHER_HOSTS = [
  ['a 503 on every attempt', { verdict: 'unverified', status: 503, reason: '503, 503, 503' }, true],
  ['a 403 on every attempt', { verdict: 'unverified', status: 403, reason: '403, 403, 403' }, true],
  ['a 200', { verdict: 'answered', status: 200, reason: '200' }, true],
  ['a 404 twice', { verdict: 'dead', status: 404, reason: '404, 404' }, true],
  ['a timeout on every attempt', { verdict: 'unverified', status: null, reason: 'timed out, timed out' }, false],
  ['a resolver that is busy', { verdict: 'unverified', status: null, reason: 'EAI_AGAIN, EAI_AGAIN' }, false],
  ['a refused connection', { verdict: 'unverified', status: null, reason: 'ECONNREFUSED, ECONNREFUSED' }, false],
  ['a name that does not resolve either', LAPSED_RESULT, false],
];

for (const [name, result, witnessed] of OTHER_HOSTS) {
  test(`only an HTTP answer of any kind is a witness: another host with ${name} is ${witnessed ? 'one' : 'not one'}`, async (t) => {
    const scene = world({
      files: { [GLOSSARY]: citing() },
      dist: { 'index.html': [NIST, WITNESS] },
      verdicts: {},
    });
    t.after(scene.repo.remove);
    const probeAll = probing((address) => (address === NIST ? LAPSED_RESULT : result));

    const swept = await sweep(scene, { watch: IN_THREE_RUNS, probeAll });

    assert.equal(swept.witnessed, witnessed);
    assert.equal(swept.files.size > 0, witnessed, 'a witnessed third day repairs, an unwitnessed one touches nothing');
    assert.deepEqual(
      swept.lapsed.map(({ host }) => host),
      witnessed ? [HOST] : []
    );
  });
}
