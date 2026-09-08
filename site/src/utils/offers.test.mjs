import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatPrice } from './offers.mjs';

test('a fixed price reads as a single number, a range as a floor, a retainer per month', () => {
  assert.equal(formatPrice({ amount: 5000, currency: 'USD', unit: 'fixed' }), '$5,000 fixed');
  assert.equal(formatPrice({ amount: 25000, currency: 'USD', unit: 'from' }), 'from $25,000');
  assert.equal(formatPrice({ amount: 12000, currency: 'USD', unit: 'per-month' }), 'from $12,000/mo');
});
