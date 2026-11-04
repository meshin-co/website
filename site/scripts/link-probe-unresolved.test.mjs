import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import test from 'node:test';

import { notFound, notFoundWithoutAName, scripted, timedOut, unreachable, waits } from './fixtures/probe-fakes.mjs';
import { ATTEMPTS, BACKOFF_MS, probe, probeAll } from './link-probe.mjs';

const ADDRESS = 'https://lapsed.example/doc.pdf';
const pageOf = (host, index) => `https://${host}/page-${String(index).padStart(2, '0')}`;

test('a name that fails to resolve on every attempt is unresolved, after the same three attempts and the same backoff', async () => {
  const fetch = scripted(notFound('lapsed.example'));
  const sleep = waits();

  const result = await probe(ADDRESS, { fetch, sleep });

  assert.equal(result.verdict, 'unresolved');
  assert.equal(result.status, null);
  assert.equal(result.finalUrl, null);
  assert.equal(result.reason, 'ENOTFOUND, ENOTFOUND, ENOTFOUND');
  assert.deepEqual(result.tries, Array(ATTEMPTS).fill({ outcome: 'unresolved', status: null, detail: 'ENOTFOUND' }));
  assert.equal(fetch.calls.length, ATTEMPTS);
  assert.deepEqual(sleep.slept, BACKOFF_MS);
});

test('one failed lookup is never enough: the verdict needs at least two attempts, and a second failure with no more attempts is enough', async () => {
  const once = await probe(ADDRESS, { fetch: scripted(notFound()), sleep: waits(), attempts: 1 });
  const twice = await probe(ADDRESS, { fetch: scripted(notFound()), sleep: waits(), attempts: 2 });

  assert.equal(once.verdict, 'unverified');
  assert.equal(twice.verdict, 'unresolved');
});

test('a name that fails to resolve is the verdict of the address asked only when it is the name of that address: a redirect that led to a lapsed name is unverified', async () => {
  const fetch = scripted(notFound('moved.example'));

  const result = await probe(ADDRESS, { fetch, sleep: waits() });

  assert.equal(result.verdict, 'unverified');
  assert.equal(result.reason, 'ENOTFOUND, ENOTFOUND, ENOTFOUND');
  assert.equal(fetch.calls.length, ATTEMPTS);
});

test('an error that does not say which name failed is taken to be the name of the address asked', async () => {
  const result = await probe(ADDRESS, { fetch: scripted(notFoundWithoutAName()), sleep: waits() });

  assert.equal(result.verdict, 'unresolved');
});

const MIXTURES = [
  ['a 200 after two failed lookups', [notFound(), notFound(), 200], 'answered'],
  ['a failed lookup and then two 404s', [notFound(), 404, 404], 'dead'],
  ['two failed lookups and a timeout', [notFound(), notFound(), timedOut()], 'unverified'],
  ['two failed lookups and a resolver that is busy', [notFound(), notFound(), unreachable('EAI_AGAIN')], 'unverified'],
  ['a 404 between two failed lookups', [notFound(), 404, notFound()], 'unverified'],
  ['a 503 between two failed lookups', [notFound(), 503, notFound()], 'unverified'],
  [
    'a refused connection between two failed lookups',
    [notFound(), unreachable('ECONNREFUSED'), notFound()],
    'unverified',
  ],
  ['a resolver that is busy on every attempt', [unreachable('EAI_AGAIN')], 'unverified'],
  ['a connection refused on every attempt', [unreachable('ECONNREFUSED')], 'unverified'],
  ['a certificate that does not verify on every attempt', [unreachable('CERT_HAS_EXPIRED')], 'unverified'],
  ['a connection reset on every attempt', [unreachable('ECONNRESET')], 'unverified'],
  ['a timeout on every attempt', [timedOut()], 'unverified'],
];

for (const [name, steps, verdict] of MIXTURES) {
  test(`only a failed lookup on every attempt is unresolved: ${name} is ${verdict}`, async () => {
    const result = await probe(ADDRESS, { fetch: scripted(...steps), sleep: waits() });

    assert.equal(result.verdict, verdict);
  });
}

