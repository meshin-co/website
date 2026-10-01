import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  canonicalHref,
  paginationControl,
  robotsContent,
  robotsMeta,
  tagArchiveFindings,
} from './pagination-markup.mjs';

const ROUTE = '/blog/tag/ai-governance';
const ORIGIN = 'https://meshin.co';

const anchor = (label, href, text) => `<li><a class="box" href="${href}" aria-label="${label}">${text}</a></li>`;

function nav({ previous, next, numbers, current }) {
  return [
    '<nav aria-label="Pagination" class="wide"><ol class="row">',
    previous ? anchor('Previous page', previous, 'Previous') : '',
    ...numbers.map(([number, href]) =>
      number === current
        ? `<li class="flex"><span aria-current="page" class="box">${number}</span></li>`
        : anchor(`Page ${number}`, href, number)
    ),
    next ? anchor('Next page', next, 'Next') : '',
    '</ol></nav>',
  ].join('');
}

const page = ({ canonical, robots, ...control }) =>
  `<html><head><link href="${ORIGIN}${canonical}" rel="canonical"><meta content="${robots}" name="robots"></head><body>${nav(control)}</body></html>`;

const NUMBERS = [
  [1, ROUTE],
  [2, `${ROUTE}/page/2`],
];

const pageOne = (changes) =>
  page({
    canonical: ROUTE,
    robots: 'index, follow',
    current: 1,
    previous: null,
    next: `${ROUTE}/page/2`,
    numbers: NUMBERS,
    ...changes,
  });

const pageTwo = (changes) =>
  page({
    canonical: `${ROUTE}/page/2`,
    robots: 'noindex, follow',
    current: 2,
    previous: ROUTE,
    next: null,
    numbers: NUMBERS,
    ...changes,
  });

const SITEMAP = `<urlset><url><loc>${ORIGIN}${ROUTE}</loc></url></urlset>`;

const findings = (changes = {}) =>
  tagArchiveFindings({
    route: ROUTE,
    page1Html: pageOne(),
    page2Html: pageTwo(),
    hasPage3: false,
    sitemap: SITEMAP,
    ...changes,
  });

test('a two-page tag archive built to the contract yields no findings', () => {
  assert.deepEqual(findings(), []);
});

test('with a third page, page 2 must carry a next link to it, and without one it must carry none', () => {
  const middle = pageTwo({ next: `${ROUTE}/page/3`, numbers: [...NUMBERS, [3, `${ROUTE}/page/3`]] });
  assert.deepEqual(findings({ hasPage3: true, page2Html: middle }), []);
  assert.match(
    findings({ hasPage3: true })[0],
    /page 2 next link: got undefined, want \/blog\/tag\/ai-governance\/page\/3/
  );
  assert.match(
    findings({ page2Html: middle })[0],
    /page 2 next link: got \/blog\/tag\/ai-governance\/page\/3, want undefined/
  );
});

test('a page 2 that was never built is one finding, not a cascade', () => {
  assert.deepEqual(findings({ page2Html: '' }), [`${ROUTE}/page/2 was not built`]);
});

test('every defect in the head of either page is caught on its own', () => {
  const cases = [
    ['page 2 indexable', { page2Html: pageTwo({ robots: 'index, follow' }) }, /page 2 robots: got index, follow/],
    [
      'page 2 stops following links',
      { page2Html: pageTwo({ robots: 'noindex, nofollow' }) },
      /page 2 robots: got noindex, nofollow/,
    ],
    [
      'page 2 canonical names page one',
      { page2Html: pageTwo({ canonical: ROUTE }) },
      /page 2 canonical: got \/blog\/tag\/ai-governance, want/,
    ],
    [
      'page 1 noindex',
      { page1Html: pageOne({ robots: 'noindex, follow' }) },
      /page 1 robots contain noindex: got true/,
    ],
    [
      'page 1 canonical names page 1 twice',
      { page1Html: pageOne({ canonical: `${ROUTE}/page/1` }) },
      /page 1 canonical: got/,
    ],
  ];
  for (const [name, changes, expected] of cases) {
    const result = findings(changes);
    assert.equal(result.length, 1, `${name}: ${result.join(' | ')}`);
    assert.match(result[0], expected, name);
  }
});

test('every defect in the pagination control is caught on its own', () => {
  const cases = [
    [
      'page 1 offers a previous link',
      { page1Html: pageOne({ previous: ROUTE }) },
      /page 1 previous link: got \/blog\/tag\/ai-governance, want undefined/,
    ],
    ['page 1 has no next link', { page1Html: pageOne({ next: null }) }, /page 1 next link: got undefined/],
    ['page 1 next skips ahead', { page1Html: pageOne({ next: `${ROUTE}/page/3` }) }, /page 1 next link: got/],
    ['page 1 marks page 2 as current', { page1Html: pageOne({ current: 2 }) }, /page 1 current page: got 2, want 1/],
    ['page 2 has no previous link', { page2Html: pageTwo({ previous: null }) }, /page 2 previous link: got undefined/],
    [
      'page 2 previous names /page/1 instead of page one',
      { page2Html: pageTwo({ previous: `${ROUTE}/page/1` }) },
      /page 2 previous link: got \/blog\/tag\/ai-governance\/page\/1/,
    ],
    [
      'page 2 offers a next link on the last page',
      { page2Html: pageTwo({ next: `${ROUTE}/page/3` }) },
      /page 2 next link: got/,
    ],
    [
      'page 2 marks nothing as current',
      { page2Html: pageTwo({ current: 0 }) },
      /page 2 current page: got undefined, want 2/,
    ],
  ];
  for (const [name, changes, expected] of cases) {
    const result = findings(changes);
    assert.equal(result.length, 1, `${name}: ${result.join(' | ')}`);
    assert.match(result[0], expected, name);
  }
});

test('the sitemap must list the archive and must not list any paginated route', () => {
  const withPage = `<urlset><url><loc>${ORIGIN}${ROUTE}</loc></url><url><loc>${ORIGIN}${ROUTE}/page/2</loc></url></urlset>`;
  assert.match(findings({ sitemap: withPage })[0], /sitemap lists a paginated route: got true, want false/);
  assert.match(findings({ sitemap: '<urlset></urlset>' })[0], /sitemap lists the archive: got false, want true/);
});

test('the control is read by label whatever order the attributes come in, and only inside the pagination nav', () => {
  const html = [
    '<a aria-label="Next page" href="/elsewhere">Next</a>',
    '<nav class="x" aria-label="Pagination"><ol>',
    '<li><a href="/a/page/2" class="b" aria-label="Next page">Next</a></li>',
    '<li><span class="b" aria-current="page">\n  7\n</span></li>',
    '</ol></nav>',
  ].join('');
  const control = paginationControl(html);
  assert.equal(control.hrefOf('Next page'), '/a/page/2');
  assert.equal(control.hrefOf('Previous page'), undefined);
  assert.equal(control.current, '7');
  assert.deepEqual(paginationControl('<p>no control here</p>').current, undefined);
});

test('the head readers return an empty string rather than throwing when a tag is absent', () => {
  assert.equal(canonicalHref('<head></head>'), '');
  assert.equal(robotsMeta('<head></head>'), '');
  assert.equal(robotsContent('<head></head>'), undefined);
  assert.equal(canonicalHref('<link href="https://meshin.co/x" rel="canonical">'), 'https://meshin.co/x');
  assert.equal(robotsContent('<meta content="noindex, follow" name="robots">'), 'noindex, follow');
});
