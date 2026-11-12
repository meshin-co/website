import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  digestFor,
  applyDispositions,
  inheritDerivedStatus,
  inheritPaginatedStatus,
  applyConditionalCopy,
} from './dispositions.mjs';

const rows = [
  { location: 'frontmatter.title', text: 'A title', status: 'unreviewed', usedIn: ['src/data/faq/a.md'] },
  { location: 'body', text: 'Body prose here.', status: 'unreviewed', usedIn: ['src/data/faq/a.md'] },
  { location: 'head.title', text: 'A title · meshin.co', status: 'unreviewed', usedIn: ['/faq/a'] },
];

test('a digest covers every row of one target and changes when any of its text changes', () => {
  const before = digestFor(rows, 'src/data/faq/a.md');
  const after = digestFor(
    rows.map((row) => (row.location === 'body' ? { ...row, text: 'Edited prose.' } : row)),
    'src/data/faq/a.md'
  );
  assert.notEqual(before, after);
  assert.equal(before, digestFor(rows, 'src/data/faq/a.md'));
});

test('a disposition marks every row of its target', () => {
  const { rows: applied } = applyDispositions(rows, [
    {
      target: 'src/data/faq/a.md',
      status: 'rewritten',
      reason: 'tightened the answer',
      digest: digestFor(rows, 'src/data/faq/a.md'),
    },
  ]);
  assert.deepEqual(
    applied.filter((row) => row.usedIn.includes('src/data/faq/a.md')).map((row) => row.status),
    ['rewritten', 'rewritten']
  );
  assert.equal(applied.find((row) => row.usedIn.includes('/faq/a')).status, 'unreviewed');
});

test('a disposition can narrow to one location', () => {
  const { rows: applied } = applyDispositions(rows, [
    { target: 'src/data/faq/a.md', location: 'body', status: 'verified', digest: digestFor(rows, 'src/data/faq/a.md') },
  ]);
  assert.equal(applied.find((row) => row.location === 'body').status, 'verified');
  assert.equal(applied.find((row) => row.location === 'frontmatter.title').status, 'unreviewed');
});

test('a digest that no longer matches leaves the rows unreviewed and reports staleness', () => {
  const { rows: applied, stale } = applyDispositions(rows, [
    { target: 'src/data/faq/a.md', status: 'rewritten', digest: 'deadbeef' },
  ]);
  assert.equal(
    applied.every((row) => row.status === 'unreviewed'),
    true
  );
  assert.deepEqual(
    stale.map((entry) => entry.target),
    ['src/data/faq/a.md']
  );
});

test('a disposition naming a target with no rows is reported rather than silently ignored', () => {
  const { unmatched } = applyDispositions(rows, [{ target: 'src/data/faq/ghost.md', status: 'verified', digest: 'x' }]);
  assert.deepEqual(
    unmatched.map((entry) => entry.target),
    ['src/data/faq/ghost.md']
  );
});

test('owner-blocked without a reason never becomes a disposition', () => {
  const { rows: applied, stale } = applyDispositions(rows, [
    { target: 'src/data/faq/a.md', status: 'owner-blocked', digest: digestFor(rows, 'src/data/faq/a.md') },
  ]);
  assert.equal(
    applied.filter((row) => row.usedIn.includes('src/data/faq/a.md')).every((row) => row.status === 'unreviewed'),
    true
  );
  assert.equal(stale.length, 1);
});

test('a target written with or without the site/ prefix matches the same rows', () => {
  for (const target of ['src/data/faq/a.md', 'site/src/data/faq/a.md', './src/data/faq/a.md']) {
    const {
      rows: applied,
      stale,
      unmatched,
    } = applyDispositions(rows, [{ target, status: 'verified', digest: digestFor(rows, 'src/data/faq/a.md') }]);
    assert.deepEqual(stale, [], target);
    assert.deepEqual(unmatched, [], target);
    assert.equal(applied.filter((row) => row.status === 'verified').length, 2, target);
  }
});

test('a rendered row inherits the disposition of the reviewed source text it renders', () => {
  const inherited = inheritDerivedStatus([
    {
      location: 'body',
      text: 'The body prose. And a second sentence.',
      status: 'rewritten',
      reason: 'tightened',
      usedIn: ['src/data/faq/a.md'],
    },
    { location: 'body.p', text: 'The body prose.', status: 'unreviewed', usedIn: ['/faq/a'] },
  ]);
  const rendered = inherited.find((row) => row.usedIn.includes('/faq/a'));
  assert.equal(rendered.status, 'rewritten');
  assert.equal(rendered.derivedFrom, 'src/data/faq/a.md');
});

