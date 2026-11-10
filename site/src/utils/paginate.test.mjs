import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PAGE_HEADING_FORMAT,
  PAGE_SIZE,
  firstPage,
  pageCount,
  pageHeading,
  pagePath,
  paginate,
  paginationLinks,
} from './paginate.mjs';

const entries = (count) => Array.from({ length: count }, (_, index) => index);

test('page one shows only the first page-size slice', () => {
  assert.equal(firstPage(entries(25)).length, PAGE_SIZE);
  assert.deepEqual(firstPage(['a', 'b']), ['a', 'b']);
});

test('pagination slices the overflow into full pages plus a remainder', () => {
  const pages = paginate(entries(25));
  assert.deepEqual(
    pages.map((page) => page.pageNumber),
    [2, 3]
  );
  assert.equal(pages[0].entries.length, 12);
  assert.equal(pages[1].entries.length, 1);
  assert.equal(pages[1].entries[0], 24);
});

test('no second page exists while entries fit on one page', () => {
  assert.deepEqual(paginate(entries(12)), []);
  assert.deepEqual(paginate([]), []);
});

test('one entry over the limit forces exactly one extra page', () => {
  const pages = paginate(entries(13));
  assert.equal(pages.length, 1);
  assert.equal(pages[0].entries.length, 1);
});

test('page one is canonical: numbered links point the first page at the bare route', () => {
  assert.equal(pagePath('/blog', 1), '/blog');
  assert.equal(pagePath('/blog', 3), '/blog/page/3');
  assert.equal(pagePath('/blog/category/governance', 2), '/blog/category/governance/page/2');
});

test('numbered links appear only when a second page exists', () => {
  assert.deepEqual(paginationLinks('/blog', entries(12)), []);
  assert.deepEqual(paginationLinks('/blog', entries(13)), [
    { pageNumber: 1, href: '/blog' },
    { pageNumber: 2, href: '/blog/page/2' },
  ]);
});

test('page counts round up from the remainder', () => {
  assert.equal(pageCount(entries(1)), 1);
  assert.equal(pageCount(entries(12)), 1);
  assert.equal(pageCount(entries(13)), 2);
});

test('a numbered page is headed by the heading of its first page, a comma, the word page and its own number', () => {
  assert.equal(pageHeading('AI governance posts', 2), 'AI governance posts, page 2');
  assert.equal(pageHeading('AI governance articles', 11), 'AI governance articles, page 11');
});

test('the wording is one string that names the heading and the number once each, so the editorial ledger can read it as a row', () => {
  assert.equal(PAGE_HEADING_FORMAT.match(/\{heading\}/g)?.length, 1);
  assert.equal(PAGE_HEADING_FORMAT.match(/\{number\}/g)?.length, 1);
  assert.equal(pageHeading('A', 2), PAGE_HEADING_FORMAT.replace('{heading}', 'A').replace('{number}', '2'));
});

test('a heading that holds a placeholder or a replacement pattern is printed as written, never expanded again', () => {
  assert.equal(pageHeading('Use {number} wisely', 3), 'Use {number} wisely, page 3');
  assert.equal(pageHeading('Cost $& benefit', 2), 'Cost $& benefit, page 2');
});
