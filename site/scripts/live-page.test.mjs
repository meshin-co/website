import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import test from 'node:test';

import { probeUserAgent } from './link-probe.mjs';
import { LIVE_PAGE_MAX_BYTES, readLivePage } from './live-page.mjs';

const ADDRESS = 'https://standards.example/ai-rmf';
const PAGE = '<html><head><title>AI Risk Management Framework</title></head><body><h1>AI RMF 1.0</h1></body></html>';

function answering(reply) {
  const calls = [];
  const fetch = async (address, init) => {
    calls.push({ address, ...init });
    const next = reply(calls.length);
    if (next instanceof Error) throw next;
    return next;
  };
  return { fetch, calls };
}

const page = (body, type = 'text/html; charset=utf-8', status = 200) =>
  new Response(body, { status, headers: type === null ? {} : { 'content-type': type } });
const read = (reply, changes) => {
  const { fetch, calls } = answering(reply);
  return readLivePage({ address: ADDRESS, fetch, ...changes }).then((answer) => ({ answer, calls }));
};

test('a page that answers with html comes back as its text, and the content type it declared', async () => {
  const { answer, calls } = await read(() => page(PAGE));

  assert.deepEqual(answer, { kind: 'page', contentType: 'text/html', text: PAGE });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].address, ADDRESS);
});

test('the request is a GET that follows redirects, says who is asking as the probe does, and gives up after thirty seconds', async (t) => {
  const timeouts = [];
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    timeouts.push(milliseconds);
    return new AbortController().signal;
  });

  const { calls } = await read(() => page(PAGE));

  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].redirect, 'follow');
  assert.equal(calls[0].headers['user-agent'], probeUserAgent());
  assert.deepEqual(timeouts, [30_000]);
});

test('xhtml and plain text are text too, and are read', async () => {
  const xhtml = await read(() => page('<p>x</p>', 'application/xhtml+xml'));
  const plain = await read(() => page('AI Risk Management Framework', 'text/plain'));

  assert.deepEqual(xhtml.answer, { kind: 'page', contentType: 'application/xhtml+xml', text: '<p>x</p>' });
  assert.deepEqual(plain.answer, { kind: 'page', contentType: 'text/plain', text: 'AI Risk Management Framework' });
});

test('a document that is not text cannot be read by a machine, so it is named unchecked, with the type and without reading it', async () => {
  for (const type of ['application/pdf', 'application/octet-stream', 'application/json', 'image/png']) {
    let cancelled = false;
    const body = new ReadableStream({
      pull(controller) {
        controller.enqueue(new Uint8Array(8));
      },
      cancel() {
        cancelled = true;
      },
    });

    const { answer } = await read(() => page(body, type));

    assert.equal(answer.kind, 'unchecked', type);
    assert.equal(answer.contentType, type);
    assert.match(
      answer.reason,
      new RegExp(`is ${type.replace('/', '\\/')}, which the machine cannot read; a person must judge it`)
    );
    assert.equal(cancelled, true, `the body of ${type} is not read`);
  }
});

test('an answer that declares no content type is unchecked, and says so', async () => {
  const { answer } = await read(() => page(new TextEncoder().encode('%PDF-1.4'), null));

  assert.equal(answer.kind, 'unchecked');
  assert.match(answer.reason, /declares no content type/);
});

test('an answer that is not a success is unreadable and names the status, so it is not taken for a page', async () => {
  for (const status of [403, 404, 500, 503]) {
    const { answer } = await read(() => page('nope', 'text/html', status));

    assert.deepEqual(answer, { kind: 'unreadable', reason: `the address answered HTTP ${status} when it was read` });
  }
});

test('an address that cannot be reached is unreadable and names why, and a timeout says it timed out', async () => {
  const unreachable = new TypeError('fetch failed', {
    cause: Object.assign(new Error('getaddrinfo'), { code: 'ENOTFOUND' }),
  });
  const timedOut = new DOMException('The operation was aborted due to timeout', 'TimeoutError');

  const gone = await read(() => unreachable);
  const slow = await read(() => timedOut);

  assert.deepEqual(gone.answer, { kind: 'unreadable', reason: 'the address could not be read: ENOTFOUND' });
  assert.deepEqual(slow.answer, { kind: 'unreadable', reason: 'the address could not be read: timed out' });
});

test('a body that breaks while it is read is unreadable, not a half page that a title could be missing from', async () => {
  const broken = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('<html>'));
      controller.error(
        new TypeError('terminated', { cause: Object.assign(new Error('reset'), { code: 'ECONNRESET' }) })
      );
    },
  });

  const { answer } = await read(() => page(broken));

  assert.deepEqual(answer, { kind: 'unreadable', reason: 'the address could not be read: ECONNRESET' });
});

test('a body larger than the ceiling is cut at it, and the default ceiling is two mebibytes', async () => {
  const cut = await read(() => page('0123456789'), { maxBytes: 4 });
  const big = await read(() => page('a'.repeat(LIVE_PAGE_MAX_BYTES + 10)));

  assert.equal(cut.answer.text, '0123');
  assert.equal(LIVE_PAGE_MAX_BYTES, 2 * 1024 * 1024);
  assert.equal(big.answer.text.length, LIVE_PAGE_MAX_BYTES);
});

test('with no fetch given the global fetch is asked, and a failure of it is an answer and never a throw', async () => {
  const answer = await readLivePage({ address: ADDRESS });

  assert.equal(answer.kind, 'unreadable');
  assert.match(answer.reason, /must not reach the network/);
});
