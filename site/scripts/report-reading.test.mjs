import assert from 'node:assert/strict';
import { test } from 'node:test';

import { count, decimal, lineValue, measuredOf, routesIn, unticked } from './report-reading.mjs';

test('a labelled line is read to its end, bold or plain, and an absent or empty label reads null', () => {
  const text = ['# Title', '', 'Generated-from: abc1234', '**Property:** sc-domain:example.com  ', 'Market:', ''].join(
    '\n'
  );

  assert.equal(lineValue('Generated-from', text), 'abc1234');
  assert.equal(lineValue('Property', text), 'sc-domain:example.com');
  assert.equal(lineValue('Market', text), null);
  assert.equal(lineValue('Absent', text), null);
});

test('a label that holds a regular expression character is matched as text', () => {
  assert.equal(lineValue('A.B', 'A.B: dotted\nAxB: wrong'), 'dotted');
});

test('the measured line gives the day and, when it states one, the window', () => {
  assert.deepEqual(measuredOf('Measured: 2026-11-01 (window 2026-08-01 to 2026-10-30)'), {
    measured: '2026-11-01',
    windowStart: '2026-08-01',
    windowEnd: '2026-10-30',
  });
  assert.deepEqual(measuredOf('**Measured:** 2026-11-01'), {
    measured: '2026-11-01',
    windowStart: null,
    windowEnd: null,
  });
});

test('a measured line with no day, an unfinished day or no line at all reads as nothing measured', () => {
  const nothing = { measured: null, windowStart: null, windowEnd: null };

  assert.deepEqual(measuredOf('Measured: yesterday'), nothing);
  assert.deepEqual(measuredOf('Measured: 2026-11-011'), nothing);
  assert.deepEqual(measuredOf('No measurement line here.'), nothing);
  assert.deepEqual(measuredOf(''), nothing);
});

test('a count is a whole number and nothing else, and a decimal may carry a fraction', () => {
  assert.deepEqual(
    [count('0'), count('12'), count('1.5'), count('-3'), count(''), count('x'), count(undefined)],
    [0, 12, null, null, null, null, null]
  );
  assert.deepEqual(
    [decimal('76.2'), decimal('3'), decimal('-'), decimal('n/a'), decimal(undefined)],
    [76.2, 3, null, null, null]
  );
});

test('backticks come off a cell, and a list of routes drops the dash that means none', () => {
  assert.equal(unticked(' `/a` '), '/a');
  assert.deepEqual(routesIn('`/a`, `/b`'), ['/a', '/b']);
  assert.deepEqual(routesIn('-'), []);
  assert.deepEqual(routesIn(''), []);
});
