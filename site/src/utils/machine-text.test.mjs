import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  absoluteUrl,
  stripMarkdown,
  renderLlmsTxt,
  renderLlmsFull,
  renderLlmsCollection,
  publicIndexableStaticPages,
  buildFeedItems,
  mergeWithKindFloor,
  toRssItems,
  renderSidecar,
  collectionHubs,
  liveTopicMap,
  sidecarFileForRoute,
  sidecarRoutes,
  HUB_PAGES,
} from './machine-text.mjs';
import { lastmod } from './lastmod.mjs';
import { toLlmsEntry } from './llms-collections.mjs';

const ORIGIN = 'https://meshin.co';

test('an absolute url has no trailing slash except at the root', () => {
  assert.equal(absoluteUrl(ORIGIN, '/'), 'https://meshin.co/');
  assert.equal(absoluteUrl(ORIGIN, '/blog/my-post'), 'https://meshin.co/blog/my-post');
  assert.equal(absoluteUrl(ORIGIN, '/glossary/shadow-ai'), 'https://meshin.co/glossary/shadow-ai');
});

test('absoluteUrl never leaves a trailing slash on a non-root path', () => {
  assert.ok(!absoluteUrl(ORIGIN, '/services/assessment').endsWith('/'));
});

test('stripMarkdown drops a fenced code block entirely, including its content', () => {
  const input = 'Before.\n\n```bash\nnpm install\n```\n\nAfter.';
  const output = stripMarkdown(input);
  assert.ok(!output.includes('```'));
  assert.ok(!output.includes('npm install'));
  assert.ok(output.includes('Before.'));
  assert.ok(output.includes('After.'));
});

test('stripMarkdown turns a heading into a plain line', () => {
  assert.equal(stripMarkdown('## Why it matters'), 'Why it matters');
});

test('stripMarkdown turns a link into its visible text and drops the url', () => {
  const output = stripMarkdown('Read the [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) first.');
  assert.equal(output, 'Read the NIST AI RMF first.');
});

test('stripMarkdown turns bold text into plain text without corrupting an underscored identifier', () => {
  assert.equal(stripMarkdown('- **An owner.** One name.'), '- An owner. One name.');
  assert.equal(stripMarkdown('A __double underscore bold__ example.'), 'A double underscore bold example.');
  assert.equal(stripMarkdown('The user_id column stays untouched.'), 'The user_id column stays untouched.');
});

test('renderLlmsTxt opens with the site name and the tagline as a blockquote', () => {
  const output = renderLlmsTxt({ site: 'meshin.co', tagline: 'Plain-spoken AI governance.', sections: [] });
  assert.equal(output, '# meshin.co\n\n> Plain-spoken AI governance.\n');
});

test('renderLlmsTxt keeps sections in the order given and links with absolute urls', () => {
  const sections = [
    {
      title: 'Offers',
      items: [{ title: 'Assessment', url: `${ORIGIN}/services/assessment`, description: 'Two weeks to a memo.' }],
    },
    {
      title: 'Writing',
      items: [{ title: 'First post', url: `${ORIGIN}/blog/first-post`, description: 'An answer.' }],
    },
  ];
  const output = renderLlmsTxt({ site: 'meshin.co', tagline: 'Tagline.', sections });
  assert.ok(output.indexOf('## Offers') < output.indexOf('## Writing'));
  assert.ok(output.includes('- [Assessment](https://meshin.co/services/assessment): Two weeks to a memo.'));
});

test('renderLlmsTxt appends the ISO updatedDate to a dated entry line', () => {
  const sections = [
    {
      title: 'Writing',
      items: [
        {
          title: 'A post',
          url: `${ORIGIN}/blog/a-post`,
          description: 'Fresh.',
          updated: new Date('2026-09-05T08:00:00Z'),
        },
      ],
    },
  ];
  const output = renderLlmsTxt({ site: 'meshin.co', tagline: 'Tagline.', sections });
  assert.ok(output.includes('- [A post](https://meshin.co/blog/a-post) (updated 2026-09-05T08:00:00.000Z): Fresh.'));
});

