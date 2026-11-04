import assert from 'node:assert/strict';
import test from 'node:test';

import { startHost } from './fixtures/http-host.mjs';
import { scripted, timedOut, unreachable, waits } from './fixtures/probe-fakes.mjs';
import { ATTEMPTS, BACKOFF_MS, probe, probeAll, probeUserAgent } from './link-probe.mjs';

const URL_UNDER_TEST = 'https://standards.example/doc.pdf';

test('a document that answers a GET is answered after a single request', async () => {
  const fetch = scripted(200);
  const sleep = waits();

  const result = await probe(URL_UNDER_TEST, { fetch, sleep });

  assert.equal(result.verdict, 'answered');
  assert.equal(result.status, 200);
  assert.equal(fetch.calls.length, 1);
  assert.deepEqual(sleep.slept, []);
});

test('the request is a GET that follows redirects and says who is asking, never a HEAD', async () => {
  const fetch = scripted(200);

  await probe(URL_UNDER_TEST, { fetch, sleep: waits() });

  const [call] = fetch.calls;
  assert.equal(call.method, 'GET');
  assert.equal(call.redirect, 'follow');
  assert.equal(call.headers['user-agent'], probeUserAgent());
  assert.equal(probeUserAgent(), 'Mozilla/5.0 (compatible; meshin-link-check; +https://meshin.co)');
  assert.ok(call.signal instanceof AbortSignal);
});

test('404 on every attempt is dead, and it takes a second GET to say so', async () => {
  const fetch = scripted(404);
  const sleep = waits();

  const result = await probe(URL_UNDER_TEST, { fetch, sleep });

  assert.equal(result.verdict, 'dead');
  assert.equal(result.status, 404);
  assert.equal(fetch.calls.length, 2);
  assert.deepEqual(sleep.slept, [BACKOFF_MS[0]]);
});

test('410 proves a page is gone exactly as 404 does', async () => {
  assert.equal((await probe(URL_UNDER_TEST, { fetch: scripted(410), sleep: waits() })).verdict, 'dead');
  assert.equal((await probe(URL_UNDER_TEST, { fetch: scripted(404, 410), sleep: waits() })).verdict, 'dead');
});

test('a 404 that is followed by an answer is a host with a bad moment, not a dead link', async () => {
  const result = await probe(URL_UNDER_TEST, { fetch: scripted(404, 200), sleep: waits() });

  assert.equal(result.verdict, 'answered');
  assert.deepEqual(
    result.tries.map((attempt) => attempt.outcome),
    ['gone', 'answered']
  );
});

test('a GET that is cut off between two 404s does not undo them, and one 404 alone is never enough', async () => {
  assert.equal(
    (await probe(URL_UNDER_TEST, { fetch: scripted(404, timedOut(), 404), sleep: waits() })).verdict,
    'dead'
  );

  const once = await probe(URL_UNDER_TEST, {
    fetch: scripted(404, timedOut(), unreachable('ECONNRESET')),
    sleep: waits(),
  });
  assert.equal(once.verdict, 'unverified');
  assert.equal(once.reason, '404, timed out, ECONNRESET');
});

test('a timeout is not a 404: a host that never answers is unverified after every attempt', async () => {
  const fetch = scripted(timedOut());
  const sleep = waits();

  const result = await probe(URL_UNDER_TEST, { fetch, sleep });

  assert.equal(result.verdict, 'unverified');
  assert.equal(result.status, null);
  assert.equal(result.reason, 'timed out, timed out, timed out');
  assert.equal(fetch.calls.length, ATTEMPTS);
  assert.deepEqual(sleep.slept, BACKOFF_MS);
});

test('a rate limit is waited out for as long as the host asks, up to a cap, and then reported unverified', async () => {
  const sleep = waits();
  const limited = (seconds) => ({ status: 429, headers: { 'retry-after': String(seconds) } });

  const result = await probe(URL_UNDER_TEST, { fetch: scripted(limited(7), limited(900), 429), sleep });

  assert.equal(result.verdict, 'unverified');
  assert.equal(result.reason, '429, 429, 429');
  assert.deepEqual(sleep.slept, [7000, 30000]);
});

test('a rate limit that lifts is answered', async () => {
  const result = await probe(URL_UNDER_TEST, {
    fetch: scripted({ status: 429, headers: { 'retry-after': '2' } }, 200),
    sleep: waits(),
  });

  assert.equal(result.verdict, 'answered');
});

test('a refusal, a server error and an unreachable host are each unverified, never dead', async () => {
  for (const step of [401, 403, 405, 451, 500, 502, 503, unreachable('EAI_AGAIN'), unreachable('ECONNREFUSED')]) {
    const result = await probe(URL_UNDER_TEST, { fetch: scripted(step), sleep: waits() });
    assert.equal(result.verdict, 'unverified', String(step));
  }
});

test('an address that cannot be a request is unverified with a reason, not an exception', async () => {
  const result = await probe('https://', { fetch: scripted(new TypeError('Invalid URL')), sleep: waits() });

  assert.equal(result.verdict, 'unverified');
});

test('the same answers give the same verdict and the same record, run after run', async () => {
  const run = () => probe(URL_UNDER_TEST, { fetch: scripted(404, timedOut(), 404), sleep: waits() });

  assert.deepEqual(await run(), await run());
});

