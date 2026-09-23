import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ogImagePath, markdownPath, articleMetadata } from './machine-links.mjs';

test('an og image path is derived from the collection and entry id', () => {
  assert.equal(ogImagePath('post', 'why-pilots-stall'), '/og/post/why-pilots-stall.png');
  assert.equal(ogImagePath('glossary', 'evals'), '/og/glossary/evals.png');
});

test('a markdown sidecar path is the page path with a .md suffix', () => {
  assert.equal(markdownPath('/blog/why-pilots-stall'), '/blog/why-pilots-stall.md');
  assert.equal(markdownPath('/glossary/evals'), '/glossary/evals.md');
});

test('article metadata carries the absolute og image and the article dates', () => {
  const metadata = articleMetadata('https://meshin.co', {
    title: 'A post',
    description: 'A description.',
    collection: 'post',
    id: 'a-post',
    publishDate: new Date('2026-09-01T00:00:00Z'),
    updatedDate: new Date('2026-09-05T00:00:00Z'),
    section: 'governance',
    tags: ['evals'],
  });

  assert.equal(metadata.openGraph.type, 'article');
  assert.equal(metadata.openGraph.images[0].url, 'https://meshin.co/og/post/a-post.png');
  assert.equal(metadata.openGraph.images[0].width, 1200);
  assert.equal(metadata.openGraph.article.publishedTime, '2026-09-01T00:00:00.000Z');
  assert.equal(metadata.openGraph.article.modifiedTime, '2026-09-05T00:00:00.000Z');
  assert.deepEqual(metadata.openGraph.article.tags, ['evals']);
});

test('a page with no dates gets a website card, not an article one', () => {
  const metadata = articleMetadata('https://meshin.co', {
    title: 'Services',
    description: 'A description.',
    collection: 'service',
    id: 'assessment',
  });

  assert.equal(metadata.openGraph.type, 'website');
  assert.equal(metadata.openGraph.article, undefined);
});

test('a per-entry ogImage replaces the generated endpoint image', () => {
  const metadata = articleMetadata('https://meshin.co', {
    title: 'A post',
    description: 'A description.',
    collection: 'post',
    id: 'a-post',
    ogImage: '~/assets/images/custom-card.png',
  });

  assert.equal(metadata.openGraph.images.length, 1);
  assert.equal(metadata.openGraph.images[0].url, '~/assets/images/custom-card.png');
  assert.equal(metadata.openGraph.images[0].width, undefined);
});

test('a canonical override is carried through, and omitted when absent', () => {
  const withCanonical = articleMetadata('https://meshin.co', {
    title: 'A post',
    description: 'A description.',
    collection: 'post',
    id: 'a-post',
    canonical: 'https://example.com/syndicated',
  });
  assert.equal(withCanonical.canonical, 'https://example.com/syndicated');

  const withoutCanonical = articleMetadata('https://meshin.co', {
    title: 'A post',
    description: 'A description.',
    collection: 'post',
    id: 'a-post',
  });
  assert.equal(withoutCanonical.canonical, undefined);
});

test('a noindex entry sets robots index false, follow true; a live entry sets no robots field at all', () => {
  const noindexed = articleMetadata('https://meshin.co', {
    title: 'A post',
    description: 'A description.',
    collection: 'post',
    id: 'a-post',
    noindex: true,
  });
  assert.deepEqual(noindexed.robots, { index: false, follow: true });

  const live = articleMetadata('https://meshin.co', {
    title: 'A post',
    description: 'A description.',
    collection: 'post',
    id: 'a-post',
    noindex: false,
  });
  assert.equal(live.robots, undefined);
});
