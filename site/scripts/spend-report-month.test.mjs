import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { monthLine } from './spend-report-text.mjs';

const CEILING = 25_000_000;

test('the month line says what was spent this month, the ceiling and what is left, in one sentence', () => {
  assert.equal(
    monthLine({ month: '2026-11', spentMicro: 92_000, ceilingMicro: CEILING }),
    '2026-11 so far: 0.092 USD spent of the 25.00 USD monthly ceiling, 24.908 USD left.'
  );
});

test('with nothing spent the month line says so in numbers and not in silence', () => {
  assert.equal(
    monthLine({ month: '2026-12', spentMicro: 0, ceilingMicro: CEILING }),
    '2026-12 so far: 0.00 USD spent of the 25.00 USD monthly ceiling, 25.00 USD left.'
  );
});

test('at the ceiling and over it the month line says none is left and that the writer does not run', () => {
  const stopped = ' none left: the ceiling is reached, so the writer does not run for the rest of the month.';
  assert.equal(
    monthLine({ month: '2026-11', spentMicro: CEILING, ceilingMicro: CEILING }),
    '2026-11 so far: 25.00 USD spent of the 25.00 USD monthly ceiling,' + stopped
  );
  assert.equal(
    monthLine({ month: '2026-11', spentMicro: 25_030_000, ceilingMicro: CEILING }),
    '2026-11 so far: 25.03 USD spent of the 25.00 USD monthly ceiling,' + stopped
  );
});

test('one micro-dollar under the ceiling is not reached, and the line names the one micro-dollar left', () => {
  assert.equal(
    monthLine({ month: '2026-11', spentMicro: CEILING - 1, ceilingMicro: CEILING }),
    '2026-11 so far: 24.999999 USD spent of the 25.00 USD monthly ceiling, 0.000001 USD left.'
  );
});

test('a month that is not a UTC year and month, or an amount that is not whole micro-dollars, is refused', () => {
  for (const month of ['2026-1', '2026-13', 'November', '', undefined])
    assert.throws(() => monthLine({ month, spentMicro: 0, ceilingMicro: CEILING }), /month/, String(month));
  for (const spentMicro of [0.5, -1, '5', Number.NaN, undefined])
    assert.throws(() => monthLine({ month: '2026-11', spentMicro, ceilingMicro: CEILING }), /micro-dollars/);
});
