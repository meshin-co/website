import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  graph,
  orgNode,
  personNode,
  websiteNode,
  serviceNode,
  postNode,
  faqNode,
  breadcrumbNode,
  termNode,
  speakingListNode,
} from './jsonld.mjs';

const SITE = 'https://meshin.co';

test('every node in a graph carries a unique @id and the graph is a single JSON-LD document', () => {
  const document = graph([orgNode(SITE), personNode(SITE), websiteNode(SITE)]);
  assert.equal(document['@context'], 'https://schema.org');
  const ids = document['@graph'].map((node) => node['@id']);
  assert.deepEqual(ids, [`${SITE}/#org`, `${SITE}/#person`, `${SITE}/#website`]);
  assert.equal(new Set(ids).size, ids.length);
});

test('references between nodes point at ids that exist in the same graph', () => {
  const document = graph([orgNode(SITE), personNode(SITE)]);
  const ids = new Set(document['@graph'].map((node) => node['@id']));
  assert.ok(ids.has(document['@graph'][0].founder['@id']));
  assert.ok(ids.has(document['@graph'][1].worksFor['@id']));
});

test('a service node prices the offer instead of putting a number in the name', () => {
  const node = serviceNode(SITE, {
    id: 'ai-readiness-and-risk-assessment',
    name: 'AI Readiness & Risk Assessment',
    description: 'Two weeks.',
    price: { amount: 5000, currency: 'USD', unit: 'fixed' },
  });
  assert.equal(node['@id'], `${SITE}/services/ai-readiness-and-risk-assessment#service`);
  assert.equal(node.offers.priceSpecification.price, 5000);
  assert.equal(node.offers.priceSpecification.priceCurrency, 'USD');
  assert.equal(node.provider['@id'], `${SITE}/#org`);
});

test('a post node dates both publication and modification and cites its sources', () => {
  const node = postNode(SITE, {
    id: 'why-pilots-stall',
    title: 'Why pilots stall',
    description: 'Short.',
    publishDate: new Date('2026-09-01T00:00:00Z'),
    updatedDate: new Date('2026-09-05T00:00:00Z'),
    sources: [{ title: 'NIST AI RMF', url: 'https://www.nist.gov/itl/ai-risk-management-framework' }],
  });
  assert.equal(node['@type'], 'BlogPosting');
  assert.equal(node.datePublished, '2026-09-01');
  assert.equal(node.dateModified, '2026-09-05');
  assert.equal(node.citation.length, 1);
  assert.equal(node.author['@id'], `${SITE}/#person`);
});

test('the website node exposes site search as a potential action', () => {
  const node = websiteNode(SITE);
  assert.equal(node.potentialAction['@type'], 'SearchAction');
  assert.match(node.potentialAction['query-input'], /search_term_string/);
});

test('faq and breadcrumb nodes keep the order they were given', () => {
  const faq = faqNode([
    { q: 'One?', a: 'First.' },
    { q: 'Two?', a: 'Second.' },
  ]);
  assert.deepEqual(
    faq.mainEntity.map((entry) => entry.name),
    ['One?', 'Two?']
  );
  const crumbs = breadcrumbNode(SITE, [
    { name: 'Home', path: '/' },
    { name: 'Glossary', path: '/glossary' },
  ]);
  assert.deepEqual(
    crumbs.itemListElement.map((entry) => entry.position),
    [1, 2]
  );
  assert.equal(crumbs.itemListElement[1].item, `${SITE}/glossary`);
});

test('a glossary term belongs to the site term set', () => {
  const node = termNode(SITE, { id: 'ai-register', term: 'AI register', shortDefinition: 'A list.' });
  assert.equal(node['@type'], 'DefinedTerm');
  assert.equal(node.inDefinedTermSet['@id'], `${SITE}/glossary#termset`);
});

test('a whole page graph has no reference pointing outside itself', () => {
  const document = graph([
    orgNode(SITE),
    personNode(SITE),
    websiteNode(SITE),
    serviceNode(SITE, {
      id: 'x',
      name: 'X',
      description: 'Y',
      price: { amount: 1, currency: 'USD', unit: 'from' },
    }),
    breadcrumbNode(SITE, [{ name: 'Home', path: '/' }]),
  ]);
  const ids = new Set(document['@graph'].map((node) => node['@id']).filter(Boolean));
  const dangling = [];
  const walk = (value) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== 'object') return;
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === '@id' && !ids.has(value['@id'])) dangling.push(value['@id']);
    Object.values(value).forEach(walk);
  };
  walk(document['@graph']);
  assert.deepEqual(dangling, []);
});

test('a speaking list is an ItemList of events that point at the person', () => {
  const node = speakingListNode(SITE, [{ title: 'Talk', event: 'Meetup', date: new Date('2026-06-11'), type: 'talk' }]);
  assert.equal(node['@type'], 'ItemList');
  assert.equal(node.itemListElement[0].position, 1);
  assert.equal(node.itemListElement[0].item['@type'], 'Event');
  assert.equal(node.itemListElement[0].item.performer['@id'], `${SITE}/#person`);
});
