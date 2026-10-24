import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BOOKING_LABEL, BOOKING_URL } from './booking.mjs';

test('the booking URL names the 30-minute event, not the profile that also lists a 15-minute one', () => {
  const url = new URL(BOOKING_URL);
  assert.equal(url.origin, 'https://cal.com');
  assert.equal(url.pathname, '/meshin/30min');
});

test('the booking URL carries no query or fragment, so a rel and a href compare byte for byte', () => {
  const url = new URL(BOOKING_URL);
  assert.equal(url.search + url.hash, '');
});

test('the label promises the same thirty minutes the URL books', () => {
  assert.match(BOOKING_LABEL, /30-min/);
});
