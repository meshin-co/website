import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { join } from 'node:path';
import test from 'node:test';

import { startHost } from './http-host.mjs';

const PRELOAD = join(import.meta.dirname, 'dns-lapse.mjs');
const SUFFIX = '.dns-lapse.test';
const SCRIPT = `
  try {
    const response = await fetch(process.argv[1]);
    console.log(JSON.stringify({ status: response.status }));
  } catch (error) {
    console.log(JSON.stringify({ message: error.message, code: error.cause?.code, hostname: error.cause?.hostname }));
  }
`;

function fetchIn(address, env) {
  return new Promise((done) => {
    const child = spawn(process.execPath, ['--import', PRELOAD, '--input-type=module', '--eval', SCRIPT, address], {
      env: { ...process.env, ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', () => done(stdout === '' ? { crashed: stderr.trim().split('\n')[0] } : JSON.parse(stdout)));
  });
}

const loopbackOf = (origin) => new URL(origin).hostname.replace(/^\[|\]$/g, '');

test('a name under the suffix fails to resolve with ENOTFOUND as fetch reports it, and no request reaches the host', async () => {
  const host = await startHost((req, res) => res.writeHead(200).end('ok'));
  try {
    const { port } = new URL(host.origin);

    const answer = await fetchIn(`http://lapsed${SUFFIX}:${port}/`, { DNS_LAPSE_SUFFIX: SUFFIX });

    assert.deepEqual(answer, { message: 'fetch failed', code: 'ENOTFOUND', hostname: `lapsed${SUFFIX}` });
    assert.equal(host.requests.length, 0);
  } finally {
    await host.close();
  }
});

test('a redirect to a name under the suffix fails for the name that was redirected to, so the error says which host failed', async () => {
  const target = `http://moved${SUFFIX}/`;
  const redirecting = await startHost((req, res) => res.writeHead(301, { location: target }).end());
  try {
    const answer = await fetchIn(`${redirecting.origin}/old`, { DNS_LAPSE_SUFFIX: SUFFIX });

    assert.deepEqual(answer, { message: 'fetch failed', code: 'ENOTFOUND', hostname: `moved${SUFFIX}` });
    assert.equal(redirecting.requests.length, 1);
  } finally {
    await redirecting.close();
  }
});

test('the same name resolves to the address it is given when it is told to, and the host answers, so the failure above is the preload and not the machine', async () => {
  const host = await startHost((req, res) => res.writeHead(200).end('ok'));
  try {
    const { port } = new URL(host.origin);

    const answer = await fetchIn(`http://lapsed${SUFFIX}:${port}/`, {
      DNS_LAPSE_SUFFIX: SUFFIX,
      DNS_LAPSE_RESOLVE: `lapsed${SUFFIX}=${loopbackOf(host.origin)}`,
    });

    assert.deepEqual(answer, { status: 200 });
    assert.equal(host.requests.length, 1);
  } finally {
    await host.close();
  }
});

test('every other name is resolved by the machine as it always was, and a name that only contains the suffix is not under it', async () => {
  const server = http.createServer((req, res) => res.writeHead(200).end('ok'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();

    const plain = await fetchIn(`http://localhost:${port}/`, { DNS_LAPSE_SUFFIX: SUFFIX });
    const inside = await fetchIn(`http://localhost:${port}/`, { DNS_LAPSE_SUFFIX: 'localhost' });
    const lookalike = await fetchIn(`http://localhost:${port}/`, { DNS_LAPSE_SUFFIX: '.localhost' });

    assert.deepEqual(plain, { status: 200 });
    assert.equal(inside.code, 'ENOTFOUND');
    assert.deepEqual(lookalike, { status: 200 });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('with no suffix given the preload changes nothing at all', async () => {
  const server = http.createServer((req, res) => res.writeHead(200).end('ok'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();

    const answer = await fetchIn(`http://localhost:${port}/`, { DNS_LAPSE_SUFFIX: '' });

    assert.deepEqual(answer, { status: 200 });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('a name that is listed resolves while another name under the same suffix still fails, so a healthy host can stand beside a lapsed one', async () => {
  const host = await startHost((req, res) => res.writeHead(200).end('ok'));
  try {
    const { port } = new URL(host.origin);
    const env = { DNS_LAPSE_SUFFIX: SUFFIX, DNS_LAPSE_RESOLVE: `healthy${SUFFIX}=${loopbackOf(host.origin)}` };

    const healthy = await fetchIn(`http://healthy${SUFFIX}:${port}/`, env);
    const lapsed = await fetchIn(`http://lapsed${SUFFIX}:${port}/`, env);

    assert.deepEqual(healthy, { status: 200 });
    assert.equal(lapsed.code, 'ENOTFOUND');
    assert.equal(host.requests.length, 1);
  } finally {
    await host.close();
  }
});
