import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  absoluteUrl,
  stripMarkdown,
  renderLlmsTxt,
  renderLlmsFull,
  buildFeedItems,
  renderSidecar,
} from './machine-text.mjs';

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

test('renderLlmsFull opens with the site name and joins entries with a blank line and a rule', () => {
  const entries = [
    { title: 'First', url: `${ORIGIN}/blog/first`, summary: 'Summary one.', body: 'Body one.' },
    { title: 'Second', url: `${ORIGIN}/blog/second`, summary: 'Summary two.', body: 'Body two.' },
  ];
  const output = renderLlmsFull({ site: 'meshin.co', entries });
  assert.ok(output.startsWith('# meshin.co\n\n'));
  assert.ok(output.includes('Body one.\n\n---\n\n# Second'));
});

test('renderLlmsFull strips markdown from the body of every entry', () => {
  const entries = [
    {
      title: 'Guide',
      url: `${ORIGIN}/blog/guide`,
      summary: 'Summary.',
      body: '## Section\n\nSee the [source](https://example.com) below.\n\n```js\nconst x = 1;\n```',
    },
  ];
  const output = renderLlmsFull({ site: 'meshin.co', entries });
  assert.ok(output.includes('Section\n\nSee the source below.'));
  assert.ok(!output.includes('```'));
  assert.ok(!output.includes('https://example.com'));
});

test('renderLlmsFull never emits a draft or noindex entry', () => {
  const entries = [
    { title: 'Live', url: `${ORIGIN}/blog/live`, summary: 's', body: 'b' },
    { title: 'Draft', url: `${ORIGIN}/blog/draft`, summary: 's', body: 'b', draft: true },
    { title: 'Hidden', url: `${ORIGIN}/blog/hidden`, summary: 's', body: 'b', noindex: true },
  ];
  const output = renderLlmsFull({ site: 'meshin.co', entries });
  assert.ok(output.includes('# Live'));
  assert.ok(!output.includes('# Draft'));
  assert.ok(!output.includes('# Hidden'));
});

test('renderLlmsFull with no live entries still returns just the site header', () => {
  assert.equal(renderLlmsFull({ site: 'meshin.co', entries: [] }), '# meshin.co\n');
});

test('buildFeedItems produces exactly the JSON Feed 1.1 item fields', () => {
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
    },
  ];
  const [item] = buildFeedItems(entries);
  assert.deepEqual(
    Object.keys(item).sort(),
    ['id', 'url', 'title', 'summary', 'content_text', 'date_published', 'date_modified', 'tags'].sort()
  );
});

test('buildFeedItems sorts newest first and renders dates as ISO strings', () => {
  const entries = [
    {
      id: 'old',
      url: `${ORIGIN}/blog/old`,
      title: 'Old',
      summary: 's',
      body: 'b',
      publishDate: '2026-01-01',
      updatedDate: '2026-01-01',
    },
    {
      id: 'new',
      url: `${ORIGIN}/blog/new`,
      title: 'New',
      summary: 's',
      body: 'b',
      publishDate: '2026-06-01',
      updatedDate: '2026-06-01',
    },
  ];
  const items = buildFeedItems(entries);
  assert.deepEqual(
    items.map((item) => item.id),
    ['new', 'old']
  );
  assert.equal(items[0].date_published, '2026-06-01T00:00:00.000Z');
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
