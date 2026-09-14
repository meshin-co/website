import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  graph,
  orgNode,
  personNode,
  websiteNode,
  serviceNode,
  serviceEntityLinks,
  postNode,
  postEntityLinks,
  resourceNode,
  resourceEntityLinks,
  faqNode,
  faqPageNode,
  breadcrumbNode,
  termNode,
  termSetNode,
  collectionNode,
  contactPageNode,
  profilePageNode,
  webPageNode,
  imageObject,
  findGlossaryMentions,
  glossaryStub,
} from './jsonld.mjs';

const SITE = 'https://meshin.co';

const TERMS = [
  { id: 'ai-governance', term: 'AI governance' },
  { id: 'evals', term: 'Evals' },
  { id: 'eu-ai-act', term: 'EU AI Act' },
  { id: 'nist-ai-rmf', term: 'NIST AI RMF' },
];

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
  assert.equal(node.inLanguage, 'en');
});

test('a service node cites its sources and stays silent on entity links without a glossary', () => {
  const node = serviceNode(SITE, {
    id: 'x',
    name: 'X',
    description: 'Y',
    sources: [{ title: 'NIST AI RMF', url: 'https://www.nist.gov/' }],
  });
  assert.equal(node.citation.length, 1);
  assert.equal(node.about, undefined);
  assert.equal(node.mentions, undefined);
});

test('a service node derives about from its pitch fields and mentions from its structured detail', () => {
  const service = {
    id: 'ai-readiness-and-risk-assessment',
    name: 'AI Readiness & Risk Assessment',
    tagline: 'A two-week read of your AI governance posture.',
    description: 'Governance review.',
    forWhom: ['Teams shipping evals in CI.'],
    deliverables: ['A written report on the EU AI Act exposure.'],
  };
  const node = serviceNode(SITE, service, serviceEntityLinks(service, TERMS));
  assert.deepEqual(node.about, [{ '@id': `${SITE}/glossary/ai-governance#term` }]);
  const mentionIds = node.mentions.map((ref) => ref['@id']);
  assert.ok(mentionIds.includes(`${SITE}/glossary/evals#term`));
  assert.ok(mentionIds.includes(`${SITE}/glossary/eu-ai-act#term`));
  assert.ok(!mentionIds.includes(`${SITE}/glossary/ai-governance#term`), 'about ids are not duplicated into mentions');
});

test('a post node dates both publication and modification as full ISO instants and cites its sources', () => {
  const node = postNode(SITE, {
    id: 'why-pilots-stall',
    title: 'Why pilots stall',
    description: 'Short.',
    publishDate: new Date('2026-09-01T00:00:00Z'),
    updatedDate: new Date('2026-09-05T00:00:00Z'),
    sources: [{ title: 'NIST AI RMF', url: 'https://www.nist.gov/itl/ai-risk-management-framework' }],
  });
  assert.equal(node['@type'], 'BlogPosting');
  assert.equal(node.datePublished, '2026-09-01T00:00:00.000Z');
  assert.equal(node.dateModified, '2026-09-05T00:00:00.000Z');
  assert.equal(node.citation.length, 1);
  assert.equal(node.author['@id'], `${SITE}/#person`);
});

test('a post node declares about from tags that name a real glossary term and mentions from its body prose', () => {
  const post = {
    id: 'why-your-ai-pilot-never-reached-production',
    title: 'Why your AI pilot never reached production',
    description: 'Short.',
    publishDate: new Date('2026-09-01T00:00:00Z'),
    updatedDate: new Date('2026-09-01T00:00:00Z'),
    tags: ['ai-pilots', 'ai-governance'],
    body: 'The NIST AI RMF treats this as a governance decision. Evals catch regressions.',
  };
  const node = postNode(SITE, post, postEntityLinks(post, TERMS));
  assert.deepEqual(node.about, [{ '@id': `${SITE}/glossary/ai-governance#term` }]);
  const mentionIds = node.mentions.map((ref) => ref['@id']);
  assert.ok(mentionIds.includes(`${SITE}/glossary/nist-ai-rmf#term`));
  assert.ok(mentionIds.includes(`${SITE}/glossary/evals#term`));
});

