import assert from 'node:assert/strict';
import { test } from 'node:test';

import { closedOrigin, localServer, reply } from './fixtures/local-server.mjs';
import { probeUntilLive } from './live-probe.mjs';

const PAGE = 'https://site.test/blog/a-post';
const START = Date.parse('2026-11-03T09:00:00.000Z');
const SECONDS = (count) => count * 1000;
const FULL_WAIT = [5, 10, 15, 20, 30, 30, 30].map(SECONDS);

const clock = () => {
  let calls = 0;
  return () => new Date(START + SECONDS(calls++));
};

const sleeper = () => {
  const waits = [];
  return { waits, sleep: async (ms) => void waits.push(ms) };
};

const refused = Object.assign(new TypeError('fetch failed'), {
  cause: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:9'), { code: 'ECONNREFUSED' }),
});
const timedOut = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });

const scripted = (...outcomes) => {
  const seen = [];
  const released = [];
  const fetch = async (url, init) => {
    seen.push({ url, init });
    const outcome = outcomes[Math.min(seen.length - 1, outcomes.length - 1)];
    if (outcome instanceof Error) throw outcome;
    return { status: outcome, body: { cancel: async () => void released.push(url) } };
  };
  return { fetch, seen, released };
};

const probe = (fetch, options = {}) => {
  const { waits, sleep } = sleeper();
  return probeUntilLive({ url: PAGE, fetch, sleep, now: clock(), ...options }).then((result) => ({ result, waits }));
};

test('a page that answers 200 at once is live after one attempt, with no wait, a time limit and the time it was checked', async () => {
  const { fetch, seen } = scripted(200);
  const { result, waits } = await probe(fetch);
  assert.deepEqual(result, {
    reachable: true,
    status: 200,
    attempts: 1,
    checkedAt: '2026-11-03T09:00:00.000Z',
    failure: null,
  });
  assert.deepEqual(waits, []);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, PAGE);
  assert.ok(seen[0].init.signal instanceof AbortSignal, 'the request has no time limit');
});

test('a page that answers 404 twice and then 200 is live on the third attempt, after waiting 5 and 10 seconds', async () => {
  const { fetch, seen } = scripted(404, 404, 200);
  const { result, waits } = await probe(fetch);
  assert.deepEqual(result, {
    reachable: true,
    status: 200,
    attempts: 3,
    checkedAt: '2026-11-03T09:00:02.000Z',
    failure: null,
  });
  assert.deepEqual(waits, [SECONDS(5), SECONDS(10)]);
  assert.equal(seen.length, 3);
});

test('a page that never answers 2xx is asked exactly 8 times with growing waits, and the verdict is the last answer', async () => {
  const { fetch, seen } = scripted(503);
  const { result, waits } = await probe(fetch);
  assert.deepEqual(result, {
    reachable: false,
    status: 503,
    attempts: 8,
    checkedAt: '2026-11-03T09:00:07.000Z',
    failure: 'HTTP 503',
  });
  assert.equal(seen.length, 8);
  assert.deepEqual(waits, FULL_WAIT);
});

test('only a status from 200 to 299 is live', async () => {
  for (const status of [200, 201, 204, 299]) {
    const { result } = await probe(scripted(status).fetch, { attempts: 1 });
    assert.equal(result.reachable, true, String(status));
  }
  for (const status of [100, 199, 300, 301, 304, 399, 400, 403, 404, 410, 500, 503]) {
    const { result } = await probe(scripted(status).fetch, { attempts: 1 });
    assert.equal(result.reachable, false, String(status));
    assert.equal(result.failure, `HTTP ${status}`);
  }
});

test('a request that fails is not live, names the reason and has no status', async () => {
  const { result } = await probe(scripted(refused).fetch, { attempts: 2 });
  assert.deepEqual(result, {
    reachable: false,
    status: null,
    attempts: 2,
    checkedAt: '2026-11-03T09:00:01.000Z',
    failure: 'request failed: ECONNREFUSED',
  });
  const plain = await probe(scripted(new Error('socket hang up')).fetch, { attempts: 1 });
  assert.equal(plain.result.failure, 'request failed: socket hang up');
});

test('a request that gets no answer in time says how long it waited', async () => {
  const slow = await probe(scripted(timedOut).fetch, { attempts: 1 });
  assert.equal(slow.result.failure, 'no answer within 10 s');
  const shorter = await probe(scripted(timedOut).fetch, { attempts: 1, timeoutMs: 2500 });
  assert.equal(shorter.result.failure, 'no answer within 2.5 s');
});

