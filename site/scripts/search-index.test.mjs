import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildIndexEntry, scoreEntry, rankEntries } from '../public/search/index-model.mjs';
import { ENTRY_TEXT_CAP, KINDS, buildShardEntry, shardHref, summaryLine } from '../public/search/shards.mjs';

const ENTRY = {
  href: '/glossary/evals',
  title: 'Evals',
  description: 'A test suite for a model, run in CI.',
  kind: 'Glossary',
  text: 'An eval set measures whether a change made the answers better or only different.',
};

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

test('a title hit outranks a description hit, which outranks a body hit', () => {
  const title = scoreEntry(ENTRY, ['evals']);
  const description = scoreEntry(ENTRY, ['suite']);
  const body = scoreEntry(ENTRY, ['different']);

  assert.ok(title > description, `${title} > ${description}`);
  assert.ok(description > body, `${description} > ${body}`);
});

test('an entry matching none of the words scores zero', () => {
  assert.equal(scoreEntry(ENTRY, ['kubernetes']), 0);
});

test('every word must appear somewhere for the entry to match', () => {
  assert.ok(scoreEntry(ENTRY, ['evals', 'model']) > 0);
  assert.equal(scoreEntry(ENTRY, ['evals', 'kubernetes']), 0);
});

test('matching is case-insensitive and matches word prefixes, not substrings mid-word', () => {
  assert.ok(scoreEntry(ENTRY, ['EVAL']) > 0);
  assert.equal(scoreEntry(ENTRY, ['vals']), 0);
});

test('ranking returns the best entries first and drops non-matches', () => {
  const other = { ...ENTRY, href: '/blog/a', title: 'Why pilots stall', description: 'No evals in CI.', text: 'x' };

  const ranked = rankEntries([other, ENTRY], 'evals');

  assert.deepEqual(
    ranked.map((entry) => entry.href),
    ['/glossary/evals', '/blog/a']
  );
  assert.deepEqual(rankEntries([other, ENTRY], 'kubernetes'), []);
});

test('a query of only punctuation or one letter matches nothing', () => {
  assert.deepEqual(rankEntries([ENTRY], '.'), []);
  assert.deepEqual(rankEntries([ENTRY], 'e'), []);
});

test('there is exactly one shard per kind and shard hrefs follow the shard naming', () => {
  assert.deepEqual(Object.keys(KINDS), ['post', 'glossary', 'resource', 'service', 'case', 'faq', 'page']);
  assert.equal(shardHref('faq'), '/search-index-faq.json');
  assert.equal(shardHref('page'), '/search-index-page.json');
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

test('a post entry indexes takeaways, full answer and body', () => {
  const entry = buildShardEntry('post', {
    href: '/blog/a',
    title: 'Why pilots stall',
    description: 'Pilots stall.',
    keyTakeaways: ['One process beats five pilots.'],
    fullAnswer: 'A pilot stalls when nobody owns the outcome.',
    body: 'The rest of the argument, in order.',
  });

  assert.ok(entry.text.startsWith('One process beats five pilots.'));
  assert.ok(entry.text.includes('A pilot stalls when nobody owns the outcome.'));
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

test('entry text is capped when a body would blow the per-entry cap', () => {
  const entry = buildShardEntry('post', {
    href: '/blog/huge',
    title: 'Huge',
    description: 'Big.',
    body: 'word '.repeat(10_000),
  });

  assert.equal(entry.text.length, ENTRY_TEXT_CAP);
});

test('the summary line groups results by kind with counts, biggest group first', () => {
  const answers = Array.from({ length: 12 }, (_, i) => ({ href: `/faq/q${i}`, kind: 'Answer' }));
  const terms = Array.from({ length: 8 }, (_, i) => ({ href: `/glossary/t${i}`, kind: 'Glossary' }));
  const articles = Array.from({ length: 3 }, (_, i) => ({ href: `/blog/a${i}`, kind: 'Writing' }));

  assert.equal(summaryLine([], 'evals'), 'No pages match “evals”.');
  assert.equal(summaryLine(answers.slice(0, 1), 'evals'), '1 answer matches “evals”.');
  assert.equal(
    summaryLine([...articles, ...terms, ...answers], 'evals'),
    '12 answers · 8 terms · 3 articles match “evals”.'
  );
});
