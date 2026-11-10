import assert from 'node:assert/strict';
import test from 'node:test';

import { probeUserAgent } from './link-probe.mjs';

test('the site announces itself to the servers it probes by its own name', () => {
  assert.equal(probeUserAgent(), 'Mozilla/5.0 (compatible; meshin-link-check; +https://meshin.co)');
});
