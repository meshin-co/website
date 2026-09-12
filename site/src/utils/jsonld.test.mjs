import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  graph,
  orgNode,
  personNode,
  websiteNode,
  serviceNode,
  postNode,
  resourceNode,
  faqNode,
  faqPageNode,
  breadcrumbNode,
  termNode,
  termSetNode,
  collectionNode,
  contactPageNode,
  profilePageNode,
  webPageNode,
  speakingListNode,
} from './jsonld.mjs';

const SITE = 'https://meshin.co';

const danglingOf = (document) => {
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
  return dangling;
};

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

test('a service node links the offer without publishing a price', () => {
  const node = serviceNode(SITE, {
    id: 'ai-readiness-and-risk-assessment',
    name: 'AI Readiness & Risk Assessment',
    description: 'Two weeks.',
  });
  assert.equal(node['@id'], `${SITE}/services/ai-readiness-and-risk-assessment#service`);
  assert.equal(node.offers.url, `${SITE}/services/ai-readiness-and-risk-assessment`);
  assert.equal(node.offers.priceSpecification, undefined);
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
    }),
    breadcrumbNode(SITE, [{ name: 'Home', path: '/' }]),
  ]);
  assert.deepEqual(danglingOf(document), []);
});

test('a speaking list is an ItemList of events that point at the person', () => {
  const node = speakingListNode(SITE, [{ title: 'Talk', event: 'Meetup', date: new Date('2026-06-11'), type: 'talk' }]);
  assert.equal(node['@type'], 'ItemList');
  assert.equal(node.itemListElement[0].position, 1);
  assert.equal(node.itemListElement[0].item['@type'], 'Event');
  assert.equal(node.itemListElement[0].item.performer['@id'], `${SITE}/#person`);
});

test('the org node carries a logo and image at the default og endpoint', () => {
  const node = orgNode(SITE);
  assert.equal(node.logo, `${SITE}/og/default.png`);
  assert.equal(node.image, `${SITE}/og/default.png`);
});

test('the org logo url is overridable for the committed static asset', () => {
  const node = orgNode(SITE, { logoPath: '/_astro/og-default.ab12cd.jpg' });
  assert.equal(node.logo, `${SITE}/_astro/og-default.ab12cd.jpg`);
  assert.equal(node.image, `${SITE}/_astro/og-default.ab12cd.jpg`);
});

test('person and org sameAs keep the github entity split', () => {
  const person = personNode(SITE);
  const org = orgNode(SITE);
  assert.ok(person.sameAs.includes('https://github.com/meshin-dev'));
  assert.ok(!person.sameAs.includes('https://github.com/meshin-co'));
  assert.ok(org.sameAs.includes('https://github.com/meshin-co'));
  assert.ok(!org.sameAs.includes('https://github.com/meshin-dev'));
});

test('a post node carries image, language, word count and its webpage', () => {
  const node = postNode(SITE, {
    id: 'why-pilots-stall',
    title: 'Why pilots stall',
    description: 'Short.',
    publishDate: new Date('2026-09-01T00:00:00Z'),
    updatedDate: new Date('2026-09-05T00:00:00Z'),
    wordCount: 1200,
  });
  assert.equal(node.image, `${SITE}/og/post/why-pilots-stall.png`);
  assert.equal(node.inLanguage, 'en');
  assert.equal(node.wordCount, 1200);
  assert.deepEqual(node.mainEntityOfPage, { '@id': `${SITE}/blog/why-pilots-stall#webpage` });
});

test('a post node omits wordCount when no count was passed', () => {
  const node = postNode(SITE, {
    id: 'x',
    title: 'T',
    description: 'D',
    publishDate: new Date('2026-09-01T00:00:00Z'),
    updatedDate: new Date('2026-09-05T00:00:00Z'),
  });
  assert.equal(node.wordCount, undefined);
});

test('a post page graph resolves mainEntityOfPage through the webpage node', () => {
  const document = graph([
    postNode(SITE, {
      id: 'why-pilots-stall',
      title: 'Why pilots stall',
      description: 'Short.',
      publishDate: new Date('2026-09-01T00:00:00Z'),
      updatedDate: new Date('2026-09-05T00:00:00Z'),
    }),
    webPageNode(SITE, '/blog/why-pilots-stall'),
  ]);
  const ids = new Set(document['@graph'].map((node) => node['@id']));
  assert.ok(ids.has(document['@graph'][0].mainEntityOfPage['@id']));
});

