import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readEngineConfig } from './engine-config.mjs';
import { renderEntry } from './entry-files.mjs';
import { claimOf, DRAFTS, FORMATS, RESOLVED_SOURCES, RUN_DATE, RUN_DAY, splitEntry } from './fixtures/entry-drafts.mjs';

const ARTICLE_AUTHOR = readEngineConfig().content.formats.article.author;

const render = (format, draft = DRAFTS[format]) => renderEntry({ claim: claimOf(format), draft, runDate: RUN_DATE });

test('a term entry carries the claim, the model fields and the writer fields in the order of the live glossary', () => {
  const { path, route, text } = render('term');
  const { frontmatter, keys, body } = splitEntry(text);

  assert.equal(path, 'site/src/data/glossary/model-registry.md');
  assert.equal(route, '/glossary/model-registry');
  assert.deepEqual(keys, [
    'title',
    'term',
    'description',
    'publishDate',
    'updatedDate',
    'shortDefinition',
    'definition',
    'relatedTerms',
    'sources',
  ]);
  assert.deepEqual(frontmatter, {
    title: 'What is a model registry?',
    term: 'model registry',
    description: DRAFTS.term.fields.description,
    publishDate: RUN_DAY,
    updatedDate: RUN_DAY,
    shortDefinition: DRAFTS.term.fields.shortDefinition,
    definition: DRAFTS.term.fields.definition,
    relatedTerms: ['ai-register', 'model-provenance'],
    sources: RESOLVED_SOURCES,
  });
  assert.equal(body, `\n${DRAFTS.term.body}\n`);
});

test('a term entry has no author, because the glossary schema has none', () => {
  assert.ok(!splitEntry(render('term').text).keys.includes('author'));
});

test('an article entry carries the author the site has, and its lists in the order of the live posts', () => {
  const { path, route, text } = render('article');
  const { frontmatter, keys, body } = splitEntry(text);

  assert.equal(path, 'site/src/data/post/how-to-write-an-ai-incident-runbook.md');
  assert.equal(route, '/blog/how-to-write-an-ai-incident-runbook');
  assert.deepEqual(keys, [
    'title',
    'description',
    'publishDate',
    'updatedDate',
    'shortAnswer',
    'fullAnswer',
    'keyTakeaways',
    'faq',
    'category',
    'tags',
    'sources',
    'author',
    'relatedResources',
  ]);
  assert.equal(frontmatter.title, 'How to write an AI incident runbook');
  assert.equal(frontmatter.author, ARTICLE_AUTHOR);
  assert.deepEqual(frontmatter.faq, DRAFTS.article.fields.faq);
  assert.deepEqual(frontmatter.tags, ['ai-governance', 'production-readiness']);
  assert.deepEqual(frontmatter.relatedResources, ['ai-governance-starter-kit']);
  assert.deepEqual(frontmatter.sources, RESOLVED_SOURCES);
  assert.equal(body, `\n${DRAFTS.article.body.trim()}\n`);
});

test('empty optional lists are left out, because the schema defaults them', () => {
  const article = { ...DRAFTS.article, fields: { ...DRAFTS.article.fields, faq: [], tags: [], relatedResources: [] } };
  const term = { ...DRAFTS.term, fields: { ...DRAFTS.term.fields, relatedTerms: [] } };
  const omitted = splitEntry(render('article', article).text).keys.filter((key) =>
    ['faq', 'tags', 'relatedResources'].includes(key)
  );

  assert.deepEqual(omitted, []);
  assert.ok(!splitEntry(render('term', term).text).keys.includes('relatedTerms'));
});

test('the dates are dates and every retrieval date is a string, as the site reads the front matter', () => {
  for (const format of FORMATS) {
    const { frontmatter } = splitEntry(render(format).text);
    assert.ok(frontmatter.publishDate instanceof Date && frontmatter.updatedDate instanceof Date);
    assert.equal(frontmatter.publishDate.toISOString(), '2026-11-02T00:00:00.000Z');
    for (const source of frontmatter.sources) assert.equal(typeof source.retrieved, 'string');
  }
  const raw = render('term').text;
  assert.match(raw, /^publishDate: 2026-11-02$/m);
  assert.match(raw, /^ {4}retrieved: '2026-11-02'$/m);
});

test('the draft marker, the source ids and the model-only fields never reach the file', () => {
  for (const format of FORMATS) {
    const { text } = render(format);
    assert.ok(!/^draft:/m.test(text), format);
    assert.ok(!/\bS[12]\b/.test(text), format);
    assert.ok(!/^passage:/m.test(text), format);
    assert.ok(!/^claims:/m.test(text), format);
  }
});
