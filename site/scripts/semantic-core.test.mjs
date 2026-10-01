import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import {
  ABSENCE_CLAIMS,
  FAMILY_GRAMMAR,
  GENERATED_BEGIN,
  GENERATED_END,
  absenceFindings,
  docDriftFindings,
  duplicateQueryFindings,
  familyFor,
  mustWinFindings,
  orphanFindings,
  parseBuyerPrompts,
  passageFindings,
  readRouteHtml,
  renderFamilies,
  spliceGenerated,
  titleFindings,
} from './semantic-core.mjs';

test('route shape decides which semantic family a route belongs to', () => {
  assert.equal(familyFor('/blog/category/governance'), 'blog-category');
  assert.equal(familyFor('/blog/why-your-ai-pilot-never-reached-production'), 'article');
  assert.equal(familyFor('/blog'), 'static');
  assert.equal(familyFor('/blog/tags'), 'tag-index');
  assert.equal(familyFor('/blog/tag/shadow-ai'), 'tag');
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

test('two routes claiming one query, differing only in case or spacing, are both reported', () => {
  const findings = duplicateQueryFindings({
    '/glossary/ai-register': 'ai register',
    '/blog/tag/ai-register': 'AI  Register ',
    '/blog/tag/ai-pilots': 'ai pilots',
  });

  assert.deepEqual(
    findings.map((finding) => finding.route),
    ['/glossary/ai-register', '/blog/tag/ai-register']
  );
  assert.ok(findings.every((finding) => finding.rule === 'duplicate-query'));
  assert.match(findings[0].detail, /\/blog\/tag\/ai-register/);
});

test('distinct queries produce no duplicate finding', () => {
  assert.deepEqual(duplicateQueryFindings({ '/a': 'ai register', '/b': 'ai register posts' }), []);
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

const GENERATED_DOC = [
  '# Semantic core',
  '',
  GENERATED_BEGIN,
  '### static (1)',
  '',
  '| Route | Query | Title | Description | H1 | Links | Opening |',
  '|---|---|---|---|---|---|---|',
  '| `/` | fractional chief ai officer | Fractional Chief AI Officer — meshin.co | one line. | Home | 5 | ✓ |',
  GENERATED_END,
].join('\n');

const FRESH_BLOCK = [
  '### static (1)',
  '',
  '| Route | Query | Title | Description | H1 | Links | Opening |',
  '|---|---|---|---|---|---|---|',
  '| `/` | fractional chief ai officer | Fractional Chief AI Officer — meshin.co | one line. | Home | 5 | ✓ |',
].join('\n');

test('a doc whose generated block matches the fresh render has no drift findings', () => {
  assert.deepEqual(docDriftFindings(GENERATED_DOC, FRESH_BLOCK), []);
});

test('a hand-edited generated cell is reported as drift, naming the route', () => {
  const stale = GENERATED_DOC.replace('one line.', 'STALE HAND-EDITED LINE.');

  const findings = docDriftFindings(stale, FRESH_BLOCK);

  assert.deepEqual(
    findings.map((finding) => finding.rule),
    ['doc-drift']
  );
  assert.equal(findings[0].route, '/');
});

test('a route missing from the committed doc but present in the fresh render is reported as drift', () => {
  const freshWithExtra = `${FRESH_BLOCK}\n| \`/pricing\` | cost | Pricing — meshin.co | desc. | Pricing | 5 | ✓ |`;

  const findings = docDriftFindings(GENERATED_DOC, freshWithExtra);

  assert.deepEqual(
    findings.map((finding) => finding.route),
    ['/pricing']
  );
});

test('doc drift throws loudly instead of silently passing when markers are missing', () => {
  assert.throws(() => docDriftFindings('# Semantic core\n\nno markers here', FRESH_BLOCK), /markers missing/);
});

const FULL_GENERATED_DOC = [
  '# Semantic core',
  '',
  GENERATED_BEGIN,
  '### static (1)',
  '',
  'title `{page name} — meshin.co` · meta: value-proposition clause · body intent: answer the query',
  '',
  '| Route | Query | Title | Description | H1 | Links | Opening |',
  '|---|---|---|---|---|---|---|',
  '| `/` | fractional chief ai officer | Fractional Chief AI Officer — meshin.co | one line. | Home | 5 | ✓ |',
  GENERATED_END,
].join('\n');

const FULL_FRESH_BLOCK = [
  '### static (1)',
  '',
  'title `{page name} — meshin.co` · meta: value-proposition clause · body intent: answer the query',
  '',
  '| Route | Query | Title | Description | H1 | Links | Opening |',
  '|---|---|---|---|---|---|---|',
  '| `/` | fractional chief ai officer | Fractional Chief AI Officer — meshin.co | one line. | Home | 5 | ✓ |',
].join('\n');

test('a hand-edited family heading is reported as drift, even though every route cell still matches', () => {
  const stale = FULL_GENERATED_DOC.replace('### static (1)', '### static (99)');

  const findings = docDriftFindings(stale, FULL_FRESH_BLOCK);

  assert.ok(findings.length > 0, 'a mutated heading must not pass silently');
});

test('a hand-edited grammar line is reported as drift, even though every route cell still matches', () => {
  const stale = FULL_GENERATED_DOC.replace('answer the query', 'STALE HAND-EDITED GRAMMAR');

  const findings = docDriftFindings(stale, FULL_FRESH_BLOCK);

  assert.ok(findings.length > 0, 'a mutated grammar line must not pass silently');
});

test('renaming a route cell is still caught, at exactly two findings, once heading and grammar are untouched', () => {
  const renamed = FULL_FRESH_BLOCK.replace('| `/` |', '| `/renamed` |');

  const findings = docDriftFindings(FULL_GENERATED_DOC, renamed);

  assert.equal(findings.length, 2);
  assert.deepEqual(
    findings.map((finding) => finding.rule),
    ['doc-drift', 'doc-drift']
  );
});

const BUYER_PROMPTS_DOC = [
  '### The 30 buyer prompts (PRD §17.3)',
  [
    '**1. entity prompt**',
    'Must win: `/` (support: `/services/fractional-caio-retainer`).',
    'Passage: "I am the answer." (`/`)',
    'Why: because.',
  ].join('\n'),
  [
    '**2. shared-route prompt**',
    'Must win: `/glossary/eu-ai-act` + `/glossary/provider-vs-deployer`, support `/faq/nist`.',
    'Passage: "A definition sentence." (term definition)',
    'Why: because.',
  ].join('\n'),
  [
    '**16. locale prompt one**',
    '**17. locale prompt two**',
    'Must win: `/about` (intended), support `/`, `/contact`.',
    'Passage: "I am Dmitri." (`/about`)',
    'Why: because.',
    '**GAP (hard for 16):** "Israel" appears on no built page.',
  ].join('\n'),
  ['### GAP register — feeds Phase 6 content plans', '', '| # | Prompt | Gap |'].join('\n'),
].join('\n\n');

test('parseBuyerPrompts extracts must-win routes, dropping support routes', () => {
  const prompts = parseBuyerPrompts(BUYER_PROMPTS_DOC);

  const first = prompts.find((prompt) => prompt.number === 1);
  assert.deepEqual(first.mustWinRoutes, ['/']);
  assert.deepEqual(first.passages, [{ text: 'I am the answer.', route: '/' }]);
});

test('parseBuyerPrompts keeps every route joined by "+" as a must-win route', () => {
  const prompts = parseBuyerPrompts(BUYER_PROMPTS_DOC);

  const second = prompts.find((prompt) => prompt.number === 2);
  assert.deepEqual(second.mustWinRoutes, ['/glossary/eu-ai-act', '/glossary/provider-vs-deployer']);
});

test("parseBuyerPrompts binds a bare-quote passage to the prompt's must-win route", () => {
  const prompts = parseBuyerPrompts(BUYER_PROMPTS_DOC);

  const second = prompts.find((prompt) => prompt.number === 2);
  assert.deepEqual(second.passages, [{ text: 'A definition sentence.', route: '/glossary/eu-ai-act' }]);
});

test('parseBuyerPrompts applies one shared block to every heading number in it', () => {
  const prompts = parseBuyerPrompts(BUYER_PROMPTS_DOC);

  const sixteen = prompts.find((prompt) => prompt.number === 16);
  const seventeen = prompts.find((prompt) => prompt.number === 17);
  assert.deepEqual(sixteen.mustWinRoutes, ['/about']);
  assert.deepEqual(seventeen.mustWinRoutes, ['/about']);
});

test('mustWinFindings reports a must-win route that was never built', () => {
  const prompts = [{ number: 9, mustWinRoutes: ['/blog/missing'], passages: [] }];

  const findings = mustWinFindings(prompts, ['/', '/pricing']);

  assert.deepEqual(
    findings.map((finding) => [finding.route, finding.rule]),
    [['/blog/missing', 'buyer-prompt-must-win-missing']]
  );
});

test('mustWinFindings is silent when every must-win route is built', () => {
  const prompts = [{ number: 9, mustWinRoutes: ['/pricing'], passages: [] }];

  assert.deepEqual(mustWinFindings(prompts, ['/', '/pricing']), []);
});

test('passageFindings reports a quoted passage no longer present on its route', () => {
  const prompts = [{ number: 1, mustWinRoutes: ['/'], passages: [{ text: 'the exact sentence', route: '/' }] }];
  const pages = [{ route: '/', text: 'a page that says something else entirely' }];

  const findings = passageFindings(prompts, pages);

  assert.deepEqual(
    findings.map((finding) => [finding.route, finding.rule]),
    [['/', 'buyer-prompt-passage-missing']]
  );
});

test('passageFindings is silent when the passage is still a literal substring of the page', () => {
  const prompts = [{ number: 1, mustWinRoutes: ['/'], passages: [{ text: 'the exact sentence', route: '/' }] }];
  const pages = [{ route: '/', text: 'a page that has the exact sentence right here' }];

  assert.deepEqual(passageFindings(prompts, pages), []);
});

test('absenceFindings flags a GAP claim once the claimed absent term is found on a page', () => {
  const pages = [{ route: '/about', text: 'Based in Israel, remote worldwide.' }];

  const findings = absenceFindings(pages, ABSENCE_CLAIMS);

  assert.deepEqual(
    findings.map((finding) => [finding.route, finding.rule]),
    [['/about', 'gap-claim-stale']]
  );
});

test('absenceFindings is silent while the claimed absent term stays absent', () => {
  const pages = [{ route: '/about', text: 'Remote worldwide.' }];

  assert.deepEqual(absenceFindings(pages, ABSENCE_CLAIMS), []);
});

const withDist = async (files, check) => {
  const dist = await mkdtemp(join(tmpdir(), 'semantic-core-'));
  try {
    for (const [file, html] of Object.entries(files)) {
      await mkdir(dirname(join(dist, file)), { recursive: true });
      await writeFile(join(dist, file), html);
    }
    await check(dist);
  } finally {
    await rm(dist, { recursive: true, force: true });
  }
};

test('readRouteHtml reads the flat file for home, a one-segment route and a two-segment route', async () => {
  await withDist({ 'index.html': 'home', 'about.html': 'about', 'blog/post.html': 'post' }, async (dist) => {
    assert.equal(await readRouteHtml(dist, '/'), 'home');
    assert.equal(await readRouteHtml(dist, '/about'), 'about');
    assert.equal(await readRouteHtml(dist, '/blog/post'), 'post');
  });
});

test('readRouteHtml does not fall back to a nested index file and names the missing route', async () => {
  await withDist({ 'about/index.html': 'nested' }, async (dist) => {
    await assert.rejects(readRouteHtml(dist, '/about'), /semantic-core: no built html for route \/about/);
  });
});
