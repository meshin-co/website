import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { entryPath, entryRoute, renderEntry, termOf } from './entry-files.mjs';
import { WriterError } from './writer-error.mjs';
import { claimOf, DRAFTS, FORMATS, RUN_DATE } from './fixtures/entry-drafts.mjs';

const SITE = fileURLToPath(new URL('..', import.meta.url));
const REPO = fileURLToPath(new URL('../..', import.meta.url));
const COLLECTION = { term: 'glossary', article: 'post' };

test('termOf removes the question frame and the question mark and leaves the casing alone', () => {
  assert.equal(termOf('What is an AI register?'), 'AI register');
  assert.equal(termOf('What are guardrails?'), 'guardrails');
  assert.equal(termOf('What is the EU AI Act?'), 'EU AI Act');
  assert.equal(termOf('What is a model card?'), 'model card');
  assert.equal(termOf('What is ISO/IEC 42001?'), 'ISO/IEC 42001');
  assert.equal(termOf('What is observability?'), 'observability');
});

test('termOf refuses a title that has no term shape, naming the title', () => {
  for (const title of ['How do I build an AI register?', 'What is an AI register', 'What is ?']) {
    assert.throws(
      () => termOf(title),
      (error) => error instanceof WriterError && error.kind === 'build' && error.message.includes(title)
    );
  }
});

test('each format has its collection path and its route', () => {
  assert.equal(entryPath({ format: 'term', slug: 'model-card' }), 'site/src/data/glossary/model-card.md');
  assert.equal(entryPath({ format: 'article', slug: 'a-post' }), 'site/src/data/post/a-post.md');
  assert.equal(entryRoute({ format: 'term', slug: 'model-card' }), '/glossary/model-card');
  assert.equal(entryRoute({ format: 'article', slug: 'a-post' }), '/blog/a-post');
});

test('the path and the route of every live entry agree with the routes the site already declares', () => {
  const facts = JSON.parse(readFileSync(join(SITE, 'content-facts.json'), 'utf8'));
  for (const format of FORMATS) {
    const files = readdirSync(join(REPO, 'site/src/data', COLLECTION[format])).filter((name) => name.endsWith('.md'));
    assert.ok(files.length > 0);
    for (const file of files) {
      const slug = file.replace(/\.md$/, '');
      assert.equal(entryPath({ format, slug }), `site/src/data/${COLLECTION[format]}/${file}`);
      assert.ok(entryRoute({ format, slug }) in facts.targetQuery, `${format} ${slug} has no content-facts row`);
    }
  }
});

test('a format the unattended writer does not write is refused, naming the format', () => {
  const faq = { format: 'faq-answer', slug: 'who-signs' };
  const refuses = (error) =>
    error instanceof WriterError && error.kind === 'build' && error.message.includes('faq-answer');

  assert.throws(() => entryPath(faq), refuses);
  assert.throws(() => entryRoute(faq), refuses);
  assert.throws(
    () => renderEntry({ claim: { ...claimOf('term'), ...faq }, draft: DRAFTS.term, runDate: RUN_DATE }),
    refuses
  );
});

test('a run date that is not a calendar day is refused before any text is built', () => {
  for (const runDate of ['2026-11-02T07:00:00Z', '02/11/2026', '2026-13-45', '']) {
    assert.throws(
      () => renderEntry({ claim: claimOf('term'), draft: DRAFTS.term, runDate }),
      (error) => error instanceof WriterError && /runDate/.test(error.message)
    );
  }
});