test('a failed request followed by a 200 is live on the second attempt', async () => {
  const { result, waits } = await probe(scripted(refused, 200).fetch);
  assert.equal(result.reachable, true);
  assert.equal(result.attempts, 2);
  assert.deepEqual(waits, [SECONDS(5)]);
});

test('the body of every answer is released, whether the page is live or not', async () => {
  const live = scripted(200);
  await probe(live.fetch);
  const missing = scripted(404);
  await probe(missing.fetch, { attempts: 3 });
  assert.equal(live.released.length, 1);
  assert.equal(missing.released.length, 3);
});

test('a caller may choose fewer attempts and other waits, and the probe obeys', async () => {
  const { fetch, seen } = scripted(404);
  const { result, waits } = await probe(fetch, { attempts: 3, delaysMs: [0, 7, 9] });
  assert.equal(result.attempts, 3);
  assert.equal(seen.length, 3);
  assert.deepEqual(waits, [7, 9]);
});

test('a probe with no attempt or no wait list to read is refused, so it can never report a verdict it did not earn', async () => {
  await assert.rejects(probe(scripted(200).fetch, { attempts: 0 }), /at least one attempt/);
  await assert.rejects(probe(scripted(200).fetch, { delaysMs: [] }), /at least one wait/);
});

test('real HTTP: a server that answers 404 twice and then 200 is live on the third attempt', async (t) => {
  const server = await localServer(({ response, seen }) => reply(response, seen <= 2 ? 404 : 200));
  t.after(server.close);
  const { result, waits } = await probe(fetch, { url: `${server.origin}/page` });
  assert.equal(result.reachable, true);
  assert.equal(result.status, 200);
  assert.equal(result.attempts, 3);
  assert.deepEqual(waits, [SECONDS(5), SECONDS(10)]);
  assert.equal(server.requests.length, 3);
});

test('real HTTP: a redirect to a page that answers 200 is live, and the status is the last one', async (t) => {
  const server = await localServer(({ request, response }) =>
    request.url === '/moved' ? reply(response, 301, { location: '/page' }) : reply(response, 200, {}, 'the page')
  );
  t.after(server.close);
  const { result } = await probe(fetch, { url: `${server.origin}/moved` });
  assert.equal(result.reachable, true);
  assert.equal(result.status, 200);
  assert.equal(result.attempts, 1);
  assert.deepEqual(
    server.requests.map(({ url }) => url),
    ['/moved', '/page']
  );
});

test('real HTTP: a redirect that ends on a 404 is not live, and the last answer is the 404', async (t) => {
  const server = await localServer(({ request, response }) =>
    request.url === '/moved' ? reply(response, 302, { location: '/gone' }) : reply(response, 404)
  );
  t.after(server.close);
  const { result } = await probe(fetch, { url: `${server.origin}/moved` });
  assert.equal(result.reachable, false);
  assert.equal(result.status, 404);
  assert.equal(result.attempts, 8);
});

test('real HTTP: a redirect that never ends is not live and says why', async (t) => {
  const server = await localServer(({ response }) => reply(response, 302, { location: '/loop' }));
  t.after(server.close);
  const { result } = await probe(fetch, { url: `${server.origin}/loop`, attempts: 1 });
  assert.equal(result.reachable, false);
  assert.equal(result.failure, 'request failed: redirect count exceeded');
});

test('real HTTP: a server that never answers 2xx is asked exactly 8 times, with the full wait, and is not live', async (t) => {
  const server = await localServer(({ response }) => reply(response, 500));
  t.after(server.close);
  const { result, waits } = await probe(fetch, { url: `${server.origin}/page` });
  assert.equal(result.reachable, false);
  assert.equal(result.status, 500);
  assert.equal(result.attempts, 8);
  assert.equal(server.requests.length, 8);
  assert.deepEqual(waits, FULL_WAIT);
});

test('real HTTP: a closed port is not live, has no status and names the refused connection', async () => {
  const origin = await closedOrigin();
  const { result, waits } = await probe(fetch, { url: `${origin}/page` });
  assert.equal(result.reachable, false);
  assert.equal(result.status, null);
  assert.equal(result.attempts, 8);
  assert.equal(result.failure, 'request failed: ECONNREFUSED');
  assert.deepEqual(waits, FULL_WAIT);
});

test('real HTTP: a server that does not answer in time is not live, and the wait is the time limit', async (t) => {
  const server = await localServer(() => {});
  t.after(server.close);
  const { result } = await probe(fetch, {
    url: `${server.origin}/page`,
    attempts: 2,
    delaysMs: [0, 0],
    timeoutMs: 50,
  });
  assert.equal(result.reachable, false);
  assert.equal(result.attempts, 2);
  assert.equal(result.failure, 'no answer within 0.05 s');
});