test('renderLlmsTxt accepts a pre-rendered ISO string and leaves an undated entry line unchanged', () => {
  const sections = [
    {
      title: 'Pages',
      items: [
        {
          title: 'About',
          url: `${ORIGIN}/about`,
          description: 'Undated.',
          updated: '2026-09-05T08:00:00.000Z',
        },
        { title: 'Home', url: `${ORIGIN}/`, description: 'No date.' },
      ],
    },
  ];
  const output = renderLlmsTxt({ site: 'meshin.co', tagline: 'Tagline.', sections });
  assert.ok(output.includes('- [About](https://meshin.co/about) (updated 2026-09-05T08:00:00.000Z): Undated.'));
  assert.ok(output.includes('- [Home](https://meshin.co/): No date.'));
  assert.ok(!output.includes('updated 1970'));
});

test('renderLlmsTxt omits a section heading entirely when its collection is empty', () => {
  const sections = [
    { title: 'Offers', items: [{ title: 'Assessment', url: `${ORIGIN}/services/assessment`, description: 'x' }] },
    { title: 'Glossary', items: [] },
  ];
  const output = renderLlmsTxt({ site: 'meshin.co', tagline: 'Tagline.', sections });
  assert.ok(!output.includes('Glossary'));
});

test('renderLlmsTxt ends with exactly one newline', () => {
  const output = renderLlmsTxt({ site: 'meshin.co', tagline: 'Tagline.', sections: [] });
  assert.ok(output.endsWith('\n'));
  assert.ok(!output.endsWith('\n\n'));
});

test('renderLlmsCollection opens with the site name and the collection title', () => {
  const output = renderLlmsCollection({ site: 'meshin.co', title: 'Writing', entries: [] });
  assert.equal(output, '# meshin.co\n\n## Writing\n');
});

test('renderLlmsCollection heads each entry with title, date and url', () => {
  const entries = [
    {
      title: 'First',
      url: `${ORIGIN}/blog/first`,
      summary: 'Summary one.',
      body: 'Body one.',
      updated: '2026-09-05T08:00:00.000Z',
    },
    { title: 'Undated', url: `${ORIGIN}/blog/undated`, summary: 'Summary two.', body: 'Body two.' },
  ];
  const output = renderLlmsCollection({ site: 'meshin.co', title: 'Writing', entries });
  assert.ok(
    output.includes(
      '# First\n\n2026-09-05T08:00:00.000Z\n\n[https://meshin.co/blog/first](https://meshin.co/blog/first)\n\nSummary one.\n\nBody one.'
    )
  );
  assert.ok(
    output.includes(
      '# Undated\n\n[https://meshin.co/blog/undated](https://meshin.co/blog/undated)\n\nSummary two.\n\nBody two.'
    )
  );
  assert.ok(output.includes('Body one.\n\n---\n\n# Undated'));
});

test('renderLlmsCollection strips markdown from the body of every entry', () => {
  const entries = [
    {
      title: 'Guide',
      url: `${ORIGIN}/blog/guide`,
      summary: 'Summary.',
      body: '## Section\n\nSee the [source](https://example.com) below.\n\n```js\nconst x = 1;\n```',
    },
  ];
  const output = renderLlmsCollection({ site: 'meshin.co', title: 'Writing', entries });
  assert.ok(output.includes('Section\n\nSee the source below.'));
  assert.ok(!output.includes('```'));
  assert.ok(!output.includes('https://example.com'));
});

test('renderLlmsCollection never emits a draft or noindex entry', () => {
  const entries = [
    { title: 'Live', url: `${ORIGIN}/blog/live`, summary: 's', body: 'b' },
    { title: 'Draft', url: `${ORIGIN}/blog/draft`, summary: 's', body: 'b', draft: true },
    { title: 'Hidden', url: `${ORIGIN}/blog/hidden`, summary: 's', body: 'b', noindex: true },
  ];
  const output = renderLlmsCollection({ site: 'meshin.co', title: 'Writing', entries });
  assert.ok(output.includes('# Live'));
  assert.ok(!output.includes('# Draft'));
  assert.ok(!output.includes('# Hidden'));
});

test('the real /llms/{collection}.txt pipeline drops a draft or noindex content entry, not just a pre-filtered fixture', () => {
  const contentEntries = [
    { id: 'live', body: 'Live body.', data: { title: 'Live', description: 'd' } },
    { id: 'draft', body: 'Draft body.', data: { title: 'Draft', description: 'd', draft: true } },
    { id: 'hidden', body: 'Hidden body.', data: { title: 'Hidden', description: 'd', noindex: true } },
  ];
  const entries = contentEntries.map(toLlmsEntry()).map((entry) => ({
    title: entry.title,
    url: `${ORIGIN}/blog/${entry.id}`,
    summary: entry.description,
    body: entry.body,
    updated: entry.updated,
    draft: entry.draft,
    noindex: entry.noindex,
  }));
  const output = renderLlmsCollection({ site: 'meshin.co', title: 'Writing', entries });
  assert.ok(output.includes('# Live'));
  assert.ok(!output.includes('# Draft'));
  assert.ok(!output.includes('# Hidden'));
});

