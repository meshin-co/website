import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAX_ITEMS, SIBLINGS, pageWindow } from './page-window.mjs';

const TOTALS = Array.from({ length: 60 }, (_, index) => index + 1);

const windows = TOTALS.flatMap((total) =>
  Array.from({ length: total }, (_, index) => ({ total, current: index + 1, result: pageWindow(index + 1, total) }))
);

const shape = ({ items }) =>
  items
    .map((item) => (item.kind === 'gap' ? '…' : item.kind === 'current' ? `[${item.page}]` : `${item.page}`))
    .join(' ');

const pagesOf = ({ items }) => items.filter((item) => item.kind !== 'gap').map((item) => item.page);

const hasGap = ({ items }) => items.some((item) => item.kind === 'gap');

test('the stated maximum is seven items: first page, gap, three-page window, gap, last page', () => {
  assert.equal(SIBLINGS, 1);
  assert.equal(MAX_ITEMS, 7);
});

test('the control never exceeds the stated maximum, however large the total', () => {
  for (const { total, current, result } of windows) {
    assert.ok(result.items.length <= MAX_ITEMS, `${current} of ${total}: ${shape(result)}`);
  }
  for (const total of [1_000, 1_000_000, 1_000_000_000]) {
    for (const current of [1, 4, 5, Math.ceil(total / 2), total - 3, total - 4, total]) {
      assert.ok(pageWindow(current, total).items.length <= MAX_ITEMS, `${current} of ${total}`);
    }
  }
});

test('the control spends its whole budget: it shows every page that fits, and exactly the maximum once they do not', () => {
  for (const { total, current, result } of windows) {
    assert.equal(result.items.length, Math.min(total, MAX_ITEMS), `${current} of ${total}: ${shape(result)}`);
  }
});

test('the first and the last page are always reachable, at the two ends of the control', () => {
  for (const { total, current, result } of windows) {
    const pages = pagesOf(result);
    assert.equal(pages[0], 1, `${current} of ${total}`);
    assert.equal(pages.at(-1), total, `${current} of ${total}`);
    assert.notEqual(result.items[0].kind, 'gap', `${current} of ${total}`);
    assert.notEqual(result.items.at(-1).kind, 'gap', `${current} of ${total}`);
  }
});

test('pages are listed once each, in order, and none lies outside the archive', () => {
  for (const { total, current, result } of windows) {
    const pages = pagesOf(result);
    assert.deepEqual(
      pages,
      [...new Set(pages)].sort((a, b) => a - b),
      `${current} of ${total}`
    );
    assert.ok(
      pages.every((page) => Number.isInteger(page) && page >= 1 && page <= total),
      `${current} of ${total}`
    );
  }
});

test('a gap stands only where at least two pages are skipped, and a single skipped page is shown as itself', () => {
  for (const { total, current, result } of windows) {
    result.items.forEach((item, index) => {
      if (item.kind === 'gap') {
        const skipped = result.items[index + 1].page - result.items[index - 1].page - 1;
        assert.ok(skipped >= 2, `${current} of ${total}: gap hides ${skipped} page(s) in ${shape(result)}`);
      } else if (result.items[index + 1]?.kind && result.items[index + 1].kind !== 'gap') {
        assert.equal(result.items[index + 1].page - item.page, 1, `${current} of ${total}: ${shape(result)}`);
      }
    });
  }
});

test('two gaps are never adjacent', () => {
  for (const { total, current, result } of windows) {
    result.items.slice(1).forEach((item, index) => {
      assert.ok(!(item.kind === 'gap' && result.items[index].kind === 'gap'), `${current} of ${total}`);
    });
  }
});

test('exactly one item is the current page, it is marked as current, and no link points at it', () => {
  for (const { total, current, result } of windows) {
    const marked = result.items.filter((item) => item.kind === 'current');
    assert.equal(marked.length, 1, `${current} of ${total}`);
    assert.equal(marked[0].page, current, `${current} of ${total}`);
    assert.ok(!result.items.some((item) => item.kind === 'link' && item.page === current), `${current} of ${total}`);
  }
});

