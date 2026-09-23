import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LLMS_COLLECTIONS, latestUpdated, llmsFeedPointers, toLlmsEntry } from './llms-collections.mjs';

test('the llms surface covers exactly the six public collections', () => {
  assert.deepEqual(
    LLMS_COLLECTIONS.map((collection) => collection.name),
    ['service', 'post', 'resource', 'glossary', 'case', 'faq']
  );
});

test('every collection points at its own per-collection full-text file', () => {
  for (const { name, file } of LLMS_COLLECTIONS) {
    assert.equal(file, `/llms/${name}.txt`);
  }
});

test('toLlmsEntry maps a titled entry with shortAnswer preferred over description', () => {
  const entry = {
    id: 'ai-readiness-scorecard',
    body: 'The scorecard body.',
    data: {
      title: 'AI readiness scorecard',
      description: 'Fallback description.',
      shortAnswer: 'Score yourself across five dimensions.',
      publishDate: new Date('2026-08-01T00:00:00Z'),
      updatedDate: new Date('2026-09-05T08:00:00Z'),
    },
  };
  assert.deepEqual(toLlmsEntry('/resources')(entry), {
    id: 'ai-readiness-scorecard',
    title: 'AI readiness scorecard',
    description: 'Score yourself across five dimensions.',
    body: 'The scorecard body.',
    updated: '2026-09-05T08:00:00.000Z',
    draft: false,
    noindex: false,
  });
});

test('toLlmsEntry preserves a truthy draft or noindex flag instead of dropping it', () => {
  const draftEntry = { id: 'x', body: 'b', data: { title: 'X', description: 'd', draft: true } };
  const noindexEntry = { id: 'y', body: 'b', data: { title: 'Y', description: 'd', noindex: true } };
  assert.equal(toLlmsEntry()(draftEntry).draft, true);
  assert.equal(toLlmsEntry()(noindexEntry).noindex, true);
});

test('toLlmsEntry maps a faq entry to question, teaser and full answer', () => {
  const entry = {
    id: 'what-does-a-fractional-caio-do',
    data: {
      question: 'What does a Fractional CAIO do?',
      answer:
        'Owns the AI outcome end to end. The rest of the answer elaborates on governance, shipping and evals in more detail.',
      publishDate: new Date('2026-08-01T00:00:00Z'),
      updatedDate: new Date('2026-08-01T00:00:00Z'),
    },
  };
  const mapped = toLlmsEntry('/faq')(entry);
  assert.equal(mapped.title, 'What does a Fractional CAIO do?');
  assert.equal(mapped.body, entry.data.answer);
  assert.equal(mapped.description, 'Owns the AI outcome end to end.');
  assert.equal(mapped.updated, '2026-08-01T00:00:00.000Z');
});

test('toLlmsEntry leaves an undated entry without a freshness signal', () => {
  const entry = { id: 'x', body: 'b', data: { title: 'X', description: 'd' } };
  assert.equal(toLlmsEntry('/services')(entry).updated, null);
});

test('latestUpdated returns the newest date across entries and null when none is dated', () => {
  const entries = [{ updated: '2026-08-01T00:00:00.000Z' }, { updated: null }, { updated: '2026-09-05T08:00:00.000Z' }];
  assert.equal(latestUpdated(entries), '2026-09-05T08:00:00.000Z');
  assert.equal(latestUpdated([{ updated: null }, {}]), null);
});

test('llmsFeedPointers lists the merged feed first and one feed per collection', () => {
  const pointers = llmsFeedPointers();
  const urls = pointers.map((pointer) => pointer.url);
  assert.equal(urls[0], '/rss.xml');
  assert.deepEqual(urls.slice(1), [
    '/services/rss.xml',
    '/blog/rss.xml',
    '/resources/rss.xml',
    '/glossary/rss.xml',
    '/case-studies/rss.xml',
    '/faq/rss.xml',
  ]);
  for (const pointer of pointers) {
    assert.ok(pointer.title.length > 0);
    assert.ok(pointer.description.length > 0);
  }
});
