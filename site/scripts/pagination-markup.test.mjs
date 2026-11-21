import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  canonicalHref,
  listedPosts,
  paginationControl,
  robotsContent,
  robotsMeta,
  tagArchiveFindings,
  tagArchiveListingFindings,
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

const LINK = 'relative decoration-2 hover:decoration-primary text-link underline underline-offset-4 z-[1]';

const card = (id) =>
  `<article class="relative border border-line flex flex-col focus-within:border-primary group h-full p-6" data-gate-ignore><p class="eyebrow"><time datetime="2026-11-20">20 Nov 2026</time> · 7 min read · <a class="${LINK}" href="/blog/category/governance">AI governance</a></p><h3 class="text-heading font-heading font-semibold mt-5 text-xl"><a class="text-link after:absolute after:content-[''] after:inset-0" href="/blog/${id}">${id}</a></h3><p class="text-muted mt-4 grow">An excerpt.</p><p class="text-muted mt-4 font-mono text-xs"><a class="${LINK}" href="/blog/tag/ai-governance">ai-governance</a> · <a class="${LINK}" href="/blog/tag/policy-enforcement">policy-enforcement</a></p></article>`;

const listing = (ids) =>
  `<html><body><a href="/blog/tags">Tags</a><a href="/blog/not-a-card">Elsewhere</a><main>${ids.map(card).join('')}</main></body></html>`;

test('the posts a page lists are the ones its cards link to, in card order, and no other link on the page', () => {
  assert.deepEqual(listedPosts(listing(['b', 'a', 'c'])), ['b', 'a', 'c']);
  assert.deepEqual(listedPosts(listing([])), []);
  assert.deepEqual(listedPosts(''), []);
});

test('a card that links to no post is listed as an empty id, so it can never pass for a post', () => {
  const cardWithoutPost = '<article><h3>Title</h3><a href="/blog/tag/ai-governance">ai-governance</a></article>';
  assert.deepEqual(listedPosts(`${card('a')}${cardWithoutPost}`), ['a', '']);
});

const CARRYING = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
const PAGE_OF_THREE = 3;

const listingFindings = (changes = {}) =>
  tagArchiveListingFindings({
    page1Html: listing(CARRYING.slice(0, 3)),
    page2Html: listing(CARRYING.slice(3, 6)),
    tagged: CARRYING,
    pageSize: PAGE_OF_THREE,
    ...changes,
  });

test('an archive that lists each page its share of the posts yields no findings, whichever posts land on page 2', () => {
  assert.deepEqual(listingFindings(), []);
  assert.deepEqual(
    listingFindings({ page1Html: listing(['p7', 'p1', 'p2']), page2Html: listing(['p6', 'p4', 'p3']) }),
    []
  );
});

test('page 2 must list what the corpus leaves for it: a full page, or the remainder when the archive ends there', () => {
  const remainder = [
    [4, ['p4']],
    [5, ['p4', 'p5']],
    [6, ['p4', 'p5', 'p6']],
    [9, ['p4', 'p5', 'p6']],
  ];
  for (const [total, onPageTwo] of remainder) {
    const tagged = Array.from({ length: total }, (_, index) => `p${index + 1}`);
    assert.deepEqual(
      listingFindings({ tagged, page2Html: listing(onPageTwo) }),
      [],
      `${total} posts leave ${onPageTwo.length} for page 2`
    );
  }
});

test('every defect in what a page lists is caught on its own', () => {
  const cases = [
    ['page 2 lists nothing', { page2Html: listing([]) }, /page 2 posts listed: got 0, want 3/],
    ['page 2 never built', { page2Html: '' }, /page 2 posts listed: got 0, want 3/],
    ['page 2 lists one post too few', { page2Html: listing(['p4', 'p5']) }, /page 2 posts listed: got 2, want 3/],
    ['page 2 lists one post too many', { page2Html: listing(CARRYING.slice(3)) }, /page 2 posts listed: got 4, want 3/],
    [
      'page 2 lists one post three times',
      { page2Html: listing(['p4', 'p4', 'p4']) },
      /page 2 posts listed: got 1, want 3/,
    ],
    [
      'page 2 repeats a post of page 1',
      { page2Html: listing(['p1', 'p5', 'p6']) },
      /page 2 posts that page 1 lists too: got p1, want none/,
    ],
    [
      'page 2 lists a post the tag does not carry',
      { page2Html: listing(['p4', 'p5', 'x1']) },
      /page 2 posts the tag does not carry: got x1, want none/,
    ],
    [
      'page 1 lists a post the tag does not carry',
      { page1Html: listing(['p1', 'p2', 'x1']) },
      /page 1 posts the tag does not carry: got x1, want none/,
    ],
    [
      'page 1 lists a card that links to no post',
      { page1Html: `${listing(['p1', 'p2'])}<article><h3>Title</h3></article>` },
      /page 1 posts the tag does not carry: got \(card without a post link\), want none/,
    ],
  ];
  for (const [name, changes, expected] of cases) {
    const result = listingFindings(changes);
    assert.equal(result.length, 1, `${name}: ${result.join(' | ')}`);
    assert.match(result[0], expected, name);
  }
});

test('an archive that renders every post on page 1, as tag archives did before they paginated, is caught twice over', () => {
  const result = listingFindings({ page1Html: listing(CARRYING), page2Html: listing(CARRYING.slice(3, 6)) });
  assert.deepEqual(result, [
    'tag page 1 posts listed: got 7, want 3',
    'tag page 2 posts that page 1 lists too: got p4, p5, p6, want none',
  ]);
});
