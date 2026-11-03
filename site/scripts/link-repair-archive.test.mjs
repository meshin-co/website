import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import test from 'node:test';

import { ARCHIVE_SPACING_MS, archiveRung } from './link-repair-archive.mjs';
import { closestSnapshot, readSnapshot } from './wayback.mjs';
import {
  NIST,
  OLDER,
  PAGE,
  SNAPSHOT,
  napper,
  noSleep,
  ok,
  recordedArchive,
  refuses,
} from './fixtures/wayback-fakes.mjs';

const TITLE = 'AI Risk Management Framework';
const EMPTY_ADDRESS = 'https://doi.org/10.6028/NIST.AI.100-1';
const STUB = '<html><body><h1>Page not found</h1><p>Nothing lives here any more.</p></body></html>';

function archiveOf({ capture = ok(PAGE, 'text/html'), sleep = noSleep, spacingMs = 0 } = {}) {
  const recorded = recordedArchive();
  const captures = [];
  const fetch = async (address, init) => {
    if (!address.includes('/web/')) return recorded.fetch(address, init);
    captures.push(address);
    return capture();
  };
  const requests = () => [...recorded.requests.map(({ address }) => address), ...captures];
  const rung = archiveRung({
    closestSnapshot: (options) => closestSnapshot({ ...options, fetch, env: {}, sleep: noSleep }),
    readSnapshot: (options) => readSnapshot({ ...options, fetch, env: {}, sleep: noSleep }),
    sleep,
    spacingMs,
  });
  return { rung, availability: () => recorded.requests.length, captures: () => captures.length, requests };
}

const place = (rung, changes) => rung.place({ address: NIST, citedOn: '2023-03-01', title: TITLE, ...changes });

test('the pause between two archive calls is the ten seconds the real archive asks for', () => {
  assert.equal(ARCHIVE_SPACING_MS, 10_000);
});

test('a capture near the citation date that carries the title is the replacement, and it is the one nearest the date and not the newest', async () => {
  const { rung } = archiveOf();

  const placement = await place(rung);

  assert.equal(placement.kind, 'archive');
  assert.equal(placement.archiveUrl, SNAPSHOT.url);
  assert.equal(placement.archiveUrl, 'https://web.archive.org/web/20230302214609/' + NIST);
  assert.equal(placement.checked, true);
  assert.match(placement.why, /capture of 2023-03-02/);
  assert.match(placement.why, /1 day from the citation date 2023-03-01/);
  assert.match(placement.why, /carries the title/);
});

test('the request for the capture names the day the source was cited, so the archive can pick the nearest one', async () => {
  const { rung, requests } = archiveOf();

  await place(rung, { citedOn: '2026-01-01' });

  assert.match(requests()[0], /timestamp=20260101/);
  assert.ok(!requests()[0].includes('timestamp=2026102'), 'the newest capture was not what was asked for');
});

test('an archive that holds no snapshot sends the citation to the search link, and says why', async () => {
  const { rung } = archiveOf();

  const placement = await place(rung, { address: EMPTY_ADDRESS, citedOn: '2025-10-25' });

  assert.equal(placement.kind, 'search');
  assert.match(placement.why, /no usable Internet Archive capture/);
  assert.match(placement.why, /holds no snapshot of https:\/\/doi\.org\/10\.6028\/NIST\.AI\.100-1/);
});

test('a capture further than 180 days from the citation date is not the document that was cited, so it goes to the search link', async () => {
  const { rung } = archiveOf();

  const placement = await place(rung, { citedOn: '2010-01-01' });

  assert.equal(placement.kind, 'search');
  assert.match(placement.why, /no usable Internet Archive capture/);
  assert.match(placement.why, /the limit is 180 days/);
});

test('a capture that does not carry the title of the source is a different page, so it goes to the search link and names the capture', async () => {
  const { rung } = archiveOf({ capture: ok(STUB, 'text/html') });

  const placement = await place(rung);

  assert.equal(placement.kind, 'search');
  assert.match(placement.why, /capture of 2023-03-02 does not carry the source title/);
  assert.match(placement.why, /0 of the 3 title words/);
});