test('the previous link is absent on the first page and the next link is absent on the last page', () => {
  for (const { total, current, result } of windows) {
    assert.equal(result.previous, current === 1 ? null : current - 1, `${current} of ${total}`);
    assert.equal(result.next, current === total ? null : current + 1, `${current} of ${total}`);
  }
});

test('a single page yields a lone current page with nothing to go to', () => {
  const result = pageWindow(1, 1);
  assert.equal(shape(result), '[1]');
  assert.equal(result.previous, null);
  assert.equal(result.next, null);
});

test('two pages yield both, with a next link on the first and a previous link on the second', () => {
  const first = pageWindow(1, 2);
  const second = pageWindow(2, 2);
  assert.equal(shape(first), '[1] 2');
  assert.equal(first.next, 2);
  assert.equal(first.previous, null);
  assert.equal(shape(second), '1 [2]');
  assert.equal(second.previous, 1);
  assert.equal(second.next, null);
});

test('no gap appears while every page fits in the budget', () => {
  for (const { total, result } of windows.filter(({ total }) => total <= MAX_ITEMS)) {
    assert.ok(!hasGap(result), `${total} pages: ${shape(result)}`);
  }
});

test('the smallest total that first produces a gap is one page past the budget, and it produces one from every position', () => {
  const smallestWithGap = TOTALS.find((total) =>
    windows.some((entry) => entry.total === total && hasGap(entry.result))
  );
  assert.equal(smallestWithGap, 2 * SIBLINGS + 6);
  assert.equal(smallestWithGap, MAX_ITEMS + 1);

  const atSmallest = windows.filter(({ total }) => total === smallestWithGap);
  assert.equal(atSmallest.length, smallestWithGap);
  for (const { current, result } of atSmallest) {
    assert.equal(result.items.filter((item) => item.kind === 'gap').length, 1, `${current}: ${shape(result)}`);
  }
  assert.deepEqual(
    atSmallest.map(({ result }) => shape(result)),
    [
      '[1] 2 3 4 5 … 8',
      '1 [2] 3 4 5 … 8',
      '1 2 [3] 4 5 … 8',
      '1 2 3 [4] 5 … 8',
      '1 … 4 [5] 6 7 8',
      '1 … 4 5 [6] 7 8',
      '1 … 4 5 6 [7] 8',
      '1 … 4 5 6 7 [8]',
    ]
  );
});

test('far from either end the window is the current page with one neighbour each side between two gaps', () => {
  assert.equal(shape(pageWindow(20, 40)), '1 … 19 [20] 21 … 40');
  assert.equal(shape(pageWindow(5, 9)), '1 … 4 [5] 6 … 9');
});

test('the window slides to the end it is near, so the freed slots show consecutive pages instead of a gap', () => {
  assert.equal(shape(pageWindow(1, 40)), '[1] 2 3 4 5 … 40');
  assert.equal(shape(pageWindow(4, 40)), '1 2 3 [4] 5 … 40');
  assert.equal(shape(pageWindow(37, 40)), '1 … 36 [37] 38 39 40');
  assert.equal(shape(pageWindow(40, 40)), '1 … 36 37 38 39 [40]');
});

test('the switch from the sliding window to the centred window happens exactly where a gap would first hide two pages', () => {
  assert.equal(shape(pageWindow(4, 40)), '1 2 3 [4] 5 … 40');
  assert.equal(shape(pageWindow(5, 40)), '1 … 4 [5] 6 … 40');
  assert.equal(shape(pageWindow(36, 40)), '1 … 35 [36] 37 … 40');
  assert.equal(shape(pageWindow(37, 40)), '1 … 36 [37] 38 39 40');
});

test('a page number outside the archive is refused instead of rendering a control that points nowhere', () => {
  for (const current of [0, -1, 11, 2.5, Number.NaN, '3', null, undefined]) {
    assert.throws(() => pageWindow(current, 10), RangeError, `current ${String(current)}`);
  }
});

test('a total that is not a whole number of at least one page is refused', () => {
  for (const total of [0, -4, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '9', null, undefined]) {
    assert.throws(() => pageWindow(1, total), RangeError, `total ${String(total)}`);
  }
});