const LONG_TEXT = 'A sentence that is long enough to repeat. '.repeat(2000).trim();

test('a source text too long for one regular expression still hands its disposition to the numbered page built from it', () => {
  const inherited = inheritDerivedStatus(
    [
      { location: 'text', text: LONG_TEXT, status: 'rewritten', reason: 'read in full', usedIn: ['src/data/long.md'] },
      { location: 'head.title', text: `${LONG_TEXT} 2`, status: 'unreviewed', usedIn: ['/long-a'] },
      { location: 'head.title', text: `${LONG_TEXT} 3 · meshin.co`, status: 'unreviewed', usedIn: ['/long-b'] },
      { location: 'head.title', text: `${LONG_TEXT} two`, status: 'unreviewed', usedIn: ['/long-c'] },
    ],
    { titleSuffix: ' · meshin.co' }
  );
  const statusOf = (route) => inherited.find((row) => row.usedIn.includes(route)).status;
  assert.equal(statusOf('/long-a'), 'rewritten');
  assert.equal(statusOf('/long-b'), 'rewritten');
  assert.equal(statusOf('/long-c'), 'unreviewed');
});

test('a paginated title inherits the template string it is built from, for page 2 and for every page after it', () => {
  const inherited = inheritDerivedStatus(
    [
      {
        location: 'text',
        text: 'Writing, page',
        status: 'rewritten',
        reason: 'the title keeps the "Writing, page N" pattern',
        usedIn: ['src/pages/blog/page/[page].astro'],
      },
      { location: 'head.title', text: 'Writing, page 2 — meshin.co', status: 'unreviewed', usedIn: ['/blog/page/2'] },
      { location: 'head.h1', text: 'Writing, page 2', status: 'unreviewed', usedIn: ['/blog/page/2'] },
      { location: 'head.title', text: 'Writing, page 17 — meshin.co', status: 'unreviewed', usedIn: ['/blog/page/17'] },
    ],
    { titleSuffix: ' — meshin.co' }
  );
  const rendered = inherited.filter((row) => row.usedIn[0].startsWith('/blog/page/'));
  assert.deepEqual(
    rendered.map((row) => row.status),
    ['rewritten', 'rewritten', 'rewritten']
  );
  assert.equal(rendered[0].derivedFrom, 'src/pages/blog/page/[page].astro');
  assert.equal(rendered[0].reason, 'the title keeps the "Writing, page N" pattern');
});

test('a number alone does not open the rule: a page title that adds words nobody read stays unreviewed', () => {
  const inherited = inheritDerivedStatus(
    [
      {
        location: 'text',
        text: 'Writing, page',
        status: 'rewritten',
        reason: 'the title keeps the "Writing, page N" pattern',
        usedIn: ['src/pages/blog/page/[page].astro'],
      },
      {
        location: 'head.title',
        text: 'Writing, page 2 and something new — meshin.co',
        status: 'unreviewed',
        usedIn: ['/blog/page/2'],
      },
      { location: 'head.title', text: 'Writing, page two', status: 'unreviewed', usedIn: ['/blog/page/two'] },
    ],
    { titleSuffix: ' — meshin.co' }
  );
  assert.deepEqual(
    inherited.filter((row) => row.usedIn[0].startsWith('/blog/page/')).map((row) => row.status),
    ['unreviewed', 'unreviewed']
  );
});

test('with no title suffix given, only the bare numbered form inherits, so the rule never guesses a brand', () => {
  const inherited = inheritDerivedStatus([
    {
      location: 'text',
      text: 'Writing, page',
      status: 'rewritten',
      reason: 'the title keeps the "Writing, page N" pattern',
      usedIn: ['src/pages/blog/page/[page].astro'],
    },
    { location: 'head.title', text: 'Writing, page 2 — meshin.co', status: 'unreviewed', usedIn: ['/blog/page/2'] },
    { location: 'head.h1', text: 'Writing, page 2', status: 'unreviewed', usedIn: ['/blog/page/2'] },
  ]);
  assert.deepEqual(
    inherited.filter((row) => row.usedIn[0].startsWith('/blog/page/')).map((row) => row.status),
    ['unreviewed', 'rewritten']
  );
});

