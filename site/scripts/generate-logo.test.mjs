import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  geometry,
  maskGreyAt,
  referenceViewBox,
  renderMark,
  renderSymbol,
  renderUse,
  wedgeSpans,
} from './generate-logo.mjs';

test('the ramp is read from the measured table, brightest at the open end', () => {
  assert.ok(maskGreyAt(0) > 200, 'the cut end is nearly opaque ink');
  assert.ok(maskGreyAt(230) < 40, 'the far end has almost faded out');
});

test('mask values fall monotonically across the sweep, so no step reverses', () => {
  let previous = Infinity;
  for (let deg = 2; deg <= 255; deg += 1) {
    const value = maskGreyAt(deg);
    assert.ok(value <= previous + 1, `value rose at ${deg}deg: ${previous} -> ${value}`);
    previous = value;
  }
});

test('the tail reaches full transparency exactly at the sweep end', () => {
  assert.equal(maskGreyAt(255), 0);
});

test('wedges tile the whole sweep with no gap and a small overlap', () => {
  const spans = wedgeSpans(3);
  assert.equal(spans[0].from, 0);
  assert.equal(spans.at(-1).to, 255);
  for (let i = 1; i < spans.length; i++) {
    assert.equal(spans[i].from, spans[i - 1].to, 'wedges must share an edge');
    assert.ok(spans[i].paintedFrom < spans[i].from, 'each wedge overlaps its neighbour');
  }
});

test('halving the step doubles the graduations', () => {
  assert.equal(wedgeSpans(3).length, 85);
  assert.equal(wedgeSpans(6).length, 43);
});

test('the rendered mark scopes every id so two instances cannot collide', () => {
  const svg = renderMark({ ink: '#000000', prefix: 'x-' });
  assert.ok(svg.includes('id="x-ramp"'));
  assert.ok(!svg.includes('id="ramp"'));
  assert.equal([...svg.matchAll(/id="x-w\d+"/g)].length, 85);
});

test('ink colour reaches both the ring and the star', () => {
  const svg = renderMark({ ink: '#123456', prefix: 'y-' });
  assert.equal([...svg.matchAll(/fill="#123456"/g)].length, 2);
});

test('the symbol carries the geometry once and the mark only references it', () => {
  const symbol = renderSymbol();
  assert.match(symbol, /<symbol id="logo-mark"/);
  assert.equal((symbol.match(/<linearGradient/g) ?? []).length, wedgeSpans().length);

  const mark = renderUse();
  assert.match(mark, /<use href="#logo-mark"/);
  assert.equal((mark.match(/<path/g) ?? []).length, 0);
  assert.equal((mark.match(/<linearGradient/g) ?? []).length, 0);
});

test('the referenced mark still inherits ink from its use site, so one file serves both themes', () => {
  assert.match(renderSymbol(), /currentColor/);
});

test('the referencing viewport starts at the origin, because the symbol already carries the offset viewBox', () => {
  const [x, y, width, height] = geometry.viewBox.split(' ').map(Number);
  assert.ok(x !== 0 || y !== 0, 'this test only means something while the mark geometry is offset');
  assert.equal(referenceViewBox(), `0 0 ${width} ${height}`);
});