test('a post node omits about and mentions when no glossary terms are supplied', () => {
  const node = postNode(SITE, {
    id: 'x',
    title: 'T',
    description: 'D',
    publishDate: new Date('2026-09-01T00:00:00Z'),
    updatedDate: new Date('2026-09-05T00:00:00Z'),
    body: 'Evals in CI.',
  });
  assert.equal(node.about, undefined);
  assert.equal(node.mentions, undefined);
});

test('findGlossaryMentions matches a whole term name once, ignores partial words, and excludes the page itself', () => {
  const found = findGlossaryMentions('Evals run in CI. Evaluation is not the same word.', TERMS, 'evals');
  assert.deepEqual(found, []);
  const matched = findGlossaryMentions('Evals run in CI.', TERMS, 'some-other-post');
  assert.deepEqual(matched, ['evals']);
  assert.deepEqual(findGlossaryMentions('', TERMS), []);
  assert.deepEqual(findGlossaryMentions('Evals.', []), []);
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

test('a glossary term belongs to the site term set, carries its language and cites its sources', () => {
  const node = termNode(SITE, {
    id: 'ai-register',
    term: 'AI register',
    shortDefinition: 'A list.',
    sources: [{ title: 'EU AI Act', url: 'https://eur-lex.europa.eu/' }],
  });
  assert.equal(node['@type'], 'DefinedTerm');
  assert.equal(node.inDefinedTermSet['@id'], `${SITE}/glossary#termset`);
  assert.equal(node.inLanguage, 'en');
  assert.equal(node.citation.length, 1);
});

test('a glossary term mentions only its authored related terms, never itself', () => {
  const node = termNode(SITE, {
    id: 'ai-governance',
    term: 'AI governance',
    shortDefinition: 'D.',
    relatedTerms: [
      { id: 'nist-ai-rmf', collection: 'glossary' },
      { id: 'iso-iec-42001', collection: 'glossary' },
      { id: 'ai-governance', collection: 'glossary' },
    ],
  });
  assert.deepEqual(node.mentions, [
    { '@id': `${SITE}/glossary/nist-ai-rmf#term` },
    { '@id': `${SITE}/glossary/iso-iec-42001#term` },
  ]);
});

test('a term without related terms carries no mentions', () => {
  const node = termNode(SITE, { id: 'x', term: 'X', shortDefinition: 'D.' });
  assert.equal(node.mentions, undefined);
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

test('an imageObject carries only the dimensions it was given', () => {
  const withDimensions = imageObject({ url: `${SITE}/og/default.png`, width: 1200, height: 630 });
  assert.deepEqual(withDimensions, { '@type': 'ImageObject', url: `${SITE}/og/default.png`, width: 1200, height: 630 });
  const bare = imageObject({ url: `${SITE}/custom.png` });
  assert.deepEqual(bare, { '@type': 'ImageObject', url: `${SITE}/custom.png` });
});

test('the org node carries a logo and image as a dimensioned ImageObject at the default og endpoint', () => {
  const node = orgNode(SITE);
  assert.deepEqual(node.logo, { '@type': 'ImageObject', url: `${SITE}/og/default.png`, width: 1200, height: 630 });
  assert.deepEqual(node.image, node.logo);
});

test('the org logo url and dimensions are overridable for the committed static asset', () => {
  const node = orgNode(SITE, { logoPath: '/_astro/og-default.ab12cd.jpg', width: 512, height: 512 });
  assert.equal(node.logo.url, `${SITE}/_astro/og-default.ab12cd.jpg`);
  assert.equal(node.logo.width, 512);
  assert.equal(node.logo.height, 512);
  assert.deepEqual(node.image, node.logo);
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

test('an faq page node wraps exactly one question with stable ids, is part of the website and carries its language', () => {
  const node = faqPageNode(SITE, {
    id: 'what-is-ai-governance',
    question: 'What is AI governance?',
    answer: 'The system of controls.',
    url: '/faq/what-is-ai-governance',
  });
  assert.equal(node['@type'], 'FAQPage');
  assert.equal(node['@id'], `${SITE}/faq/what-is-ai-governance#faqpage`);
  assert.equal(node.url, `${SITE}/faq/what-is-ai-governance`);
  assert.deepEqual(node.isPartOf, { '@id': `${SITE}/#website` });
  assert.equal(node.inLanguage, 'en');
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

test('an faq page node cites its sources only when the entry carries any, and carries the image and speakable it was given', () => {
  const withSources = faqPageNode(
    SITE,
    {
      id: 'what-is-ai-governance',
      question: 'Q?',
      answer: 'A.',
      sources: [{ title: 'NIST AI RMF', url: 'https://www.nist.gov/' }],
    },
    {
      image: imageObject({ url: `${SITE}/og/default.png`, width: 1200, height: 630 }),
      speakableSelectors: ['h1', '[data-gate-lead]'],
    }
  );
  assert.equal(withSources.citation.length, 1);
  assert.deepEqual(withSources.primaryImageOfPage, {
    '@type': 'ImageObject',
    url: `${SITE}/og/default.png`,
    width: 1200,
    height: 630,
  });
  assert.deepEqual(withSources.speakable, {
    '@type': 'SpeakableSpecification',
    cssSelector: ['h1', '[data-gate-lead]'],
  });

  const withoutSources = faqPageNode(SITE, { id: 'x', question: 'Q?', answer: 'A.' });
  assert.equal(withoutSources.citation, undefined);
  assert.equal(withoutSources.primaryImageOfPage, undefined);
  assert.equal(withoutSources.speakable, undefined);
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

test('a resource node publishes and modifies only on dates it was given, as full ISO instants', () => {
  const withDates = resourceNode(SITE, {
    id: 'ai-governance-starter-kit',
    name: 'Kit',
    description: 'D.',
    publishDate: new Date('2026-08-01T00:00:00Z'),
    updatedDate: new Date('2026-09-01T00:00:00Z'),
    license: 'MIT',
    version: '1.0.0',
  });
  assert.equal(withDates.datePublished, '2026-08-01T00:00:00.000Z');
  assert.equal(withDates.dateModified, '2026-09-01T00:00:00.000Z');
  assert.deepEqual(withDates.isPartOf, { '@id': `${SITE}/#website` });
  assert.equal(withDates.inLanguage, 'en');

  const undated = resourceNode(SITE, { id: 'x', name: 'N', description: 'D.' });
  assert.equal(undated.datePublished, undefined);
  assert.equal(undated.dateModified, undefined);
});

test('a resource node cites its sources and derives about/mentions from its own text', () => {
  const resource = {
    id: 'ai-governance-starter-kit',
    name: 'AI Governance Starter Kit',
    description: 'Covers AI governance basics.',
    whatInside: ['An EU AI Act exposure checklist.'],
    sources: [{ title: 'EU AI Act', url: 'https://eur-lex.europa.eu/' }],
  };
  const node = resourceNode(SITE, resource, resourceEntityLinks(resource, TERMS));
  assert.equal(node.citation.length, 1);
  assert.deepEqual(node.about, [{ '@id': `${SITE}/glossary/ai-governance#term` }]);
  assert.deepEqual(node.mentions, [{ '@id': `${SITE}/glossary/eu-ai-act#term` }]);
});

test('a resource node carries the primaryImageOfPage it was given, and omits it otherwise', () => {
  const withImage = resourceNode(
    SITE,
    { id: 'x', name: 'N', description: 'D.' },
    { image: imageObject({ url: `${SITE}/og/resource/x.png`, width: 1200, height: 630 }) }
  );
  assert.deepEqual(withImage.primaryImageOfPage, {
    '@type': 'ImageObject',
    url: `${SITE}/og/resource/x.png`,
    width: 1200,
    height: 630,
  });
  const withoutImage = resourceNode(SITE, { id: 'x', name: 'N', description: 'D.' });
  assert.equal(withoutImage.primaryImageOfPage, undefined);
});

test('a webpage node owns the webpage id convention, an optional modification date as a full ISO instant, and its language', () => {
  const bare = webPageNode(SITE, '/blog/why-pilots-stall');
  assert.equal(bare['@type'], 'WebPage');
  assert.equal(bare['@id'], `${SITE}/blog/why-pilots-stall#webpage`);
  assert.equal(bare.url, `${SITE}/blog/why-pilots-stall`);
  assert.equal(bare.dateModified, undefined);
  assert.equal(bare.inLanguage, 'en');

  const dated = webPageNode(SITE, '/about', new Date('2026-09-10T00:00:00Z'));
  assert.equal(dated['@id'], `${SITE}/about#webpage`);
  assert.equal(dated.dateModified, '2026-09-10T00:00:00.000Z');
});

test('a webpage node carries the image, mainEntity backlink and speakable selectors it was given', () => {
  const node = webPageNode(SITE, '/services/x', null, 'X', {
    image: imageObject({ url: `${SITE}/og/service/x.png`, width: 1200, height: 630 }),
    mainEntity: `${SITE}/services/x#service`,
    speakableSelectors: ['h1'],
  });
  assert.deepEqual(node.primaryImageOfPage, {
    '@type': 'ImageObject',
    url: `${SITE}/og/service/x.png`,
    width: 1200,
    height: 630,
  });
  assert.deepEqual(node.mainEntity, { '@id': `${SITE}/services/x#service` });
  assert.deepEqual(node.speakable, { '@type': 'SpeakableSpecification', cssSelector: ['h1'] });
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
    { id: 'evals', term: 'Evals', shortDefinition: 'Repeatable tests.', relatedTerms: [{ id: 'shadow-ai' }] },
    { id: 'shadow-ai', term: 'Shadow AI', shortDefinition: 'Unapproved tools.', relatedTerms: [{ id: 'llm-gateway' }] },
    { id: 'llm-gateway', term: 'LLM gateway', shortDefinition: 'One chokepoint.', relatedTerms: [{ id: 'evals' }] },
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

test('a composed service page graph resolves the webpage-to-service backlink, with cited glossary terms declared as local stubs', () => {
  const service = { id: 'x', name: 'X', tagline: 'About AI governance.', description: 'Y' };
  const { about, mentions } = serviceEntityLinks(service, TERMS);
  const citedIds = [...new Set([...about, ...mentions])];
  const document = graph([
    orgNode(SITE),
    personNode(SITE),
    websiteNode(SITE),
    ...citedIds.map((id) =>
      glossaryStub(
        SITE,
        TERMS.find((term) => term.id === id)
      )
    ),
    serviceNode(SITE, service, { about, mentions }),
    webPageNode(SITE, '/services/x', null, 'X', { mainEntity: `${SITE}/services/x#service` }),
    breadcrumbNode(SITE, [{ name: 'Home', path: '/' }]),
  ]);
  assert.ok(citedIds.length > 0, 'the fixture actually exercises at least one glossary stub');
  assert.deepEqual(danglingOf(document), []);
});

test('a glossary stub is self-contained and never pulls in the full term definition', () => {
  const stub = glossaryStub(SITE, { id: 'ai-governance', term: 'AI governance' });
  assert.deepEqual(stub, {
    '@type': 'DefinedTerm',
    '@id': `${SITE}/glossary/ai-governance#term`,
    name: 'AI governance',
    url: `${SITE}/glossary/ai-governance`,
  });
});