test('renderLlmsFull carries the actual full body text of every collection, not just links to it', () => {
  const sections = [
    {
      title: 'Offers',
      entries: [
        {
          title: 'Assessment',
          url: `${ORIGIN}/services/assessment`,
          summary: 'Two weeks.',
          body: 'The full write-up of the assessment offer.',
          updated: '2026-09-01T00:00:00.000Z',
        },
      ],
    },
    {
      title: 'Questions and answers',
      entries: [
        {
          title: 'How do you charge?',
          url: `${ORIGIN}/faq/how-do-you-charge`,
          summary: 'Fixed structures.',
          body: 'Three fixed structures, no hourly billing.',
          updated: '2026-09-12T00:00:00.000Z',
        },
      ],
    },
  ];
  const output = renderLlmsFull({ site: 'meshin.co', sections });

  assert.ok(output.startsWith('# meshin.co\n\n## Offers'));
  assert.ok(output.includes('The full write-up of the assessment offer.'));
  assert.ok(output.includes('## Questions and answers'));
  assert.ok(output.includes('Three fixed structures, no hourly billing.'));
});

test('renderLlmsFull never emits a draft or noindex entry', () => {
  const sections = [
    {
      title: 'Writing',
      entries: [
        { title: 'Live', url: `${ORIGIN}/blog/live`, summary: 's', body: 'Live body.', updated: null },
        { title: 'Draft', url: `${ORIGIN}/blog/draft`, summary: 's', body: 'Draft body.', updated: null, draft: true },
        {
          title: 'Hidden',
          url: `${ORIGIN}/blog/hidden`,
          summary: 's',
          body: 'Hidden body.',
          updated: null,
          noindex: true,
        },
      ],
    },
  ];
  const output = renderLlmsFull({ site: 'meshin.co', sections });

  assert.ok(output.includes('Live body.'));
  assert.ok(!output.includes('Draft body.'));
  assert.ok(!output.includes('Hidden body.'));
});

test('renderLlmsFull omits a section heading body when its collection has no live entries, and ends with one newline', () => {
  const output = renderLlmsFull({ site: 'meshin.co', sections: [{ title: 'Case studies', entries: [] }] });

  assert.equal(output, '# meshin.co\n\n## Case studies\n');
});

test('publicIndexableStaticPages never lists the noindex static pages', () => {
  const paths = publicIndexableStaticPages().map((page) => page.path);
  for (const noindex of ['/search', '/styleguide', '/404']) {
    assert.ok(!paths.includes(noindex), `${noindex} must not be indexable`);
  }
});

test('publicIndexableStaticPages covers every public static page of the site', () => {
  const paths = publicIndexableStaticPages().map((page) => page.path);
  const expected = [
    '/',
    '/blog/tags',
    '/about',
    '/approach',
    '/pricing',
    '/faq',
    '/contact',
    '/ai-policy',
    '/security',
    '/now',
    '/imprint',
    '/privacy',
    '/terms',
  ];
  assert.deepEqual(paths.slice().sort(), expected.slice().sort());
});

test('a rendered llms.txt built from publicIndexableStaticPages never links a noindex page', () => {
  const items = publicIndexableStaticPages().map(({ path, title, description }) => ({
    title,
    description,
    url: absoluteUrl(ORIGIN, path),
  }));
  const output = renderLlmsTxt({
    site: 'meshin.co',
    tagline: 'Tagline.',
    sections: [{ title: 'Pages', items }],
  });
  for (const noindex of ['/search]', '/styleguide]', '/404]']) {
    assert.ok(!output.includes(noindex), `llms.txt must not link ${noindex.replace(']', '')}`);
  }
});

test('buildFeedItems produces exactly the JSON Feed 1.1 item fields plus its kind', () => {
  const entries = [
    {
      id: 'a',
      url: `${ORIGIN}/blog/a`,
      title: 'A',
      summary: 's',
      body: 'b',
      publishDate: '2026-01-01',
      updatedDate: '2026-01-02',
      tags: ['governance'],
      kind: 'post',
    },
  ];
  const [item] = buildFeedItems(entries);
  assert.deepEqual(
    Object.keys(item).sort(),
    ['id', 'url', 'title', 'summary', 'content_text', 'date_published', 'date_modified', 'tags', 'kind'].sort()
  );
});