test('a rendered row composed differently stays unreviewed, because nobody read those words', () => {
  const inherited = inheritDerivedStatus([
    { location: 'frontmatter.title', text: 'What a CAIO does', status: 'verified', usedIn: ['src/data/faq/a.md'] },
    {
      location: 'head.title',
      text: 'What a CAIO does — meshin.co, the practice',
      status: 'unreviewed',
      usedIn: ['/faq/a'],
    },
  ]);
  assert.equal(inherited.find((row) => row.location === 'head.title').status, 'unreviewed');
});

test('an unreviewed source row lends nothing', () => {
  const inherited = inheritDerivedStatus([
    { location: 'body', text: 'Some prose here now.', status: 'unreviewed', usedIn: ['src/data/a.md'] },
    { location: 'body.p', text: 'Some prose here now.', status: 'unreviewed', usedIn: ['/a'] },
  ]);
  assert.equal(
    inherited.every((row) => row.status === 'unreviewed'),
    true
  );
});

test('declared state-conditional copy clears the dead finding, and the declaration must carry a reason', () => {
  const dead = [
    { text: 'Nothing published yet.', usedIn: ['src/pages/blog/index.astro'] },
    { text: 'Undeclared leftover.', usedIn: ['src/pages/x.astro'] },
  ];
  const { remaining, invalid } = applyConditionalCopy(dead, [
    { text: 'Nothing published yet.', reason: 'renders only when the collection is empty' },
    { text: 'Undeclared leftover.' },
  ]);
  assert.deepEqual(
    remaining.map((entry) => entry.text),
    ['Undeclared leftover.']
  );
  assert.deepEqual(
    invalid.map((entry) => entry.text),
    ['Undeclared leftover.']
  );
});

test('a declaration for copy that now ships is stale, so the list cannot rot', () => {
  const { stale } = applyConditionalCopy([], [{ text: 'This ships again now.', reason: 'was conditional' }]);
  assert.deepEqual(
    stale.map((entry) => entry.text),
    ['This ships again now.']
  );
});

const SUFFIX = ' — meshin.co';
const WORDING_FILE = 'src/utils/paginate.mjs';
const FORMAT = '{heading}, page {number}';

const wording = (overrides = {}) => ({
  location: 'constant.PAGE_HEADING_FORMAT',
  text: FORMAT,
  status: 'verified',
  reason: 'the wording of every numbered page',
  usedIn: [WORDING_FILE],
  ...overrides,
});
const shipped = (location, text, route, status = 'unreviewed', reason) => ({
  location,
  text,
  status,
  ...(reason ? { reason } : {}),
  usedIn: [route],
});
const firstPageOfTag = [
  shipped('head.title', `AI governance posts${SUFFIX}`, '/blog/tag/ai-governance', 'rewritten', 'read by the owner'),
  shipped('body.h1', 'AI governance posts', '/blog/tag/ai-governance', 'rewritten', 'read by the owner'),
];
const statusOf = (list, text) => list.find((row) => row.text === text).status;

test('a numbered tag page takes its title and heading from the reviewed first page and the reviewed wording, for page 2 and every page after it', () => {
  const derived = inheritPaginatedStatus(
    [
      wording(),
      ...firstPageOfTag,
      shipped('head.title', `AI governance posts, page 2${SUFFIX}`, '/blog/tag/ai-governance/page/2'),
      shipped('body.h1', 'AI governance posts, page 2', '/blog/tag/ai-governance/page/2'),
      shipped('body.h1', 'AI governance posts, page 17', '/blog/tag/ai-governance/page/17'),
    ],
    { titleSuffix: SUFFIX }
  );
  const children = derived.filter((row) => /\/page\/\d+$/.test(row.usedIn[0]));
  assert.deepEqual(
    children.map((row) => row.status),
    ['rewritten', 'rewritten', 'rewritten']
  );
  assert.equal(children[0].derivedFrom, '/blog/tag/ai-governance');
  assert.equal(children[0].reason, 'read by the owner');
});

