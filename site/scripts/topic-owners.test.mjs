import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { familyFor } from './semantic-core.mjs';
import { ROUTE_PREFIX, ownerRefusal, readConceptRegister, registerOwner, routeOf, servedBy } from './topic-owners.mjs';

const CORE = [
  '# Semantic core',
  '',
  '<!-- REGISTERS:BEGIN -->',
  '',
  '#### Entity register (2)',
  '',
  '| Entity | Owned by | Mentioned by |',
  '| ------ | -------- | ------------ |',
  '| Shadow AI | `/glossary/shadow-ai` | 3 |',
  '',
  '#### Concept register (6)',
  '',
  'A concept is defined on exactly one page.',
  '',
  '| Concept | Defined by | Definition |',
  '| ------- | ---------- | ---------- |',
  '| AI register | `/glossary/ai-register` | An AI register is an inventory. |',
  '| Evals | `/glossary/evals` | Evals are repeatable tests. |',
  '| ISO/IEC 42001 | `/glossary/iso-iec-42001` | A standard. |',
  '| Model Context Protocol | `/glossary/mcp` | An open protocol. |',
  '| High-risk AI system | `/glossary/high-risk-ai-system` | A system the Act classifies. |',
  '| AI system | `/glossary/ai-system` | Any AI system. |',
  '',
  '<!-- REGISTERS:END -->',
].join('\n');

const concepts = readConceptRegister(CORE);

test('the concept register is read from its table, never from the entity register beside it', () => {
  assert.deepEqual(
    concepts.map(({ concept, route }) => [concept, route]),
    [
      ['AI register', '/glossary/ai-register'],
      ['Evals', '/glossary/evals'],
      ['ISO/IEC 42001', '/glossary/iso-iec-42001'],
      ['Model Context Protocol', '/glossary/mcp'],
      ['High-risk AI system', '/glossary/high-risk-ai-system'],
      ['AI system', '/glossary/ai-system'],
    ]
  );
});

test('a document with no concept register reads as an empty one, and so does a non-document', () => {
  assert.deepEqual(readConceptRegister('# Nothing here\n'), []);
  assert.deepEqual(readConceptRegister(''), []);
  assert.deepEqual(readConceptRegister(undefined), []);
});

test('the committed semantic core carries a concept register this reader finds', () => {
  const real = readConceptRegister(readFileSync(new URL('../../docs/SEMANTIC-CORE.md', import.meta.url), 'utf8'));
  const byName = new Map(real.map(({ concept, route }) => [concept, route]));
  assert.ok(real.length >= 30, 'concepts read: ' + real.length);
  assert.equal(byName.get('Evals'), '/glossary/evals');
  assert.equal(byName.get('AI register'), '/glossary/ai-register');
});

const owner = (text) => registerOwner(concepts, text)?.concept ?? null;

test('a query that is the concept, or names it inside more words, has an owner', () => {
  assert.equal(owner('ai register'), 'AI register');
  assert.equal(owner('how to put evals for ai agents into ci'), 'Evals');
  assert.equal(owner('What Is An AI Register?'), 'AI register');
});

test('case, plural, hyphen and slash do not hide a concept', () => {
  assert.equal(owner('how to keep an eval suite'), 'Evals');
  assert.equal(owner('ai registers for a small company'), 'AI register');
  assert.equal(owner('iso iec 42001 gap assessment'), 'ISO/IEC 42001');
  assert.equal(owner('ISO/IEC 42001 certification'), 'ISO/IEC 42001');
  assert.equal(owner('what is a high risk ai system'), 'High-risk AI system');
});

test('the word of a route slug is a second name for its concept, which is how MCP finds the Model Context Protocol', () => {
  assert.equal(owner('mcp security best practices'), 'Model Context Protocol');
  assert.equal(owner('the model context protocol'), 'Model Context Protocol');
});

test('only whole words count, and the longest concept wins', () => {
  assert.equal(owner('a chai register'), null);
  assert.equal(owner('evaluation of models'), null);
  assert.equal(owner('is this a high-risk ai system'), 'High-risk AI system');
  assert.equal(owner('an ai system we built'), 'AI system');
});

test('a query that names no concept, and an empty query, have no owner', () => {
  assert.equal(owner('why do ai pilots fail to reach production'), null);
  assert.equal(owner(''), null);
  assert.equal(registerOwner([], 'ai register'), null);
});

test('an owner is the concept and the route that defines it', () => {
  assert.deepEqual(registerOwner(concepts, 'evals in ci'), { concept: 'Evals', route: '/glossary/evals' });
});

