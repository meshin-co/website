import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NIST,
  OLDER,
  PAGE,
  SNAPSHOT,
  crashes,
  napper,
  noSleep,
  ok,
  refuses,
  scripted,
} from './fixtures/wayback-fakes.mjs';
import { autowriterAgent } from './site-brand.mjs';
import { ENDPOINT_VARIABLES, PLAYBACK_ORIGIN, readSnapshot } from './wayback.mjs';

const PLAYBACK = `${PLAYBACK_ORIGIN}/web/${OLDER.timestamp}id_/${NIST}`;
const read = (options) => readSnapshot({ snapshot: SNAPSHOT, env: {}, sleep: noSleep, ...options });
const streamed =
  (stream, type = 'text/html') =>
  () =>
    new Response(stream, { status: 200, headers: { 'content-type': type } });

test('the raw capture is fetched through the id_ address and its html comes back as text', async () => {
  const { fetch, requests } = scripted(ok(PAGE, 'text/html; charset=UTF-8'));

  const result = await read({ fetch });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].address, PLAYBACK);
  assert.deepEqual(result, { kind: 'page', contentType: 'text/html', text: PAGE });
});

test('an xhtml capture is read as a page too', async () => {
  const result = await read({ fetch: scripted(ok('<p>x</p>', 'application/xhtml+xml')).fetch });

  assert.deepEqual(result, { kind: 'page', contentType: 'application/xhtml+xml', text: '<p>x</p>' });
});

test('multi-byte characters split across chunks are read whole', async () => {
  const stream = new ReadableStream({
    start(controller) {
      for (const byte of new TextEncoder().encode(PAGE)) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    },
  });

  const result = await read({ fetch: scripted(streamed(stream)).fetch });

  assert.equal(result.text, PAGE);
});

test('the request names the bot, follows redirects and gives up after thirty seconds', async (t) => {
  const timeouts = [];
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    timeouts.push(milliseconds);
    return new AbortController().signal;
  });
  const { fetch, requests } = scripted(ok(PAGE, 'text/html'));

  await read({ fetch });

  const [{ init }] = requests;
  assert.equal(init.headers['User-Agent'], autowriterAgent());
  assert.equal(init.redirect, 'follow');
  assert.ok(init.signal instanceof AbortSignal);
  assert.deepEqual(timeouts, [30000]);
});

test('the playback address comes from the environment when set, and a blank value leaves the real one', async () => {
  const local = { [ENDPOINT_VARIABLES.playback]: 'http://127.0.0.1:4010/' };
  const blank = { [ENDPOINT_VARIABLES.playback]: ' ' };
  const served = scripted(ok(PAGE, 'text/html'));

  await read({ env: local, fetch: served.fetch });
  await read({ env: blank, fetch: served.fetch });

  const addresses = served.requests.map(({ address }) => address);
  assert.deepEqual(addresses, [`http://127.0.0.1:4010/web/${OLDER.timestamp}id_/${NIST}`, PLAYBACK]);
});

test('a capture of another content type is unreadable and the reason names the type', async () => {
  const types = [
    ['application/pdf', /application\/pdf/],
    ['image/png', /image\/png/],
    ['text/plain; charset=utf-8', /text\/plain/],
  ];

  for (const [type, reason] of types) {
    const result = await read({ fetch: scripted(ok('x', type)).fetch });
    assert.equal(result.kind, 'unreadable', type);
    assert.equal(result.cause, 'content-type', type);
    assert.match(result.reason, reason, type);
  }
  const untyped = await read({ fetch: scripted(() => new Response(Uint8Array.of(37, 80, 68, 70))).fetch });
  assert.equal(untyped.kind, 'unreadable');
  assert.equal(untyped.cause, 'content-type');
  assert.match(untyped.reason, /no content type/);
});

test('an archive that says no for good is unreadable and is asked once', async () => {
  for (const status of [400, 403, 404, 410, 451, 499]) {
    const { fetch, requests } = scripted(refuses(status));
    const { naps, sleep } = napper();

    const result = await read({ fetch, sleep });

    assert.equal(result.kind, 'unreadable', String(status));
    assert.equal(result.cause, 'status', String(status));
    assert.match(result.reason, new RegExp(String(status)));
    assert.equal(requests.length, 1);
    assert.deepEqual(naps, []);
  }
});

test('synthetic: a busy archive or a network error is retried and then unavailable, not unreadable', async () => {
  for (const failing of [refuses(429), refuses(500), refuses(503), crashes('fetch failed')]) {
    const { fetch, requests } = scripted(failing);

    const result = await read({ fetch });

    assert.equal(result.kind, 'unavailable');
    assert.equal(requests.length, 3);
  }
});

test('synthetic: a capture that is busy once and then served is read', async () => {
  const { fetch } = scripted(refuses(503), ok(PAGE, 'text/html'));

  const result = await read({ fetch });

  assert.equal(result.kind, 'page');
});

test('a body larger than maxBytes is cut at maxBytes and the rest of the stream is never read', async () => {
  let cancelled = false;
  let pulls = 0;
  const endless = new ReadableStream({
    pull(controller) {
      pulls += 1;
      controller.enqueue(new TextEncoder().encode('0123456789'));
    },
    cancel() {
      cancelled = true;
    },
  });

  const result = await read({ fetch: scripted(streamed(endless)).fetch, maxBytes: 25 });

  assert.deepEqual(result, { kind: 'page', contentType: 'text/html', text: '0123456789012345678901234' });
  assert.equal(cancelled, true);
  assert.ok(pulls < 10, `${pulls} pulls`);
});

test('a cut inside a multi-byte character drops the character instead of inventing one', async () => {
  const result = await read({ fetch: scripted(ok('€€€€', 'text/html')).fetch, maxBytes: 5 });

  assert.equal(result.text, '€');
});

test('the default ceiling is two mebibytes', async () => {
  const twoMebibytes = 2 * 1024 * 1024;

  const result = await read({ fetch: scripted(ok('a'.repeat(twoMebibytes + 10), 'text/html')).fetch });

  assert.equal(result.text.length, twoMebibytes);
});
