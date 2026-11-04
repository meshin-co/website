import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  INDEX,
  NIST,
  OLDER,
  SNAPSHOT,
  crashes,
  napper,
  noSleep,
  ok,
  recorded,
  recordedArchive,
  recording,
  refuses,
  scripted,
} from './fixtures/wayback-fakes.mjs';
import { autowriterAgent } from './site-brand.mjs';
import {
  AVAILABILITY_ENDPOINT,
  ENDPOINT_VARIABLES,
  PLAYBACK_ORIGIN,
  SNAPSHOT_WINDOW_DAYS,
  closestSnapshot,
} from './wayback.mjs';

const DOI = 'https://doi.org/10.6028/NIST.AI.100-1';
const OTHER_PAGE = `${NIST}/ai-rmf-development`;
const archived = (timestamp, original = NIST) => `http://web.archive.org/web/${timestamp}/${original}`;
const synthetic = (changes) =>
  ok(JSON.stringify({ url: NIST, archived_snapshots: { closest: { ...OLDER, ...changes } }, timestamp: '20230301' }));
const closest = (options) => closestSnapshot({ url: NIST, citedOn: '2023-03-01', env: {}, sleep: noSleep, ...options });

test('the contract names and defaults are what the other scripts and the end-to-end test rely on', () => {
  assert.equal(SNAPSHOT_WINDOW_DAYS, 180);
  assert.equal(AVAILABILITY_ENDPOINT, 'https://archive.org/wayback/available');
  assert.equal(PLAYBACK_ORIGIN, 'https://web.archive.org');
  assert.deepEqual(ENDPOINT_VARIABLES, {
    availability: 'WAYBACK_AVAILABILITY_URL',
    playback: 'WAYBACK_PLAYBACK_ORIGIN',
  });
});

test('every availability recording echoes the question the index says it answers', () => {
  for (const [file, { url, timestamp }] of Object.entries(INDEX)) {
    if (!file.startsWith('available-')) continue;
    const answer = JSON.parse(recording(file));
    assert.equal(answer.url, url, file);
    assert.equal(answer.timestamp ?? null, timestamp, file);
  }
});

test('the recordings hold four different captures of one page, and the newest answers the request with no date', () => {
  const stamps = ['far', 'older', 'newer', 'latest'].map(
    (name) => JSON.parse(recording(`available-${name}.json`)).archived_snapshots.closest.timestamp
  );

  assert.deepEqual(stamps, ['20210812045522', '20230302214609', '20260101233427', '20261029130534']);
});

test('the snapshot nearest the citation date is returned, never the newest the archive holds', async () => {
  const archive = recordedArchive();

  const result = await closest({ fetch: archive.fetch });

  assert.deepEqual(result, { kind: 'found', snapshot: SNAPSHOT });
  assert.equal(archive.requests.length, 1);
  assert.equal(
    archive.requests[0].address,
    `${AVAILABILITY_ENDPOINT}?url=${encodeURIComponent(NIST)}&timestamp=20230301`
  );
});

test('a later citation date gets the later recorded snapshot, so the answers differ with the date', async () => {
  const newer = await closest({ citedOn: '2026-01-01', fetch: recordedArchive().fetch });

  assert.equal(newer.kind, 'found');
  assert.equal(newer.snapshot.timestamp, '20260101233427');
  assert.equal(newer.snapshot.capturedOn, '2026-01-01');
  assert.equal(newer.snapshot.distanceDays, 0);
  assert.notEqual(newer.snapshot.url, SNAPSHOT.url);
});