test('every format has a route prefix that the semantic core maps back to the same format', () => {
  for (const [format, prefix] of Object.entries(ROUTE_PREFIX)) {
    assert.equal(familyFor(prefix + 'a-slug'), format);
    assert.equal(routeOf(format, 'a-slug'), prefix + 'a-slug');
  }
  assert.deepEqual(Object.keys(ROUTE_PREFIX), ['term', 'article']);
});

test('a prompt is served when one of its routes already sits in the format the query asks for', () => {
  const routes = ['/blog/why-your-ai-pilot-never-reached-production', '/faq/how-does-the-retainer-end'];
  assert.equal(servedBy('article', routes), '/blog/why-your-ai-pilot-never-reached-production');
  assert.equal(servedBy('term', routes), null);
  assert.equal(servedBy('term', [...routes, '/glossary/ai-register']), '/glossary/ai-register');
});

test('a route in the faq family serves neither of the two formats the machine writes', () => {
  assert.equal(servedBy('article', ['/faq/how-does-the-retainer-end']), null);
  assert.equal(servedBy('term', ['/faq/how-does-the-retainer-end']), null);
});

test('a prompt with no route, or only a null one, is served by nothing', () => {
  assert.equal(servedBy('article', []), null);
  assert.equal(servedBy('article', [null, undefined]), null);
});

const generated = [
  { family: 'article', route: '/blog/why-do-ai-pilots-fail', title: 'Why do AI pilots fail? — meshin.co' },
  { family: 'term', route: '/glossary/ai-register', title: 'What is an AI register? — meshin.co' },
];

const refusal = (topic, routes = []) => ownerRefusal({ topic, concepts, promptRoutes: routes, generated });
const topicOf = (extra) => ({
  format: 'article',
  slug: 'a-new-slug',
  query: 'a query that names nothing',
  ...extra,
});

test('a query that names a registered concept is refused for the route that already defines it', () => {
  assert.deepEqual(refusal(topicOf({ format: 'article', query: 'how to put evals for ai agents into ci' })), {
    reason: 'register-owner',
    against: '/glossary/evals',
    route: '/glossary/evals',
    detail:
      'the query "how to put evals for ai agents into ci" names the concept "Evals", which the concept register of docs/SEMANTIC-CORE.md assigns to /glossary/evals',
  });
});

test('a prompt already served in its own format is refused for that route', () => {
  assert.deepEqual(refusal(topicOf(), ['/blog/what-does-a-fractional-chief-ai-officer-actually-do']), {
    reason: 'family-served',
    against: '/blog/what-does-a-fractional-chief-ai-officer-actually-do',
    route: '/blog/what-does-a-fractional-chief-ai-officer-actually-do',
    detail:
      'the prompt already lists /blog/what-does-a-fractional-chief-ai-officer-actually-do among its routes and that route is in the article family, so another article would answer the same prompt twice',
  });
});

test('a slug that would publish at a route the generated layer already lists is refused for that route', () => {
  assert.deepEqual(refusal(topicOf({ slug: 'why-do-ai-pilots-fail' })), {
    reason: 'route-exists',
    against: '/blog/why-do-ai-pilots-fail',
    route: '/blog/why-do-ai-pilots-fail',
    detail:
      'the slug "why-do-ai-pilots-fail" would publish at /blog/why-do-ai-pilots-fail, which the generated layer of docs/SEMANTIC-CORE.md already lists',
  });
});

test('a term slug is looked up under the glossary, not under the blog', () => {
  assert.equal(refusal(topicOf({ format: 'term', slug: 'why-do-ai-pilots-fail' })), null);
  assert.equal(refusal(topicOf({ format: 'term', slug: 'ai-register' }))?.route, '/glossary/ai-register');
});

test('the concept register is asked first, then the prompt routes, then the generated layer', () => {
  const everything = topicOf({ slug: 'why-do-ai-pilots-fail', query: 'evals for pilots' });
  assert.equal(refusal(everything, ['/blog/x']).reason, 'register-owner');
  assert.equal(refusal(topicOf({ slug: 'why-do-ai-pilots-fail' }), ['/blog/x']).reason, 'family-served');
  assert.equal(refusal(topicOf({ slug: 'why-do-ai-pilots-fail' })).reason, 'route-exists');
});

test('a candidate nothing owns, serves or already publishes is not refused', () => {
  assert.equal(refusal(topicOf(), ['/faq/what-does-a-fractional-chief-ai-officer-actually-do', '/pricing']), null);
});
