import assert from 'node:assert/strict';
import test from 'node:test';

import { readResponseText } from './response-text.mjs';

const encoder = new TextEncoder();
const responseOf = (body) => new Response(body);

test('a body is read whole, and a response with no body reads as no text', async () => {
  assert.equal(await readResponseText(responseOf('<p>Risk – management</p>'), 1024), '<p>Risk – management</p>');
  assert.equal(await readResponseText(new Response(null), 1024), '');
});

test('multi-byte characters split across chunks are read whole', async () => {
  const stream = new ReadableStream({
    start(controller) {
      for (const byte of encoder.encode('Risk – management €')) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    },
  });

  assert.equal(await readResponseText(responseOf(stream), 1024), 'Risk – management €');
});

test('a body larger than the ceiling is cut at it and the rest of the stream is never read', async () => {
  let cancelled = false;
  let pulls = 0;
  const endless = new ReadableStream({
    pull(controller) {
      pulls += 1;
      controller.enqueue(encoder.encode('0123456789'));
    },
    cancel() {
      cancelled = true;
    },
  });

  assert.equal(await readResponseText(responseOf(endless), 25), '0123456789012345678901234');
  assert.equal(cancelled, true);
  assert.ok(pulls < 10, `${pulls} pulls`);
});

test('a cut inside a multi-byte character drops the character instead of inventing one', async () => {
  assert.equal(await readResponseText(responseOf('€€€€'), 5), '€');
});
