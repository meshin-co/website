import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  FAMILY_GRAMMAR,
  GENERATED_BEGIN,
  GENERATED_END,
  familyFor,
  orphanFindings,
  renderFamilies,
  spliceGenerated,
  titleFindings,
} from './semantic-core.mjs';

test('route shape decides which semantic family a route belongs to', () => {
  assert.equal(familyFor('/blog/category/governance'), 'blog-category');
  assert.equal(familyFor('/blog/why-your-ai-pilot-never-reached-production'), 'article');
  assert.equal(familyFor('/blog'), 'static');
  assert.equal(familyFor('/services/90-day-production-sprint'), 'service');
  assert.equal(familyFor('/resources/ai-governance-starter-kit'), 'resource');
  assert.equal(familyFor('/case-studies/only-help-agentic-support'), 'case-study');
  assert.equal(familyFor('/glossary/ai-register'), 'term');
  assert.equal(familyFor('/faq/how-do-you-charge-for-the-work'), 'faq-answer');
  assert.equal(familyFor('/pricing'), 'static');
});

test('titles that follow every family pattern produce no findings', () => {
  const rows = [
    { route: '/', title: 'Fractional Chief AI Officer — meshin.co' },
    { route: '/pricing', title: 'Pricing — meshin.co' },
    {
      route: '/blog/evals-in-ci-for-llm-agents',
      title: 'Evals in CI for LLM agents, without a golden answer — meshin.co',
    },
    { route: '/services/90-day-production-sprint', title: '90-Day Production Sprint — meshin.co' },
    { route: '/glossary/ai-register', title: 'What is an AI register? — meshin.co' },
    { route: '/glossary/evals', title: 'What are evals? — meshin.co' },
    { route: '/faq/how-do-you-charge-for-the-work', title: 'How do you charge for the work? — meshin.co' },
    {
      route: '/faq/what-does-the-two-week-assessment-produce',
      title: 'What does the two-week Assessment produce, and is the fee… — meshin.co',
    },
  ];

  assert.deepEqual(titleFindings(rows), []);
});

test('a glossary title that is not a question fails the term stem rule', () => {
  const findings = titleFindings([{ route: '/glossary/ai-register', title: 'AI register — meshin.co' }]);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, 'title-stem');
  assert.equal(findings[0].route, '/glossary/ai-register');
});

test('a title with the wrong suffix or no title at all fails', () => {
  const findings = titleFindings([
    { route: '/pricing', title: 'Pricing | meshin.co' },
    { route: '/now', title: '' },
  ]);

  assert.deepEqual(
    findings.map((finding) => finding.rule),
    ['title-suffix', 'title-missing']
  );
});

test('a faq title that is neither question nor truncation fails the stem rule', () => {
  const findings = titleFindings([{ route: '/faq/how-it-works', title: 'How it works — meshin.co' }]);

  assert.equal(findings[0].rule, 'title-stem');
});

test('facts rows without a built route and built routes without a facts row are both orphans', () => {
  const findings = orphanFindings(['/', '/pricing', '/blog/a', '/blog/orphan'], ['/', '/pricing', '/blog/a', '/gone']);

  assert.deepEqual(
    findings.map((finding) => finding.rule),
    ['query-without-route', 'route-without-query']
  );
  assert.equal(findings[0].route, '/gone');
  assert.equal(findings[1].route, '/blog/orphan');
});

test('a fully aligned facts and route set has no orphans', () => {
  assert.deepEqual(orphanFindings(['/', '/pricing'], ['/', '/pricing']), []);
});

test('renderFamilies emits one table per family with its grammar and every column', () => {
  const rows = [
    {
      route: '/glossary/ai-register',
      family: 'term',
      query: 'ai register',
      title: 'What is an AI register? — meshin.co',
      description: 'An AI register is a company inventory.',
      h1: 'AI register',
      links: 4,
      opening: '✓',
    },
    {
      route: '/pricing',
      family: 'static',
      query: 'fractional chief ai officer cost',
      title: 'Pricing — meshin.co',
      description: 'Three fixed structures, no hourly billing.',
      h1: 'Pricing',
      links: 9,
      opening: '✓',
    },
  ];

  const markdown = renderFamilies(rows);

  assert.match(markdown, /### term \(1\)/);
  assert.match(markdown, /### static \(1\)/);
  assert.ok(markdown.includes(`\`${FAMILY_GRAMMAR.term.pattern}\``));
  assert.match(markdown, /\| `\/glossary\/ai-register` \| ai register \|/);
  assert.match(markdown, /\| `\/pricing` \| fractional chief ai officer cost \|/);
  assert.match(markdown, /body intent: \w/);
});

test('splicing the generated block keeps markers and hand-authored text intact', () => {
  const doc = [
    '# Semantic core',
    '',
    'HAND: why the semantic core exists.',
    '',
    GENERATED_BEGIN,
    'stale generated content',
    GENERATED_END,
    '',
    'HAND: buyer prompt mapping below.',
  ].join('\n');

  const spliced = spliceGenerated(doc, 'fresh generated content');

  assert.ok(spliced.includes(GENERATED_BEGIN));
  assert.ok(spliced.includes(GENERATED_END));
  assert.ok(spliced.includes('HAND: why the semantic core exists.'));
  assert.ok(spliced.includes('HAND: buyer prompt mapping below.'));
  assert.ok(!spliced.includes('stale generated content'));
  assert.ok(spliced.includes('fresh generated content'));
});

test('regenerating an already generated doc is idempotent', () => {
  const doc = `# Semantic core\n\n${GENERATED_BEGIN}\nold\n${GENERATED_END}\n\nHAND stays.`;

  assert.equal(spliceGenerated(spliceGenerated(doc, 'block'), 'block'), spliceGenerated(doc, 'block'));
});

test('splicing a doc without markers fails loudly instead of silently appending', () => {
  assert.throws(() => spliceGenerated('# Semantic core\n\nno markers here', 'block'), /markers missing/);
});
