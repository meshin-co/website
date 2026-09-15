import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  entityRegister,
  conceptRegister,
  relationshipPairs,
  undefinedConceptFindings,
  renderRegisters,
  registerDriftFindings,
  prosePassages,
} from './registers.mjs';

const terms = [
  { term: 'AI governance', route: '/glossary/ai-governance', relatedTerms: ['model-risk'], slug: 'ai-governance' },
  { term: 'Model risk', route: '/glossary/model-risk', relatedTerms: [], slug: 'model-risk' },
];

test('each glossary term becomes an entity owned by exactly one route', () => {
  const register = entityRegister(terms, []);
  assert.deepEqual(
    register.map((entry) => [entry.entity, entry.ownedBy]),
    [
      ['AI governance', '/glossary/ai-governance'],
      ['Model risk', '/glossary/model-risk'],
    ]
  );
});

test('an entity records every route that mentions it, so a term with no inbound mentions is visible', () => {
  const register = entityRegister(terms, [
    { route: '/blog/x', text: 'AI governance is the reason this matters.' },
    { route: '/faq/y', text: 'Nothing relevant here.' },
  ]);
  const governance = register.find((entry) => entry.entity === 'AI governance');
  assert.deepEqual(governance.mentionedBy, ['/blog/x']);
  assert.deepEqual(register.find((entry) => entry.entity === 'Model risk').mentionedBy, []);
});

test('the concept register carries the definition and the page that owns it', () => {
  const register = conceptRegister([
    {
      term: 'AI governance',
      slug: 'ai-governance',
      route: '/glossary/ai-governance',
      shortDefinition: 'The accountability layer.',
    },
  ]);
  assert.deepEqual(register, [
    {
      concept: 'AI governance',
      definedBy: '/glossary/ai-governance',
      definition: 'The accountability layer.',
    },
  ]);
});

test('a page using a concept without linking to its definition is a finding, and a linking page is not', () => {
  const findings = undefinedConceptFindings(
    [{ concept: 'AI governance', definedBy: '/glossary/ai-governance', definition: 'x' }],
    [
      { route: '/blog/unlinked', prose: 'AI governance matters here.', hrefs: [] },
      { route: '/blog/linked', prose: 'AI governance matters here.', hrefs: ['/glossary/ai-governance'] },
      { route: '/glossary/ai-governance', prose: 'AI governance is defined here.', hrefs: [] },
    ]
  );
  assert.deepEqual(
    findings.map((finding) => finding.route),
    ['/blog/unlinked']
  );
});

test('relationships come from the data, one row per declared pair', () => {
  assert.deepEqual(relationshipPairs(terms), [{ from: 'AI governance', kind: 'related-concept', to: 'Model risk' }]);
});

test('a relationship naming a term that does not exist is refused rather than rendered', () => {
  assert.throws(
    () => relationshipPairs([{ term: 'A', slug: 'a', route: '/glossary/a', relatedTerms: ['ghost'] }]),
    /ghost/
  );
});

test('the rendered block is deterministic and carries every register', () => {
  const block = renderRegisters({
    entities: entityRegister(terms, []),
    concepts: conceptRegister([
      {
        term: 'AI governance',
        slug: 'ai-governance',
        route: '/glossary/ai-governance',
        shortDefinition: 'The accountability layer.',
      },
    ]),
    relationships: relationshipPairs(terms),
  });
  assert.match(block, /#### Entity register/);
  assert.match(block, /#### Concept register/);
  assert.match(block, /#### Topic relationships/);
  assert.equal(
    block,
    renderRegisters({
      entities: entityRegister(terms, []),
      concepts: conceptRegister([
        {
          term: 'AI governance',
          slug: 'ai-governance',
          route: '/glossary/ai-governance',
          shortDefinition: 'The accountability layer.',
        },
      ]),
      relationships: relationshipPairs(terms),
    })
  );
});

test('a committed doc that no longer matches the freshly generated registers is drift', () => {
  assert.equal(registerDriftFindings('<!-- REGISTERS:BEGIN -->\nold\n<!-- REGISTERS:END -->', 'new').length, 1);
  assert.deepEqual(registerDriftFindings('<!-- REGISTERS:BEGIN -->\nnew\n<!-- REGISTERS:END -->', 'new'), []);
});

test('only body prose counts as using a concept: not json-ld, breadcrumbs, headings or anchor text', () => {
  const concepts = [{ concept: 'AI governance', definedBy: '/glossary/ai-governance', definition: 'x' }];
  const cases = [
    ['json-ld', '<script type="application/ld+json">{"name":"AI governance"}</script>'],
    ['breadcrumb', '<nav aria-label="Breadcrumb"><a href="/blog">Writing</a> AI governance</nav>'],
    ['heading', '<h1>AI governance</h1>'],
    ['anchor text', '<p>Read <a href="/blog/tag/ai-governance">AI governance</a> writing.</p>'],
  ];
  for (const [label, html] of cases) {
    assert.deepEqual(
      undefinedConceptFindings(concepts, [{ route: '/x', prose: prosePassages(html), hrefs: [] }]),
      [],
      label
    );
  }
  assert.equal(
    undefinedConceptFindings(concepts, [
      { route: '/x', prose: prosePassages('<p>AI governance decides who signs off.</p>'), hrefs: [] },
    ]).length,
    1
  );
});

test('a hyphenated slug is not a mention of the term inside it', () => {
  const findings = undefinedConceptFindings(
    [{ concept: 'Evals', definedBy: '/glossary/evals', definition: 'x' }],
    [{ route: '/x', prose: prosePassages('<li>evals-in-ci · ai-governance</li>'), hrefs: [] }]
  );
  assert.deepEqual(findings, []);
});

test('prose passages keep list items, because definitions get used in lists', () => {
  const findings = undefinedConceptFindings(
    [{ concept: 'Shadow AI', definedBy: '/glossary/shadow-ai', definition: 'x' }],
    [{ route: '/x', prose: prosePassages('<li>Shadow AI is already in your org.</li>'), hrefs: [] }]
  );
  assert.equal(findings.length, 1);
});
