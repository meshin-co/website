import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildIndexEntry } from '../public/search/index-model.mjs';
import { ENTRY_TEXT_CAPS, KINDS, buildShardEntry, summaryLine } from '../public/search/shards.mjs';

test('an index entry keeps only what search needs, with collapsed whitespace', () => {
  const entry = buildIndexEntry({
    href: '/glossary/evals/',
    title: 'Evals',
    description: 'A test   suite\nfor a model.',
    kind: 'Glossary',
    body: '## Heading\n\nAn *eval* set measures  answers.\n',
  });

  assert.deepEqual(entry, {
    href: '/glossary/evals',
    title: 'Evals',
    description: 'A test suite for a model.',
    kind: 'Glossary',
    text: 'Heading An eval set measures answers.',
  });
});

test('the index knows exactly eight kinds, each with a display label', () => {
  assert.deepEqual(Object.keys(KINDS), ['post', 'glossary', 'resource', 'service', 'case', 'faq', 'spec', 'page']);
  assert.deepEqual(
    Object.values(KINDS).map(({ label }) => label),
    ['Writing', 'Glossary', 'Resource', 'Service', 'Case study', 'Answer', 'Specification', 'Page']
  );
});

test('a specification entry indexes its title, description and body, and is cut at the cap of its own kind', () => {
  const entry = buildShardEntry('spec', {
    href: '/spec/evals-baseline/1.0',
    title: 'evals-baseline specification 1.0',
    description: 'What the baseline file holds.',
    body: `Normative text. ${'word '.repeat(10_000)}`,
  });

  assert.equal(entry.href, '/spec/evals-baseline/1.0');
  assert.equal(entry.kind, 'Specification');
  assert.ok(entry.text.startsWith('Normative text.'));
  assert.equal(entry.text.length, ENTRY_TEXT_CAPS.spec);
});

test('the summary line names specifications in the singular and the plural', () => {
  assert.equal(summaryLine(['Specification'], 'baseline'), '1 specification matches “baseline”.');
  assert.equal(summaryLine(['Specification', 'Specification'], 'baseline'), '2 specifications match “baseline”.');
});

test('every kind builds an entry of the shared shape with its display label', () => {
  for (const [kind, { label }] of Object.entries(KINDS)) {
    const record =
      kind === 'faq'
        ? { href: `/${kind}/example/`, question: `Example ${kind}`, answer: 'Body words.' }
        : { href: `/${kind}/example/`, title: `Example ${kind}`, description: 'A description.', body: 'Body words.' };
    const entry = buildShardEntry(kind, record);

    assert.equal(entry.href, `/${kind}/example`);
    assert.equal(entry.kind, label);
    assert.equal(entry.title, `Example ${kind}`);
    assert.ok(entry.text.includes('Body words.'));
  }
});

test('a faq entry indexes the question as title and the answer as description and text', () => {
  const entry = buildShardEntry('faq', {
    href: '/faq/how-do-you-charge',
    question: 'How do you charge for the work?',
    answer: 'Three fixed structures: assessment, sprint, retainer.',
  });

  assert.equal(entry.title, 'How do you charge for the work?');
  assert.equal(entry.description, 'Three fixed structures: assessment, sprint, retainer.');
  assert.equal(entry.kind, 'Answer');
  assert.ok(entry.text.includes('How do you charge'));
  assert.ok(entry.text.includes('Three fixed structures'));
});

test('a post entry indexes takeaways, full answer, its own faq block and body', () => {
  const entry = buildShardEntry('post', {
    href: '/blog/a',
    title: 'Why pilots stall',
    description: 'Pilots stall.',
    keyTakeaways: ['One process beats five pilots.'],
    fullAnswer: 'A pilot stalls when nobody owns the outcome.',
    faq: [{ q: 'What is the single most common cause?', a: 'No named owner for the outcome.' }],
    body: 'The rest of the argument, in order.',
  });

  assert.ok(entry.text.startsWith('One process beats five pilots.'));
  assert.ok(entry.text.includes('A pilot stalls when nobody owns the outcome.'));
  assert.ok(entry.text.includes('What is the single most common cause? No named owner for the outcome.'));
  assert.ok(entry.text.includes('The rest of the argument, in order.'));
});

test('a glossary entry indexes the short definition and the full definition', () => {
  const entry = buildShardEntry('glossary', {
    href: '/glossary/evals',
    title: 'What are evals?',
    description: 'Repeatable tests.',
    shortDefinition: 'Evals are repeatable tests that score outputs.',
    definition: 'The comparison that matters is to an ordinary test suite.',
    body: 'Write down twenty to fifty real cases.',
  });

  assert.ok(entry.text.includes('repeatable tests that score outputs'));
  assert.ok(entry.text.includes('ordinary test suite'));
  assert.ok(entry.text.includes('twenty to fifty real cases'));
});

test('a service entry indexes the short answer, deliverables and service faq pairs', () => {
  const entry = buildShardEntry('service', {
    href: '/services/90-day-production-sprint',
    title: '90-Day Production Sprint',
    description: 'One process live.',
    shortAnswer: 'A sprint gets one process running in production and keeps it there.',
    deliverables: ['Evals in CI', 'Tracing and cost per outcome'],
    faq: [{ q: 'What counts as production?', a: 'Real users and a rollback path.' }],
    body: 'Ninety days, one process, in production.',
  });

  assert.ok(entry.text.includes('running in production'));
  assert.ok(entry.text.includes('Evals in CI'));
  assert.ok(entry.text.includes('What counts as production? Real users and a rollback path.'));
  assert.ok(entry.text.includes('Ninety days, one process'));
});

test('a case entry indexes the problem, the approach and the outcome metrics', () => {
  const entry = buildShardEntry('case', {
    href: '/case-studies/inbox-triage',
    title: 'Inbox triage',
    description: 'Support inbox.',
    problem: 'Answers took three days.',
    approach: 'An eval set built from answered tickets.',
    outcome: { metrics: [{ label: 'First response', before: '3 days', after: '4 hours' }] },
    body: 'Why this one first.',
  });

  assert.ok(entry.text.includes('Answers took three days.'));
  assert.ok(entry.text.includes('answered tickets'));
  assert.ok(entry.text.includes('First response 3 days to 4 hours'));
});

test('entry text is capped at its own kind budget, not a shared global one', () => {
  const huge = 'word '.repeat(10_000);
  const post = buildShardEntry('post', { href: '/blog/huge', title: 'Huge', description: 'Big.', body: huge });
  const faq = buildShardEntry('faq', { href: '/faq/huge', question: 'Huge?', answer: huge });

  assert.equal(post.text.length, ENTRY_TEXT_CAPS.post);
  assert.equal(faq.text.length, ENTRY_TEXT_CAPS.faq);
  assert.ok(ENTRY_TEXT_CAPS.post > ENTRY_TEXT_CAPS.faq, 'post budget must exceed the faq budget it is tested against');
});

test('the summary line groups the kind of every match with counts, biggest group first', () => {
  const answers = Array(12).fill('Answer');
  const terms = Array(8).fill('Glossary');
  const articles = Array(3).fill('Writing');

  assert.equal(summaryLine([], 'evals'), 'No pages match “evals”.');
  assert.equal(summaryLine(answers.slice(0, 1), 'evals'), '1 answer matches “evals”.');
  assert.equal(
    summaryLine([...articles, ...terms, ...answers], 'evals'),
    '12 answers · 8 terms · 3 articles match “evals”.'
  );
});