test('the archive answers with an http address and the snapshot is returned as https', async () => {
  assert.match(OLDER.url, /^http:\/\/web\.archive\.org\/web\//);

  const { snapshot } = await closest({ fetch: recordedArchive().fetch });

  assert.equal(snapshot.url, `https://web.archive.org/web/${OLDER.timestamp}/${NIST}`);
});

test('an archive that holds nothing for the address gives none with a reason, and never a snapshot', async () => {
  const result = await closest({ url: DOI, citedOn: '2025-10-25', fetch: recordedArchive().fetch });

  assert.equal(result.kind, 'none');
  assert.match(result.reason, /no snapshot of https:\/\/doi\.org\/10\.6028\/NIST\.AI\.100-1/);
  assert.equal('snapshot' in result, false);
});

test('a snapshot years away is none and names the distance, and a wide enough window accepts it', async () => {
  const far = { citedOn: '2010-01-01', fetch: recordedArchive().fetch };

  const refused = await closest(far);
  const accepted = await closest({ ...far, windowDays: 4241 });
  const justShort = await closest({ ...far, windowDays: 4240 });

  assert.equal(refused.kind, 'none');
  assert.match(refused.reason, /2021-08-12/);
  assert.match(refused.reason, /4241 days/);
  assert.match(refused.reason, /180 days/);
  assert.equal(accepted.kind, 'found');
  assert.equal(accepted.snapshot.distanceDays, 4241);
  assert.equal(justShort.kind, 'none');
});

test('synthetic: the window is 180 days either side of the citation date and its edge is inside', async () => {
  const captures = [
    ['20230828235959', 'found'],
    ['20230829000000', 'none'],
    ['20220902000000', 'found'],
    ['20220901235959', 'none'],
  ];

  for (const [timestamp, kind] of captures) {
    const result = await closest({ fetch: scripted(synthetic({ timestamp, url: archived(timestamp) })).fetch });
    assert.equal(result.kind, kind, timestamp);
  }
});

test('synthetic: a snapshot that is not a usable capture of the cited address is none, naming the rule', async () => {
  const refused = [
    ['a capture that answered 404', { status: '404' }, /404/],
    ['a capture with no status', { status: undefined }, /status/],
    ['a snapshot the archive calls unavailable', { available: false }, /available/],
    ['a snapshot of another page', { url: archived(OLDER.timestamp, OTHER_PAGE) }, /ai-rmf-development/],
    ['an address that is no capture address', { url: NIST }, /capture address/],
    ['an address naming another capture than its timestamp', { url: archived('20230302214610') }, /20230302214610/],
    ['a timestamp of eight digits', { timestamp: '20230302' }, /20230302\b/],
  ];

  for (const [label, changes, reason] of refused) {
    const result = await closest({ fetch: scripted(synthetic(changes)).fetch });
    assert.equal(result.kind, 'none', label);
    assert.match(result.reason, reason, label);
  }
});

test('synthetic: an answer that is not availability JSON says nothing about the page: unavailable', async () => {
  const answers = [
    '',
    'not json',
    '<html>down for maintenance</html>',
    'null',
    '[]',
    '{}',
    '{"archived_snapshots": null}',
    '{"archived_snapshots": {"closest": "none"}}',
  ];

  for (const text of answers) {
    const result = await closest({ fetch: scripted(ok(text)).fetch });
    assert.equal(result.kind, 'unavailable', text);
    assert.equal(typeof result.reason, 'string', text);
  }
});

test('synthetic: a rate-limited archive is waited for as long as Retry-After says, then asked again', async () => {
  const { fetch, requests } = scripted(
    refuses(429, { 'Retry-After': '7' }),
    refuses(429, { 'Retry-After': '3' }),
    recorded('available-older.json')
  );
  const { naps, sleep } = napper();

  const result = await closest({ fetch, sleep });

  assert.deepEqual(result, { kind: 'found', snapshot: SNAPSHOT });
  assert.equal(requests.length, 3);
  assert.deepEqual(naps, [7000, 3000]);
});

test('synthetic: the wait is Retry-After seconds up to 30, otherwise two seconds and doubling', async () => {
  const waits = [
    [{ 'Retry-After': '120' }, [30000, 30000]],
    [{ 'Retry-After': '0' }, [0, 0]],
    [{ 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' }, [2000, 4000]],
    [{}, [2000, 4000]],
  ];

  for (const [headers, expected] of waits) {
    const { naps, sleep } = napper();
    await closest({ fetch: scripted(refuses(503, headers)).fetch, sleep });
    assert.deepEqual(naps, expected, JSON.stringify(headers));
  }
});

test('synthetic: failing on every attempt is unavailable, never none, with no wait after the last', async () => {
  const attempts = [
    [undefined, 3],
    [1, 1],
    [2, 2],
    [5, 5],
  ];

  for (const [given, made] of attempts) {
    const { fetch, requests } = scripted(refuses(429));
    const { naps, sleep } = napper();

    const result = await closest({ fetch, sleep, attempts: given });

    assert.equal(result.kind, 'unavailable', String(given));
    assert.match(result.reason, /429/);
    assert.equal(requests.length, made);
    assert.equal(naps.length, made - 1);
  }
});

test('synthetic: a network error is retried, then unavailable, naming the error and its cause', async () => {
  const { fetch, requests } = scripted(crashes('fetch failed', { code: 'ECONNREFUSED' }));

  const result = await closest({ fetch });

  assert.equal(result.kind, 'unavailable');
  assert.match(result.reason, /fetch failed: ECONNREFUSED/);
  assert.equal(requests.length, 3);
});

test('synthetic: a network error without a cause is reported by its message alone', async () => {
  const result = await closest({ fetch: scripted(crashes('socket hang up')).fetch });

  assert.match(result.reason, /: socket hang up$/);
});

test('synthetic: an archive that recovers after a server error and a dropped connection is believed', async () => {
  const { fetch } = scripted(refuses(503), crashes('fetch failed'), recorded('available-older.json'));

  const result = await closest({ fetch });

  assert.deepEqual(result, { kind: 'found', snapshot: SNAPSHOT });
});

test('synthetic: a 403 is unavailable with the status in the reason and is not retried', async () => {
  const { fetch, requests } = scripted(refuses(403));
  const { naps, sleep } = napper();

  const result = await closest({ fetch, sleep });

  assert.equal(result.kind, 'unavailable');
  assert.match(result.reason, /403/);
  assert.equal(requests.length, 1);
  assert.deepEqual(naps, []);
});

test('a citation date that is not a calendar date written YYYY-MM-DD is a TypeError, before any request', async () => {
  const wrong = ['', '2023-3-1', '20230301', '2023-02-30', '2023-13-01', '2023-03-01T00:00:00Z', ' 2023-03-01', null];

  for (const citedOn of [...wrong, undefined, 20230301, new Date('2023-03-01')]) {
    const { fetch, requests } = scripted(recorded('available-older.json'));
    await assert.rejects(closest({ citedOn, fetch }), TypeError, String(citedOn));
    assert.equal(requests.length, 0);
  }
});

test('the request names the bot, follows redirects and gives up after thirty seconds', async (t) => {
  const timeouts = [];
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    timeouts.push(milliseconds);
    return new AbortController().signal;
  });
  const { fetch, requests } = scripted(recorded('available-older.json'));

  await closest({ fetch });

  const [{ init }] = requests;
  assert.equal(init.headers['User-Agent'], autowriterAgent());
  assert.equal(init.redirect, 'follow');
  assert.ok(init.signal instanceof AbortSignal);
  assert.deepEqual(timeouts, [30000]);
});

test('the availability address comes from the environment, and a blank value leaves the real one', async () => {
  const local = { [ENDPOINT_VARIABLES.availability]: 'http://127.0.0.1:4010/wayback/available/' };
  const blank = { [ENDPOINT_VARIABLES.availability]: '  ' };
  const served = scripted(recorded('available-older.json'));

  await closest({ env: local, fetch: served.fetch });
  await closest({ env: blank, fetch: served.fetch });

  const addresses = served.requests.map(({ address }) => address);
  assert.deepEqual(addresses, [
    `http://127.0.0.1:4010/wayback/available?url=${encodeURIComponent(NIST)}&timestamp=20230301`,
    `${AVAILABILITY_ENDPOINT}?url=${encodeURIComponent(NIST)}&timestamp=20230301`,
  ]);
});