test('a numbered category page is derived the same way, from the heading of its own first page', () => {
  const derived = inheritPaginatedStatus(
    [
      wording(),
      shipped('body.h1', 'AI governance articles', '/blog/category/governance', 'verified'),
      shipped('body.h1', 'AI governance articles, page 3', '/blog/category/governance/page/3'),
    ],
    { titleSuffix: SUFFIX }
  );
  assert.equal(statusOf(derived, 'AI governance articles, page 3'), 'verified');
});

test('words a person added, or the number of another route, leave the heading unreviewed', () => {
  const derived = inheritPaginatedStatus(
    [
      wording(),
      ...firstPageOfTag,
      shipped('body.h1', 'AI governance posts, page 2 and why they matter', '/blog/tag/ai-governance/page/2'),
      shipped(
        'head.title',
        `AI governance posts, page 2 — a reader's guide${SUFFIX}`,
        '/blog/tag/ai-governance/page/2'
      ),
      shipped('body.h1', 'AI governance posts, page 2', '/blog/tag/ai-governance/page/3'),
      shipped('body.h1', 'AI governance posts, page two', '/blog/tag/ai-governance/page/4'),
    ],
    { titleSuffix: SUFFIX }
  );
  assert.deepEqual(
    derived.slice(3).map((row) => row.status),
    ['unreviewed', 'unreviewed', 'unreviewed', 'unreviewed']
  );
});

test('a sentence a person wrote on a numbered route is still unreviewed, whatever else the route derives', () => {
  const derived = inheritPaginatedStatus(
    [
      wording(),
      ...firstPageOfTag,
      shipped('body.h1', 'AI governance posts, page 2', '/blog/tag/ai-governance/page/2'),
      shipped('body.p', 'Our editors added this sentence by hand on page two.', '/blog/tag/ai-governance/page/2'),
    ],
    { titleSuffix: SUFFIX }
  );
  assert.equal(statusOf(derived, 'AI governance posts, page 2'), 'rewritten');
  assert.equal(statusOf(derived, 'Our editors added this sentence by hand on page two.'), 'unreviewed');
});

test('nothing derives from a first page nobody reviewed, from a route with no first page, or while the wording row is missing or unreviewed', () => {
  const child = shipped('body.h1', 'AI governance posts, page 2', '/blog/tag/ai-governance/page/2');
  const unreviewedParent = [shipped('body.h1', 'AI governance posts', '/blog/tag/ai-governance')];
  assert.equal(statusOf(inheritPaginatedStatus([wording(), ...unreviewedParent, child]), child.text), 'unreviewed');
  assert.equal(statusOf(inheritPaginatedStatus([wording(), child]), child.text), 'unreviewed');
  assert.equal(statusOf(inheritPaginatedStatus([...firstPageOfTag, child]), child.text), 'unreviewed');
  assert.equal(
    statusOf(inheritPaginatedStatus([wording({ status: 'unreviewed' }), ...firstPageOfTag, child]), child.text),
    'unreviewed'
  );
});

test('with no title suffix given, only the bare heading derives, so the rule never guesses a brand', () => {
  const derived = inheritPaginatedStatus([
    wording(),
    ...firstPageOfTag,
    shipped('head.title', `AI governance posts, page 2${SUFFIX}`, '/blog/tag/ai-governance/page/2'),
    shipped('body.h1', 'AI governance posts, page 2', '/blog/tag/ai-governance/page/2'),
  ]);
  assert.deepEqual(
    derived.slice(3).map((row) => row.status),
    ['unreviewed', 'rewritten']
  );
});

const pageRows = (format) => [
  { location: 'constant.PAGE_HEADING_FORMAT', text: format, status: 'unreviewed', usedIn: [WORDING_FILE] },
  shipped('body.h1', 'AI governance posts', '/blog/tag/ai-governance', 'rewritten', 'read by the owner'),
  shipped(
    'body.h1',
    format.replace('{heading}', 'AI governance posts').replace('{number}', '2'),
    '/blog/tag/ai-governance/page/2'
  ),
];
const readSite = (siteRows, dispositions) => {
  const applied = applyDispositions(siteRows, dispositions);
  return { stale: applied.stale, rows: inheritDerivedStatus(applied.rows) };
};

