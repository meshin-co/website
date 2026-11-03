import assert from 'node:assert/strict';
import { test } from 'node:test';

import { closedOrigin, localServer, reply } from './local-server.mjs';

test('a local server records each request and tells its answer how often that address was asked for', async (t) => {
  const counts = [];
  const server = await localServer(({ response, seen }) => {
    counts.push(seen);
    reply(response, 200, { 'content-type': 'text/plain' }, 'hello');
  });
  t.after(server.close);
  const first = await fetch(`${server.origin}/a`);
  await fetch(`${server.origin}/a`, { method: 'POST', body: 'payload' });
  await fetch(`${server.origin}/b`);
  assert.equal(await first.text(), 'hello');
  assert.deepEqual(counts, [1, 2, 1]);
  assert.deepEqual(server.requests, [
    { method: 'GET', url: '/a', body: '' },
    { method: 'POST', url: '/a', body: 'payload' },
    { method: 'GET', url: '/b', body: '' },
  ]);
});

test('the origin of a closed port refuses the connection', async () => {
  const origin = await closedOrigin();
  await assert.rejects(fetch(`${origin}/x`), (error) => error.cause?.code === 'ECONNREFUSED');
});

test('reply sends the status, the headers and the body it is given', async (t) => {
  const server = await localServer(({ response }) => reply(response, 418, { 'x-kind': 'teapot' }, 'short and stout'));
  t.after(server.close);
  const response = await fetch(`${server.origin}/`);
  assert.equal(response.status, 418);
  assert.equal(response.headers.get('x-kind'), 'teapot');
  assert.equal(await response.text(), 'short and stout');
});