test('buildFeedItems sorts by lastmod newest first, not by publishDate alone', () => {
  const entries = [
    {
      id: 'published-newest',
      url: `${ORIGIN}/blog/a`,
      title: 'A',
      summary: 's',
      body: 'b',
      publishDate: '2026-06-01',
      updatedDate: '2026-06-01',
    },
    {
      id: 'updated-newest',
      url: `${ORIGIN}/blog/b`,
      title: 'B',
      summary: 's',
      body: 'b',
      publishDate: '2026-01-01',
      updatedDate: '2026-08-01',
    },
  ];
  const items = buildFeedItems(entries);
  assert.deepEqual(
    items.map((item) => item.id),
    ['updated-newest', 'published-newest']
  );
  assert.equal(items[0].date_published, '2026-01-01T00:00:00.000Z');
  assert.equal(items[0].date_modified, '2026-08-01T00:00:00.000Z');
  assert.equal(items[1].date_published, '2026-06-01T00:00:00.000Z');
  assert.equal(items[1].date_modified, '2026-06-01T00:00:00.000Z');
});

test('buildFeedItems strips markdown out of content_text, the shared helper it uses with renderLlmsFull', () => {
  const entries = [
    {
      id: 'a',
      url: `${ORIGIN}/blog/a`,
      title: 'A',
      summary: 's',
      body: 'See the [link](https://example.com).',
      publishDate: '2026-01-01',
      updatedDate: '2026-01-01',
    },
  ];
  const [item] = buildFeedItems(entries);
  assert.equal(item.content_text, 'See the link.');
});

test('buildFeedItems never emits a draft or noindex entry', () => {
  const entries = [
    {
      id: 'live',
      url: `${ORIGIN}/blog/live`,
      title: 'Live',
      summary: 's',
      body: 'b',
      publishDate: '2026-01-01',
      updatedDate: '2026-01-01',
    },
    {
      id: 'draft',
      url: `${ORIGIN}/blog/draft`,
      title: 'Draft',
      summary: 's',
      body: 'b',
      publishDate: '2026-01-01',
      updatedDate: '2026-01-01',
      draft: true,
    },
    {
      id: 'hidden',
      url: `${ORIGIN}/blog/hidden`,
      title: 'Hidden',
      summary: 's',
      body: 'b',
      publishDate: '2026-01-01',
      updatedDate: '2026-01-01',
      noindex: true,
    },
  ];
  assert.deepEqual(
    buildFeedItems(entries).map((item) => item.id),
    ['live']
  );
});

test('buildFeedItems returns an empty array when there are no live entries', () => {
  assert.deepEqual(buildFeedItems([]), []);
});

test('mergeWithKindFloor keeps evergreen kinds in the merged window when a newer kind floods it', () => {
  const posts = Array.from({ length: 8 }, (_, i) => ({
    id: `post-${i}`,
    url: `${ORIGIN}/blog/post-${i}`,
    title: `Post ${i}`,
    summary: 's',
    body: 'b',
    publishDate: `2026-09-${String(10 + i).padStart(2, '0')}`,
    updatedDate: `2026-09-${String(10 + i).padStart(2, '0')}`,
    kind: 'post',
  }));
  const terms = Array.from({ length: 3 }, (_, i) => ({
    id: `term-${i}`,
    url: `${ORIGIN}/glossary/term-${i}`,
    title: `Term ${i}`,
    summary: 's',
    body: 'b',
    publishDate: `2026-0${1 + i}-01`,
    updatedDate: `2026-0${1 + i}-01`,
    kind: 'glossary',
  }));

  const merged = mergeWithKindFloor([...posts, ...terms], { window: 6, floor: 2 });

  assert.equal(merged.length, 4);
  assert.ok(merged.filter((entry) => entry.kind === 'glossary').length >= 2);
  assert.ok(merged.filter((entry) => entry.kind === 'post').length >= 2);
  assert.deepEqual(
    merged.map((entry) => entry.id),
    [...merged].sort((a, b) => Date.parse(lastmod(b)) - Date.parse(lastmod(a))).map((entry) => entry.id)
  );
});