test('editing the pagination wording makes its own row stale, and every numbered page follows it back to unreviewed until a person reads the new wording', () => {
  const edited = '{heading} — page {number}';
  const sealed = [
    {
      target: WORDING_FILE,
      status: 'verified',
      reason: 'the wording of every numbered page',
      digest: digestFor(pageRows(FORMAT), WORDING_FILE),
    },
  ];

  const before = readSite(pageRows(FORMAT), sealed);
  assert.deepEqual(before.stale, []);
  assert.equal(before.rows[2].status, 'rewritten');

  const after = readSite(pageRows(edited), sealed);
  assert.equal(after.stale.length, 1);
  assert.equal(after.stale[0].target, WORDING_FILE);
  assert.equal(after.rows[0].status, 'unreviewed');
  assert.equal(after.rows[2].text, 'AI governance posts — page 2');
  assert.equal(after.rows[2].status, 'unreviewed');

  const reread = [{ ...sealed[0], digest: digestFor(pageRows(edited), WORDING_FILE) }];
  assert.equal(readSite(pageRows(edited), reread).rows[2].status, 'rewritten');
});

test('a new numbered route leaves the digest of its first page unchanged and writes no row, so the seal still holds', () => {
  const lead = 'All posts tagged AI governance, newest first.';
  const firstPage = [...firstPageOfTag, shipped('body.p', lead, '/blog/tag/ai-governance', 'rewritten')];
  const withPageTwo = [
    wording(),
    ...firstPage.slice(0, 2),
    { ...firstPage[2], usedIn: ['/blog/tag/ai-governance', '/blog/tag/ai-governance/page/2'] },
    shipped('body.h1', 'AI governance posts, page 2', '/blog/tag/ai-governance/page/2'),
  ];

  const before = digestFor([wording(), ...firstPage], '/blog/tag/ai-governance');
  const snapshot = JSON.stringify(withPageTwo);
  const derived = inheritPaginatedStatus(withPageTwo);

  assert.equal(digestFor(withPageTwo, '/blog/tag/ai-governance'), before);
  assert.equal(digestFor(derived, '/blog/tag/ai-governance'), before);
  assert.equal(JSON.stringify(withPageTwo), snapshot);
  assert.equal(derived.length, withPageTwo.length);
});

const cardContext = [
  wording(),
  shipped('body.h1', 'AI governance posts', '/blog/tag/ai-governance', 'rewritten', 'read by the owner'),
  shipped('body.h1', 'EU AI Act posts', '/blog/tag/eu-ai-act', 'verified', 'read by the owner'),
  {
    location: 'constant.title',
    text: 'AI governance',
    status: 'verified',
    reason: 'a category name',
    usedIn: ['src/data/categories.mjs'],
  },
];

test('a card line made only of a date, a reading time, a known category name and known tags on numbered routes is composed text, not copy', () => {
  const derived = inheritPaginatedStatus([
    ...cardContext,
    shipped('body.p', '08 Sept 2026 · 6 min read · AI governance', '/blog/tag/ai-governance/page/2'),
    shipped('body.p', 'ai-governance · eu-ai-act', '/blog/tag/ai-governance/page/2'),
  ]);
  assert.deepEqual(
    derived.slice(4).map((row) => row.status),
    ['verified', 'rewritten']
  );
});

test('a card line with a word of its own, an unknown tag, or a place outside numbered routes stays unreviewed', () => {
  const onPageTwo = '/blog/tag/ai-governance/page/2';
  const derived = inheritPaginatedStatus([
    ...cardContext,
    shipped('body.p', '08 Sept 2026 · 6 min read · Our favourite', onPageTwo),
    shipped('body.p', 'ai-governance · a-tag-nobody-made', onPageTwo),
    { ...shipped('body.p', '09 Sept 2026 · 6 min read · AI governance', onPageTwo), usedIn: [onPageTwo, '/some-page'] },
  ]);
  assert.deepEqual(
    derived.slice(4).map((row) => row.status),
    ['unreviewed', 'unreviewed', 'unreviewed']
  );
});

test('a card line is read against category names only, so a phrase reviewed elsewhere on the site does not turn it into composed text', () => {
  const phrase = {
    location: 'body.p',
    text: 'Book a call',
    status: 'verified',
    reason: 'read by the owner',
    usedIn: ['src/pages/about.astro'],
  };
  const derived = inheritPaginatedStatus([
    ...cardContext,
    phrase,
    shipped('body.p', '08 Sept 2026 · 6 min read · Book a call', '/blog/tag/ai-governance/page/2'),
  ]);
  assert.equal(derived.at(-1).status, 'unreviewed');
});