test('on a real host that refuses HEAD and serves GET, the document is answered and no HEAD is sent', async () => {
  const host = await startHost((req, res) => {
    if (req.method === 'HEAD') return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': 'application/pdf' });
    res.end('%PDF-1.7');
  });
  try {
    const result = await probe(`${host.origin}/doc.pdf`, { sleep: waits() });

    assert.equal(result.verdict, 'answered');
    assert.equal(host.count('HEAD'), 0);
    assert.equal(host.requests[0].headers['user-agent'], probeUserAgent());
  } finally {
    await host.close();
  }
});

test('on a real host a redirect is followed to the document, and the verdict is about where it ends', async () => {
  const host = await startHost((req, res) => {
    if (req.url === '/doi') return res.writeHead(302, { location: '/files/doc.pdf' }).end();
    if (req.url === '/files/doc.pdf' && req.method === 'GET') return res.writeHead(200).end('%PDF');
    res.writeHead(404).end();
  });
  try {
    const answered = await probe(`${host.origin}/doi`, { sleep: waits() });
    assert.equal(answered.verdict, 'answered');
    assert.equal(answered.finalUrl, `${host.origin}/files/doc.pdf`);

    const moved = await startHost((req, res) => {
      if (req.url === '/doi') return res.writeHead(301, { location: '/gone' }).end();
      res.writeHead(404).end();
    });
    try {
      const dead = await probe(`${moved.origin}/doi`, { sleep: waits() });
      assert.equal(dead.verdict, 'dead');
      assert.equal(dead.finalUrl, `${moved.origin}/gone`);
    } finally {
      await moved.close();
    }
  } finally {
    await host.close();
  }
});

test('on a real host that stalls, the attempt gives up at the timeout and the verdict is unverified', async () => {
  const sockets = new Set();
  const host = await startHost((req) => sockets.add(req.socket));
  try {
    const result = await probe(`${host.origin}/slow`, { sleep: waits(), timeoutMs: 80, attempts: 2 });

    assert.equal(result.verdict, 'unverified');
    assert.equal(result.reason, 'timed out, timed out');
  } finally {
    for (const socket of sockets) socket.destroy();
    await host.close();
  }
});

test('many addresses are probed host by host, one request at a time to a host, and the results come back in address order', async () => {
  const inFlight = new Map();
  const peak = new Map();
  let overall = 0;
  let overallPeak = 0;
  const probeOne = async (address) => {
    const { host } = new URL(address);
    inFlight.set(host, (inFlight.get(host) ?? 0) + 1);
    peak.set(host, Math.max(peak.get(host) ?? 0, inFlight.get(host)));
    overall += 1;
    overallPeak = Math.max(overallPeak, overall);
    await new Promise((resolve) => setImmediate(resolve));
    inFlight.set(host, inFlight.get(host) - 1);
    overall -= 1;
    return { url: address, verdict: 'answered' };
  };
  const addresses = [
    'https://b.example/2',
    'https://a.example/1',
    'https://a.example/3',
    'https://c.example/1',
    'https://a.example/2',
    'https://b.example/1',
  ];
  const sleep = waits();

  const results = await probeAll(addresses, { probeOne, concurrency: 2, hostGapMs: 500, sleep });

  assert.deepEqual([...results.keys()], [...addresses].sort());
  assert.equal(Math.max(...peak.values()), 1, 'a host is never asked twice at the same moment');
  assert.equal(overallPeak, 2);
  assert.equal(sleep.slept.filter((ms) => ms === 500).length, 3, 'a gap between consecutive requests to one host');
});

test('probing the same addresses twice gives the same results, whatever order they arrive in', async () => {
  const probeOne = async (address) => ({ url: address, verdict: address.endsWith('/gone') ? 'dead' : 'answered' });
  const addresses = ['https://x.example/gone', 'https://y.example/ok', 'https://x.example/ok'];

  const first = await probeAll(addresses, { probeOne, sleep: waits() });
  const second = await probeAll([...addresses].reverse(), { probeOne, sleep: waits() });

  assert.deepEqual([...first], [...second]);
});

test('a host that has not answered two addresses in a row is not asked about the rest, so one outage cannot cost an hour', async () => {
  const asked = [];
  const probeOne = async (address) => {
    asked.push(address);
    return { url: address, verdict: 'unverified', reason: 'timed out, timed out, timed out' };
  };
  const addresses = [1, 2, 3, 4, 5].map((n) => `https://down.example/${n}`);

  const results = await probeAll(addresses, { probeOne, sleep: waits() });

  assert.deepEqual(asked, ['https://down.example/1', 'https://down.example/2']);
  for (const address of addresses.slice(2)) {
    assert.equal(results.get(address).verdict, 'unverified');
    assert.match(results.get(address).reason, /not asked: the host did not answer the 2 addresses before this one/);
  }
});

test('an answer from a host resets its count, and another host is never held back by a host that is down', async () => {
  const verdicts = {
    'https://mixed.example/1': 'unverified',
    'https://mixed.example/2': 'answered',
    'https://mixed.example/3': 'unverified',
    'https://mixed.example/4': 'unverified',
  };
  const asked = [];
  const probeOne = async (address) => {
    asked.push(address);
    return { url: address, verdict: verdicts[address] ?? 'unverified', reason: 'x' };
  };

  const results = await probeAll([...Object.keys(verdicts), 'https://other.example/1'], { probeOne, sleep: waits() });

  assert.ok(
    asked.includes('https://mixed.example/4'),
    'two unverified with an answer between them are not two in a row'
  );
  assert.ok(asked.includes('https://other.example/1'));
  assert.equal(results.size, 5);
});