test('mergeWithKindFloor guarantees every kind reaches its floor even when one large kind shares the single newest date across the whole merge window', () => {
  const kind = (name, count, date) =>
    Array.from({ length: count }, (_, i) => ({
      id: `${name}-${i}`,
      url: `${ORIGIN}/${name}/${i}`,
      title: `${name} ${i}`,
      summary: 's',
      body: 'b',
      publishDate: date,
      updatedDate: date,
      kind: name,
    }));
  const entries = [
    ...kind('faq', 25, '2026-09-12'),
    ...kind('post', 4, '2026-09-08'),
    ...kind('service', 3, '2026-09-08'),
    ...kind('resource', 5, '2026-09-08'),
    ...kind('case', 1, '2026-09-08'),
    ...kind('glossary', 30, '2026-09-08'),
  ];

  const merged = mergeWithKindFloor(entries);
  const counts = new Map();
  for (const entry of merged) counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);

  for (const [name, count] of [
    ['faq', 25],
    ['post', 4],
    ['service', 3],
    ['resource', 5],
    ['case', 1],
    ['glossary', 30],
  ]) {
    const floor = Math.min(5, count);
    assert.ok((counts.get(name) ?? 0) >= floor, `${name} carries ${counts.get(name) ?? 0}, floor is ${floor}`);
  }
});

test('mergeWithKindFloor keeps every entry of a kind smaller than the floor and never caps a small site', () => {
  const entries = [
    {
      id: 'p1',
      url: `${ORIGIN}/blog/p1`,
      title: 'P1',
      summary: 's',
      body: 'b',
      publishDate: '2026-05-01',
      updatedDate: '2026-05-01',
      kind: 'post',
    },
    {
      id: 'f1',
      url: `${ORIGIN}/faq/f1`,
      title: 'F1',
      summary: 's',
      body: 'b',
      publishDate: '2026-04-01',
      updatedDate: '2026-04-01',
      kind: 'faq',
    },
    {
      id: 'draft',
      url: `${ORIGIN}/blog/d`,
      title: 'D',
      summary: 's',
      body: 'b',
      publishDate: '2026-06-01',
      updatedDate: '2026-06-01',
      kind: 'post',
      draft: true,
    },
  ];

  assert.deepEqual(
    mergeWithKindFloor(entries, { window: 50, floor: 5 }).map((entry) => entry.id),
    ['p1', 'f1']
  );
});

test('toRssItems maps a JSON Feed item onto an rss.xml item with the kind as its category', () => {
  const [item] = toRssItems(
    buildFeedItems([
      {
        id: 'a',
        url: `${ORIGIN}/faq/a`,
        title: 'A',
        summary: 'Short answer.',
        body: 'Full text.',
        publishDate: '2026-01-01',
        updatedDate: '2026-02-01',
        kind: 'faq',
      },
    ])
  );

  assert.deepEqual(
    { ...item, pubDate: item.pubDate.toISOString() },
    {
      title: 'A',
      description: 'Short answer.',
      link: `${ORIGIN}/faq/a`,
      pubDate: '2026-01-01T00:00:00.000Z',
      categories: ['faq'],
      content: 'Full text.',
    }
  );
});