test('a title too short to check a page against cannot vouch for a capture, so the citation goes to the search link', async () => {
  const { rung } = archiveOf();

  const placement = await place(rung, { title: 'NIST' });

  assert.equal(placement.kind, 'search');
  assert.match(placement.why, /too short to check a page against/);
});

test('a capture the archive itself refuses to serve is unusable, so the citation goes to the search link and the status is named', async () => {
  const { rung } = archiveOf({ capture: refuses(404) });

  const placement = await place(rung);

  assert.equal(placement.kind, 'search');
  assert.match(placement.why, /capture of 2023-03-02 could not be read/);
  assert.match(placement.why, /HTTP 404/);
});

test('a capture that is a PDF cannot be read by a machine, so it is accepted unchecked and the reason says so', async () => {
  const { rung } = archiveOf({ capture: ok('%PDF-1.4', 'application/pdf') });

  const placement = await place(rung);

  assert.equal(placement.kind, 'archive');
  assert.equal(placement.archiveUrl, SNAPSHOT.url);
  assert.equal(placement.checked, false);
  assert.match(placement.why, /capture of 2023-03-02 is 1 day from the citation date 2023-03-01/);
  assert.match(placement.why, /application\/pdf/);
  assert.match(placement.why, /accepted unchecked/);
});

test('an archive that does not answer leaves the citation waiting, and never sends it to the search link', async () => {
  const down = archiveRung({
    closestSnapshot: async () => ({ kind: 'unavailable', reason: 'the archive answered HTTP 503' }),
    readSnapshot: async () => assert.fail('nothing was found, so nothing is read'),
    sleep: noSleep,
    spacingMs: 0,
  });

  const placement = await down.place({ address: NIST, citedOn: '2023-03-01', title: TITLE });

  assert.equal(placement.kind, 'waiting');
  assert.match(placement.why, /did not answer/);
  assert.match(placement.why, /HTTP 503/);
});

test('an archive that answers the availability question and then does not serve the capture leaves the citation waiting too', async () => {
  const down = archiveRung({
    closestSnapshot: async () => ({ kind: 'found', snapshot: SNAPSHOT }),
    readSnapshot: async () => ({ kind: 'unavailable', reason: 'the archive could not be asked after 3 attempts' }),
    sleep: noSleep,
    spacingMs: 0,
  });

  const placement = await down.place({ address: NIST, citedOn: '2023-03-01', title: TITLE });

  assert.equal(placement.kind, 'waiting');
  assert.match(placement.why, /did not answer/);
});

test('the same address cited on the same day is asked about once, and a different day is a different question', async () => {
  const { rung, availability, captures } = archiveOf();

  const first = await place(rung);
  const second = await place(rung);
  assert.deepEqual(second, first);
  assert.equal(availability(), 1);
  assert.equal(captures(), 1);

  await place(rung, { citedOn: '2026-01-01' });
  assert.equal(availability(), 2);
});

test('two archive calls are never closer than the spacing, and the first one is not delayed', async () => {
  const { naps, sleep } = napper();
  const { rung, requests } = archiveOf({ sleep, spacingMs: ARCHIVE_SPACING_MS });

  await place(rung);
  await place(rung, { citedOn: '2026-01-01' });

  assert.equal(requests().length, 4);
  assert.deepEqual(naps, [10_000, 10_000, 10_000]);
});

test('a citation answered from what was already asked costs no call and no pause', async () => {
  const { naps, sleep } = napper();
  const { rung, requests } = archiveOf({ sleep, spacingMs: ARCHIVE_SPACING_MS });

  await place(rung);
  await place(rung);

  assert.equal(requests().length, 2);
  assert.deepEqual(naps, [10_000]);
});

test('the capture recorded for the citation is what the archive reported, down to the address', async () => {
  const { rung } = archiveOf();

  const placement = await place(rung);

  assert.equal(placement.capture.timestamp, OLDER.timestamp);
  assert.equal(placement.capture.capturedOn, '2023-03-02');
  assert.equal(placement.capture.distanceDays, 1);
});
