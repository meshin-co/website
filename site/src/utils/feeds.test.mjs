import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FEED_BASES, isPublished, toFeedSource } from './feeds.mjs';

const ORIGIN = 'https://meshin.co';

test('FEED_BASES covers exactly the six public collections with their URL bases', () => {
  assert.deepEqual(Object.keys(FEED_BASES), ['post', 'service', 'resource', 'glossary', 'case', 'faq']);
  assert.deepEqual(FEED_BASES.faq, 'faq');
  assert.deepEqual(FEED_BASES.case, 'case-studies');
});

test('isPublished excludes a draft entry but keeps a live noindex entry', () => {
  assert.equal(isPublished({ data: { draft: true } }), false);
  assert.equal(isPublished({ data: { draft: false, noindex: true } }), true);
  assert.equal(isPublished({ data: {} }), true);
});

test('toFeedSource maps an faq entry onto question, teaser and full answer', () => {
  const answer =
    'Three fixed structures, no hourly billing. The Assessment is a fixed fee for the two weeks. The Sprint is quoted once from the scope in the statement of work.';
  const source = toFeedSource(
    {
      id: 'how-do-you-charge',
      body: '',
      data: {
        question: 'How do you charge for the work?',
        answer,
        category: 'operating-model',
        publishDate: new Date('2026-09-12'),
        updatedDate: new Date('2026-09-12'),
      },
    },
    { kind: 'faq', base: 'faq', site: ORIGIN }
  );

  assert.equal(source.url, `${ORIGIN}/faq/how-do-you-charge`);
  assert.equal(source.title, 'How do you charge for the work?');
  assert.equal(source.body, answer);
  assert.equal(source.summary, 'Three fixed structures, no hourly billing.');
  assert.deepEqual(source.tags, ['operating-model']);
  assert.equal(source.kind, 'faq');
});

test('toFeedSource maps a dated collection entry onto its body, shortAnswer summary and tags', () => {
  const source = toFeedSource(
    {
      id: 'agentic-workflow',
      body: 'Body from the markdown file.',
      data: {
        title: 'What is an agentic workflow?',
        description: 'Fallback description.',
        shortAnswer: 'A task one or more AI agents complete on their own.',
        publishDate: new Date('2026-09-08'),
        updatedDate: new Date('2026-09-08'),
        tags: ['agentic-architecture'],
      },
    },
    { kind: 'glossary', base: 'glossary', site: ORIGIN }
  );

  assert.equal(source.url, `${ORIGIN}/glossary/agentic-workflow`);
  assert.equal(source.title, 'What is an agentic workflow?');
  assert.equal(source.summary, 'A task one or more AI agents complete on their own.');
  assert.equal(source.body, 'Body from the markdown file.');
  assert.deepEqual(source.tags, ['agentic-architecture']);
});

test('toFeedSource prefers the description when an entry has no shortAnswer and defaults tags to empty', () => {
  const source = toFeedSource(
    {
      id: 'only-help',
      body: 'Case body.',
      data: {
        title: 'OnlyHelp',
        description: 'Support automation.',
        publishDate: new Date('2026-05-01'),
        updatedDate: new Date('2026-06-01'),
      },
    },
    { kind: 'case', base: 'case-studies', site: ORIGIN }
  );

  assert.equal(source.summary, 'Support automation.');
  assert.deepEqual(source.tags, []);
});