test('a resolver that is busy is a hiccup and never a lapsed name, even when it fails every time', async () => {
  const result = await probe(ADDRESS, { fetch: scripted(unreachable('EAI_AGAIN')), sleep: waits() });

  assert.equal(result.verdict, 'unverified');
  assert.equal(result.reason, 'EAI_AGAIN, EAI_AGAIN, EAI_AGAIN');
});

test('once a name is unresolved, every other address on that host is unresolved without a request, and the reason names the address that was asked', async () => {
  const asked = [];
  const probeOne = async (address) => {
    asked.push(address);
    return { url: address, verdict: 'unresolved', status: null, finalUrl: null, reason: 'ENOTFOUND', tries: [] };
  };
  const addresses = Array.from({ length: 13 }, (_, index) => pageOf('lapsed.example', index));

  const results = await probeAll(addresses, { probeOne, sleep: waits() });

  assert.deepEqual(asked, [addresses[0]]);
  assert.equal(results.size, 13);
  for (const address of addresses) assert.equal(results.get(address).verdict, 'unresolved', address);
  for (const address of addresses.slice(1)) {
    const { reason, status, finalUrl, tries } = results.get(address);
    assert.equal(reason, 'not asked: the host name did not resolve for ' + addresses[0]);
    assert.deepEqual([status, finalUrl, tries], [null, null, []]);
  }
});

test('through the real probe a host with thirteen addresses costs one address its three attempts, and no gap is slept for the others', async () => {
  const fetch = scripted(notFound('lapsed.example'));
  const sleep = waits();
  const addresses = Array.from({ length: 13 }, (_, index) => pageOf('lapsed.example', index));

  const results = await probeAll(addresses, { fetch, sleep, hostGapMs: 500 });

  assert.equal(fetch.calls.length, ATTEMPTS);
  assert.deepEqual(sleep.slept, BACKOFF_MS);
  assert.deepEqual([...new Set([...results.values()].map(({ verdict }) => verdict))], ['unresolved']);
});

test('a host that is not dead by name does not get the shortcut: a 404 after a failed lookup is asked about every address', async () => {
  const asked = [];
  const probeOne = async (address) => {
    asked.push(address);
    return { url: address, verdict: 'dead', status: 404, reason: '404, 404' };
  };
  const addresses = [1, 2, 3].map((index) => pageOf('gone.example', index));

  const results = await probeAll(addresses, { probeOne, sleep: waits() });

  assert.deepEqual(asked, addresses);
  assert.deepEqual(
    [...results.values()].map(({ verdict }) => verdict),
    ['dead', 'dead', 'dead']
  );
});

test('a host that does not resolve never holds back another host', async () => {
  const fetch = async (address) => {
    if (new URL(address).hostname === 'lapsed.example') throw notFound('lapsed.example');
    return new Response('body', { status: 200 });
  };
  const addresses = [pageOf('lapsed.example', 1), pageOf('lapsed.example', 2), pageOf('alive.example', 1)];

  const results = await probeAll(addresses, { fetch, sleep: waits() });

  assert.deepEqual(
    [...results].map(([address, { verdict }]) => [address, verdict]),
    [
      [pageOf('alive.example', 1), 'answered'],
      [pageOf('lapsed.example', 1), 'unresolved'],
      [pageOf('lapsed.example', 2), 'unresolved'],
    ]
  );
});

const STATUSES = [
  ['a 403 on every attempt', [403], 403],
  ['a 503 and then two timeouts', [503, timedOut(), timedOut()], 503],
  ['a failed lookup and then two 404s', [notFound(), 404, 404], 404],
  ['a timeout on every attempt', [timedOut()], null],
  ['a resolver that is busy on every attempt', [unreachable('EAI_AGAIN')], null],
  ['a failed lookup on every attempt', [notFound()], null],
];

for (const [name, steps, status] of STATUSES) {
  test(`the status of an address is a number exactly when some attempt got an HTTP answer, which is what lets it witness that the network works: ${name} gives ${status}`, async () => {
    const result = await probe(ADDRESS, { fetch: scripted(...steps), sleep: waits() });

    assert.equal(result.status, status);
  });
}