test('a collection node lists its items as positioned list entries', () => {
  const node = collectionNode(SITE, {
    path: '/faq',
    name: 'FAQ',
    description: 'Answers.',
    items: [{ url: '/faq/what-is-ai-governance' }, { url: '/faq/what-is-an-ai-register' }],
  });
  assert.deepEqual(
    node.itemListElement.map((entry) => [entry['@type'], entry.position, entry.url]),
    [
      ['ListItem', 1, `${SITE}/faq/what-is-ai-governance`],
      ['ListItem', 2, `${SITE}/faq/what-is-an-ai-register`],
    ]
  );
});

test('a collection node without items stays a plain page node', () => {
  const node = collectionNode(SITE, { path: '/blog', name: 'Writing', description: 'Posts.' });
  assert.equal(node['@type'], 'CollectionPage');
  assert.equal(node.itemListElement, undefined);
});

test('an faq page node wraps exactly one question with stable ids', () => {
  const node = faqPageNode(SITE, {
    id: 'what-is-ai-governance',
    question: 'What is AI governance?',
    answer: 'The system of controls.',
    url: '/faq/what-is-ai-governance',
  });
  assert.equal(node['@type'], 'FAQPage');
  assert.equal(node['@id'], `${SITE}/faq/what-is-ai-governance#faqpage`);
  assert.equal(node.url, `${SITE}/faq/what-is-ai-governance`);
  assert.equal(node.mainEntity['@type'], 'Question');
  assert.equal(node.mainEntity['@id'], `${SITE}/faq/what-is-ai-governance#question`);
  assert.equal(node.mainEntity.name, 'What is AI governance?');
  assert.equal(node.mainEntity.acceptedAnswer['@type'], 'Answer');
  assert.equal(node.mainEntity.acceptedAnswer['@id'], `${SITE}/faq/what-is-ai-governance#answer`);
  assert.equal(node.mainEntity.acceptedAnswer.text, 'The system of controls.');
});

test('an faq page node derives its path from the id when no url is given', () => {
  const node = faqPageNode(SITE, { id: 'what-is-shadow-ai', question: 'Q?', answer: 'A.' });
  assert.equal(node.url, `${SITE}/faq/what-is-shadow-ai`);
  assert.equal(node.mainEntity['@id'], `${SITE}/faq/what-is-shadow-ai#question`);
});

test('contact and profile pages reference their main entity', () => {
  const contact = contactPageNode(SITE);
  assert.equal(contact['@type'], 'ContactPage');
  assert.equal(contact['@id'], `${SITE}/contact#page`);
  assert.equal(contact.url, `${SITE}/contact`);
  assert.equal(contact.name, 'Contact');
  assert.deepEqual(contact.mainEntity, { '@id': `${SITE}/#org` });

  const profile = profilePageNode(SITE);
  assert.equal(profile['@type'], 'ProfilePage');
  assert.equal(profile.name, 'About');
  assert.deepEqual(profile.mainEntity, { '@id': `${SITE}/#person` });
});

test('a resource node publishes and modifies only on dates it was given', () => {
  const withDates = resourceNode(SITE, {
    id: 'ai-governance-starter-kit',
    name: 'Kit',
    description: 'D.',
    publishDate: new Date('2026-08-01T00:00:00Z'),
    updatedDate: new Date('2026-09-01T00:00:00Z'),
    license: 'MIT',
    version: '1.0.0',
  });
  assert.equal(withDates.datePublished, '2026-08-01');
  assert.equal(withDates.dateModified, '2026-09-01');

  const undated = resourceNode(SITE, { id: 'x', name: 'N', description: 'D.' });
  assert.equal(undated.datePublished, undefined);
  assert.equal(undated.dateModified, undefined);
});

test('a webpage node owns the webpage id convention and an optional modification date', () => {
  const bare = webPageNode(SITE, '/blog/why-pilots-stall');
  assert.equal(bare['@type'], 'WebPage');
  assert.equal(bare['@id'], `${SITE}/blog/why-pilots-stall#webpage`);
  assert.equal(bare.url, `${SITE}/blog/why-pilots-stall`);
  assert.equal(bare.dateModified, undefined);

  const dated = webPageNode(SITE, '/about', new Date('2026-09-10T00:00:00Z'));
  assert.equal(dated['@id'], `${SITE}/about#webpage`);
  assert.equal(dated.dateModified, '2026-09-10');
});