test('a markdown sidecar carries a title, canonical url and the body verbatim', () => {
  const sidecar = renderSidecar({
    title: 'A post',
    url: 'https://meshin.co/blog/a-post',
    description: 'A description.',
    updated: new Date('2026-09-05T00:00:00Z'),
    body: '## Heading\n\nA paragraph with **bold** text.\n',
  });

  assert.match(sidecar, /^# A post\n/);
  assert.match(sidecar, /^> A description\.$/m);
  assert.match(sidecar, /^Source: https:\/\/meshin\.co\/blog\/a-post$/m);
  assert.match(sidecar, /^Updated: 2026-09-05$/m);
  assert.ok(sidecar.endsWith('## Heading\n\nA paragraph with **bold** text.\n'));
});

test('collectionHubs drops a collection whose base is already a static page path', () => {
  const collections = [
    { name: 'post', base: '/blog' },
    { name: 'faq', base: '/faq' },
  ];
  const hubs = collectionHubs({ collections, staticPaths: ['/faq', '/about'] });
  assert.deepEqual(hubs, [{ name: 'post', base: '/blog' }]);
});

test('collectionHubs keeps every collection when no static page already covers its base', () => {
  const collections = [
    { name: 'post', base: '/blog' },
    { name: 'glossary', base: '/glossary' },
  ];
  const hubs = collectionHubs({ collections, staticPaths: new Set(['/faq']) });
  assert.deepEqual(hubs, collections);
});

test('collectionHubs drops a withheld hub, so a collection with no live entry is offered nowhere', () => {
  const collections = [
    { name: 'post', base: '/blog' },
    { name: 'case', base: '/case-studies' },
  ];
  const hubs = collectionHubs({ collections, staticPaths: [], withheld: ['/case-studies'] });
  assert.deepEqual(hubs, [{ name: 'post', base: '/blog' }]);
});

test('sidecarFileForRoute maps a leaf route onto a dist-relative markdown file path', () => {
  assert.equal(sidecarFileForRoute('/glossary/evals'), 'glossary/evals.md');
});

test('sidecarFileForRoute maps the root route onto index.md, never a bare .md file', () => {
  assert.equal(sidecarFileForRoute('/'), 'index.md');
});

test('sidecarRoutes carries every public static page plus every collection hub not already a static page', () => {
  const paths = sidecarRoutes().map((page) => page.path);
  for (const staticPath of publicIndexableStaticPages().map((page) => page.path)) {
    assert.ok(paths.includes(staticPath), `${staticPath} missing from sidecarRoutes`);
  }
  for (const hub of ['/blog', '/glossary', '/resources', '/services', '/case-studies']) {
    assert.ok(paths.includes(hub), `${hub} missing from sidecarRoutes`);
  }
});

test('sidecarRoutes never lists a hub twice when its base is already a static page path', () => {
  const paths = sidecarRoutes().map((page) => page.path);
  assert.equal(paths.filter((path) => path === '/faq').length, 1);
});

test('sidecarRoutes drops a caller-supplied hub whose base a static page already covers', () => {
  const staticPages = [{ path: '/about', title: 'About', description: 'd' }];
  const hubs = [
    { base: '/about', title: 'wrong', description: 'wrong' },
    { base: '/blog', title: 'Writing', description: 'd2' },
  ];
  const paths = sidecarRoutes({ staticPages, hubs }).map((page) => page.path);
  assert.deepEqual(paths, ['/about', '/blog']);
});

test('sidecarRoutes leaves out a withheld hub and keeps every other, so the mirror of an empty collection is not written', () => {
  const paths = sidecarRoutes({ withheld: ['/case-studies'] }).map((page) => page.path);
  assert.equal(paths.includes('/case-studies'), false);
  for (const hub of ['/blog', '/glossary', '/resources', '/services']) {
    assert.ok(paths.includes(hub), `${hub} missing from sidecarRoutes`);
  }
});

test('every HUB_PAGES entry carries a non-empty title and description', () => {
  for (const hub of HUB_PAGES) {
    assert.ok(hub.title.length > 0, `${hub.base} has no title`);
    assert.ok(hub.description.length > 0, `${hub.base} has no description`);
  }
});

test('liveTopicMap groups posts by a single-value key and keeps the newest updated stamp', () => {
  const posts = [
    { category: 'governance', updated: '2026-01-01T00:00:00.000Z' },
    { category: 'governance', updated: '2026-06-01T00:00:00.000Z' },
    { category: 'executive', updated: '2026-03-01T00:00:00.000Z' },
  ];
  const map = liveTopicMap(posts, 'category');
  assert.deepEqual(
    [...map.entries()].sort(),
    [
      ['executive', '2026-03-01T00:00:00.000Z'],
      ['governance', '2026-06-01T00:00:00.000Z'],
    ].sort()
  );
});

test('liveTopicMap groups posts by an array-value key, sharing one slug across posts', () => {
  const posts = [
    { tags: ['ai-governance', 'shadow-ai'], updated: '2026-02-01T00:00:00.000Z' },
    { tags: ['ai-governance'], updated: '2026-05-01T00:00:00.000Z' },
  ];
  const map = liveTopicMap(posts, 'tags');
  assert.equal(map.get('ai-governance'), '2026-05-01T00:00:00.000Z');
  assert.equal(map.get('shadow-ai'), '2026-02-01T00:00:00.000Z');
});

test('liveTopicMap never invents a slug for a post carrying no tags', () => {
  const map = liveTopicMap([{ tags: [], updated: '2026-01-01T00:00:00.000Z' }], 'tags');
  assert.equal(map.size, 0);
});
