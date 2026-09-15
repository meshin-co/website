import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  entityRegister,
  conceptRegister,
  relationshipPairs,
  undefinedConceptFindings,
  renderRegisters,
  registerDriftFindings,
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
      { route: '/blog/unlinked', text: 'AI governance matters here.', hrefs: [] },
      { route: '/blog/linked', text: 'AI governance matters here.', hrefs: ['/glossary/ai-governance'] },
      { route: '/glossary/ai-governance', text: 'AI governance is defined here.', hrefs: [] },
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