test('a term set lists every term it is given and stays a stub without any', () => {
  const full = termSetNode(SITE, [{ id: 'ai-register' }, { id: 'dpia' }]);
  assert.deepEqual(full.hasDefinedTerm, [
    { '@id': `${SITE}/glossary/ai-register#term` },
    { '@id': `${SITE}/glossary/dpia#term` },
  ]);

  const stub = termSetNode(SITE);
  assert.equal(stub['@type'], 'DefinedTermSet');
  assert.equal(stub['@id'], `${SITE}/glossary#termset`);
  assert.equal(stub.hasDefinedTerm, undefined);
});

test('a post node re-based for case studies moves its ids, url and image', () => {
  const node = postNode(
    SITE,
    {
      id: 'only-help',
      title: 'only.help',
      description: 'D.',
      publishDate: new Date('2026-08-01T00:00:00Z'),
      updatedDate: new Date('2026-09-01T00:00:00Z'),
    },
    { basePath: '/case-studies', ogCollection: 'case' }
  );
  assert.equal(node['@id'], `${SITE}/case-studies/only-help#post`);
  assert.equal(node.url, `${SITE}/case-studies/only-help`);
  assert.equal(node.image, `${SITE}/og/case/only-help.png`);
  assert.deepEqual(node.mainEntityOfPage, { '@id': `${SITE}/case-studies/only-help#webpage` });
});

test('a case study page graph resolves mainEntityOfPage through its own webpage node', () => {
  const document = graph([
    postNode(
      SITE,
      {
        id: 'only-help',
        title: 'T',
        description: 'D.',
        publishDate: new Date('2026-08-01T00:00:00Z'),
        updatedDate: new Date('2026-09-01T00:00:00Z'),
      },
      { basePath: '/case-studies', ogCollection: 'case' }
    ),
    webPageNode(SITE, '/case-studies/only-help', new Date('2026-09-01T00:00:00Z')),
  ]);
  const ids = new Set(document['@graph'].map((node) => node['@id']));
  assert.ok(ids.has(document['@graph'][0].mainEntityOfPage['@id']));
});

test('a webpage node names itself for undated pages and never invents a date', () => {
  const named = webPageNode(SITE, '/approach', null, 'How I work');
  assert.equal(named.name, 'How I work');
  assert.equal(named.dateModified, undefined);
  const unnamed = webPageNode(SITE, '/now');
  assert.equal(unnamed.name, undefined);
});

test('a composed hub graph resolves every reference it emits', () => {
  const document = graph([
    orgNode(SITE),
    personNode(SITE),
    websiteNode(SITE),
    collectionNode(SITE, {
      path: '/blog',
      name: 'Writing',
      description: 'D.',
      items: [{ url: '/blog/why-pilots-stall' }, { url: '/blog/agent-evals-ci' }],
    }),
    breadcrumbNode(SITE, [
      { name: 'Home', path: '/' },
      { name: 'Writing', path: '/blog' },
    ]),
  ]);
  assert.deepEqual(danglingOf(document), []);
});

test('a composed term page graph keeps the term set whole without dangling terms', () => {
  const terms = [
    { id: 'evals', term: 'Evals', shortDefinition: 'Repeatable tests.' },
    { id: 'shadow-ai', term: 'Shadow AI', shortDefinition: 'Unapproved tools.' },
    { id: 'llm-gateway', term: 'LLM gateway', shortDefinition: 'One chokepoint.' },
  ];
  const document = graph([
    orgNode(SITE),
    personNode(SITE),
    termSetNode(SITE, terms),
    ...terms.map((term) => termNode(SITE, term)),
    breadcrumbNode(SITE, [{ name: 'Home', path: '/' }]),
  ]);
  assert.deepEqual(danglingOf(document), []);
});

test('a composed undated page graph resolves its webpage into the website', () => {
  const document = graph([
    orgNode(SITE),
    personNode(SITE),
    websiteNode(SITE),
    webPageNode(SITE, '/approach', null, 'How I work'),
    breadcrumbNode(SITE, [
      { name: 'Home', path: '/' },
      { name: 'Approach', path: '/approach' },
    ]),
  ]);
  assert.deepEqual(danglingOf(document), []);
});
