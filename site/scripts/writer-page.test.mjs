import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { extractPage } from './content-html.mjs';
import { pageFromHtml } from './human-gate.mjs';
import { PAGE_TEMPLATES, entryPage } from './writer-page.mjs';

const RUN_DATE = '2026-11-02';

const article = {
  slug: 'how-to-write-a-runbook',
  title: 'How to write a runbook?',
  format: 'article',
};

const articleDraft = {
  format: 'article',
  fields: {
    description: 'A runbook names who is paged.',
    shortAnswer: 'Name one owner first.',
    fullAnswer: 'A runbook is one page. It names an owner.',
    keyTakeaways: ['Name one owner.', 'Write the stop switch down.', 'Rehearse it.'],
    faq: [
      { q: 'Who is paged first?', a: 'The owner.' },
      { q: 'How often do we rehearse?', a: 'Each quarter.' },
    ],
    category: 'governance',
    tags: [],
    relatedResources: [],
  },
  body:
    '## Who is paged?\n\nThe owner, always. See [the register](/glossary/ai-register) and [the source](https://example.org/x).\n\n' +
    '| Role | Task |\n| --- | --- |\n| Owner | Pages the team |\n\n- one item.\n- two items.\n',
  sources: [
    { id: 'S1', title: 'First source', url: 'https://example.org/one', publisher: 'Example' },
    { id: 'S2', title: 'Second source', url: 'https://example.org/two', publisher: '' },
  ],
  claims: [],
  passage: 'The owner, always.',
};

const term = { slug: 'gap-assessment', title: 'What is a gap assessment?', format: 'term' };

const termDraft = {
  format: 'term',
  fields: {
    description: 'A gap assessment compares practice with a standard.',
    shortDefinition: 'A gap assessment compares what you do with what a standard asks.',
    definition: 'First paragraph of the definition.\n\nSecond paragraph of the definition.',
    relatedTerms: ['ai-register'],
  },
  body: '## In short\n\nA body paragraph.\n',
  sources: [{ id: 'S1', title: 'Only source', url: 'https://example.org/one', publisher: '' }],
  claims: [],
  passage: 'A body paragraph.',
};

const pageOf = (claim, draft) => {
  const built = entryPage({ claim, draft, runDate: RUN_DATE });
  return { ...built, content: extractPage(built.route, built.html), human: pageFromHtml(built.route, built.html) };
};

test('an article page has the route, the profile and the one h1 the gate looks for', () => {
  const { route, profile, content } = pageOf(article, articleDraft);
  assert.equal(route, '/blog/how-to-write-a-runbook');
  assert.equal(profile, 'article');
  assert.deepEqual(content.headings.h1, ['How to write a runbook?']);
});

test('the description is the gate lead and the full answer is marked, so neither is a paragraph', () => {
  const { content } = pageOf(article, articleDraft);
  assert.equal(content.lead, 'A runbook names who is paged.');
  assert.ok(!content.paragraphs.includes('A runbook is one page. It names an owner.'));
  assert.ok(content.paragraphs.includes('Name one owner first.'));
  assert.ok(content.paragraphs.includes('The owner, always. See the register and the source.'));
});

test('the opening of an article is the lead, the full answer, then the paragraphs', () => {
  const { content } = pageOf(article, articleDraft);
  assert.ok(
    content.opening.startsWith(
      'A runbook names who is paged. A runbook is one page. It names an owner. Name one owner first.'
    )
  );
});

test('takeaways, tables, links and headings are counted the way the gate counts them', () => {
  const { content } = pageOf(article, articleDraft);
  assert.equal(content.takeaways, 3);
  assert.equal(content.tables, 1);
  assert.deepEqual(content.links.external, [
    'https://example.org/x',
    'https://example.org/one',
    'https://example.org/two',
  ]);
  assert.ok(content.headings.sub.includes('Who is paged?'));
  assert.ok(content.headings.sub.includes('Who is paged first?'));
  assert.ok(content.headings.sub.includes('How often do we rehearse?'));
  assert.equal(content.updated, RUN_DATE);
});

test('an article with no faq entries has no questions section', () => {
  const bare = { ...articleDraft, fields: { ...articleDraft.fields, faq: [] } };
  const { content } = pageOf(article, bare);
  assert.ok(!content.headings.sub.includes('Who is paged first?'));
  assert.ok(!content.text.includes(PAGE_TEMPLATES.article.sections.faq));
});

test('the human gate sees the list items and the table cells as prose and the list lengths as lists', () => {
  const { human } = pageOf(article, articleDraft);
  assert.ok(human.prose.includes('one item. two items.'));
  assert.ok(human.paragraphs.includes('Name one owner first.'));
  assert.deepEqual(human.lists.slice(0, 2), [3, 2]);
});

test('a term page has the term as its h1, no lead, and the definition split into paragraphs', () => {
  const { route, profile, content } = pageOf(term, termDraft);
  assert.equal(route, '/glossary/gap-assessment');
  assert.equal(profile, 'term');
  assert.deepEqual(content.headings.h1, ['gap assessment']);
  assert.equal(content.lead, null);
  assert.deepEqual(content.paragraphs, [
    'A gap assessment compares what you do with what a standard asks.',
    'First paragraph of the definition.',
    'Second paragraph of the definition.',
    'A body paragraph.',
  ]);
  assert.equal(content.updated, RUN_DATE);
  assert.deepEqual(content.links.external, ['https://example.org/one']);
});

test('text the model wrote cannot inject markup into the page', () => {
  const hostile = {
    ...termDraft,
    fields: { ...termDraft.fields, shortDefinition: 'A <script>x()</script> & "quote".' },
  };
  const { content, html } = pageOf(term, hostile);
  assert.ok(!html.includes('<script>'));
  assert.ok(content.paragraphs.includes('A <script>x()</script> & "quote".'));
});

test('a format with no page template is refused', () => {
  assert.throws(
    () => entryPage({ claim: { ...term, format: 'faq-answer' }, draft: termDraft, runDate: RUN_DATE }),
    /faq-answer/
  );
});

const TEMPLATE_FILES = { article: 'src/pages/blog/[id].astro', term: 'src/pages/glossary/[id].astro' };

for (const [format, anchors] of Object.entries({
  article: [
    '<AnswerBlock question={data.title} answer={data.shortAnswer} />',
    'data-gate-lead>{data.fullAnswer}</p>',
    'lead={data.description}',
    '<KeyTakeaways points={data.keyTakeaways} />',
    'question: entry.q, answer: entry.a',
    '<SourceList sources={data.sources} />',
  ],
  term: [
    '<AnswerBlock question={data.title} answer={data.shortDefinition} />',
    'data.definition.split(/\\n{2,}/)',
    'title={data.term}',
    '<SourceList sources={data.sources} />',
  ],
})) {
  test('the ' + format + ' template still places each field where the page model places it', () => {
    const source = readFileSync(new URL('../' + TEMPLATE_FILES[format], import.meta.url), 'utf8');
    for (const anchor of anchors) {
      assert.ok(
        source.includes(anchor),
        'site/' + TEMPLATE_FILES[format] + ' no longer holds the anchor "' + anchor + '"'
      );
    }
    for (const title of Object.values(PAGE_TEMPLATES[format].sections)) {
      assert.ok(
        source.includes('title="' + title + '"'),
        'site/' + TEMPLATE_FILES[format] + ' no longer holds the section title "' + title + '"'
      );
    }
  });
}
