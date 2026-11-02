import assert from 'node:assert/strict';
import { test } from 'node:test';

import { danglingIds, duplicateIds } from '../../scripts/jsonld-gate.mjs';
import {
  breadcrumbNode,
  collectionNode,
  contactPageNode,
  faqNode,
  faqPageNode,
  graph,
  orgNode,
  personNode,
  postNode,
  profilePageNode,
  resourceNode,
  serviceNode,
  termNode,
  termSetNode,
  webPageNode,
  websiteNode,
} from './jsonld.mjs';

const SITE = 'https://meshin.co';

const HOME_CRUMB = { name: 'Home', path: '/' };
const trailTo = (...steps) => [HOME_CRUMB, ...steps.map(([name, path]) => ({ name, path }))];
const siteNodes = () => [orgNode(SITE), personNode(SITE), websiteNode(SITE)];

const SAMPLE_POST = {
  id: 'why-pilots-stall',
  title: 'Why pilots stall',
  description: 'Short.',
  publishDate: new Date('2026-09-01T00:00:00Z'),
  updatedDate: new Date('2026-09-05T00:00:00Z'),
};
const SAMPLE_FAQ = [
  { q: 'One?', a: 'First.' },
  { q: 'Two?', a: 'Second.' },
];
const SAMPLE_TERMS = [
  { id: 'evals', term: 'Evals', shortDefinition: 'Repeatable tests.', relatedTerms: [{ id: 'shadow-ai' }] },
  { id: 'shadow-ai', term: 'Shadow AI', shortDefinition: 'Unapproved tools.', relatedTerms: [] },
];
const SAMPLE_SERVICE = { id: 'x', name: 'X', tagline: 'About AI governance.', description: 'Y' };
const SAMPLE_RESOURCE = { id: 'kit', name: 'Kit', description: 'D.', version: '1.0' };
const SAMPLE_QUESTION = { id: 'what-is-ai-governance', question: 'What is AI governance?', answer: 'Controls.' };

const PAGE_FAMILIES = {
  'the home page': ['/', () => [...siteNodes(), webPageNode(SITE, '/', '2026-10-17', 'Home')]],
  'a blog post with a faq': [
    '/blog/why-pilots-stall',
    () => [
      ...siteNodes(),
      postNode(SITE, SAMPLE_POST),
      faqNode(SITE, '/blog/why-pilots-stall', SAMPLE_FAQ),
      webPageNode(SITE, '/blog/why-pilots-stall', SAMPLE_POST.updatedDate, SAMPLE_POST.title, { faq: true }),
      breadcrumbNode(
        SITE,
        trailTo(
          ['Writing', '/blog'],
          ['Governance', '/blog/category/governance'],
          [SAMPLE_POST.title, '/blog/why-pilots-stall']
        )
      ),
    ],
  ],
  'a blog post without a faq': [
    '/blog/why-pilots-stall',
    () => [
      ...siteNodes(),
      postNode(SITE, SAMPLE_POST),
      webPageNode(SITE, '/blog/why-pilots-stall', SAMPLE_POST.updatedDate, SAMPLE_POST.title),
      breadcrumbNode(SITE, trailTo(['Writing', '/blog'], [SAMPLE_POST.title, '/blog/why-pilots-stall'])),
    ],
  ],
  'a case study': [
    '/case-studies/example-case',
    () => [
      ...siteNodes(),
      postNode(SITE, { ...SAMPLE_POST, id: 'example-case' }, { basePath: '/case-studies', ogCollection: 'case' }),
      webPageNode(SITE, '/case-studies/example-case', SAMPLE_POST.updatedDate, SAMPLE_POST.title),
      breadcrumbNode(
        SITE,
        trailTo(['Case studies', '/case-studies'], [SAMPLE_POST.title, '/case-studies/example-case'])
      ),
    ],
  ],
  'a service with a faq': [
    '/services/x',
    () => [
      ...siteNodes(),
      serviceNode(SITE, SAMPLE_SERVICE),
      webPageNode(SITE, '/services/x', null, 'X', { mainEntity: `${SITE}/services/x#service`, faq: true }),
      faqNode(SITE, '/services/x', SAMPLE_FAQ),
      breadcrumbNode(SITE, trailTo(['Services', '/services'], ['X', '/services/x'])),
    ],
  ],
  'a glossary term': [
    '/glossary/evals',
    () => [
      ...siteNodes(),
      termSetNode(SITE, SAMPLE_TERMS),
      ...SAMPLE_TERMS.map((term) => termNode(SITE, term)),
      webPageNode(SITE, '/glossary/evals', null, 'Evals', { mainEntity: `${SITE}/glossary/evals#term` }),
      breadcrumbNode(SITE, trailTo(['Glossary', '/glossary'], ['Evals', '/glossary/evals'])),
    ],
  ],
  'a collection index': [
    '/blog',
    () => [
      ...siteNodes(),
      collectionNode(SITE, {
        path: '/blog',
        name: 'Writing',
        description: 'D.',
        items: [{ url: '/blog/why-pilots-stall' }],
      }),
      breadcrumbNode(SITE, trailTo(['Writing', '/blog'])),
    ],
  ],
  'a numbered archive page': [
    '/blog/page/2',
    () => [
      ...siteNodes(),
      collectionNode(SITE, { path: '/blog/page/2', name: 'Writing', description: 'D.' }),
      breadcrumbNode(SITE, trailTo(['Writing', '/blog'], ['Page 2', '/blog/page/2'])),
    ],
  ],
  'a faq entry': [
    '/faq/what-is-ai-governance',
    () => [
      ...siteNodes(),
      faqPageNode(SITE, SAMPLE_QUESTION),
      breadcrumbNode(SITE, trailTo(['FAQ', '/faq'], [SAMPLE_QUESTION.question, '/faq/what-is-ai-governance'])),
    ],
  ],
  'a resource': [
    '/resources/kit',
    () => [
      ...siteNodes(),
      resourceNode(SITE, SAMPLE_RESOURCE),
      breadcrumbNode(SITE, trailTo(['Resources', '/resources'], ['Kit', '/resources/kit'])),
    ],
  ],
  'the about page': [
    '/about',
    () => [...siteNodes(), profilePageNode(SITE, '2026-10-17'), breadcrumbNode(SITE, trailTo(['About', '/about']))],
  ],
  'the contact page': [
    '/contact',
    () => [...siteNodes(), contactPageNode(SITE, '2026-10-02'), breadcrumbNode(SITE, trailTo(['Contact', '/contact']))],
  ],
  'a static page': [
    '/approach',
    () => [
      ...siteNodes(),
      webPageNode(SITE, '/approach', null, 'How I work'),
      breadcrumbNode(SITE, trailTo(['Approach', '/approach'])),
    ],
  ],
};

const idsOf = (document) => document['@graph'].map((node) => node['@id']);
const nodeWithId = (document, id) => document['@graph'].find((node) => node['@id'] === id);
const nodesPointingAtBreadcrumbs = (document) => document['@graph'].filter((node) => node.breadcrumb);

test('a breadcrumb list takes its id from the page its trail ends at, whatever the trail above it', () => {
  const short = breadcrumbNode(SITE, trailTo(['Glossary', '/glossary']));
  const long = breadcrumbNode(SITE, trailTo(['Writing', '/blog'], ['Glossary', '/glossary']));
  assert.equal(short['@id'], `${SITE}/glossary#breadcrumb`);
  assert.equal(long['@id'], short['@id']);
});

test('an embedded faq node is identified by its page and belongs to that same page webpage', () => {
  const node = faqNode(SITE, '/services/x', SAMPLE_FAQ);
  assert.equal(node['@id'], `${SITE}/services/x#faqpage`);
  assert.equal(node['@id'], faqPageNode(SITE, { ...SAMPLE_QUESTION, url: '/services/x' })['@id']);
  assert.deepEqual(node.isPartOf, { '@id': `${SITE}/services/x#webpage` });
  assert.deepEqual(
    node.mainEntity.map((entry) => entry.name),
    ['One?', 'Two?']
  );
});

test('every page node points at the breadcrumbs of its own page, and the home page points at none', () => {
  const breadcrumbsOf = (path) => ({ '@id': `${SITE}${path}#breadcrumb` });
  assert.deepEqual(webPageNode(SITE, '/approach', null, 'A').breadcrumb, breadcrumbsOf('/approach'));
  assert.deepEqual(
    collectionNode(SITE, { path: '/blog/page/2', name: 'W', description: 'D.' }).breadcrumb,
    breadcrumbsOf('/blog/page/2')
  );
  assert.deepEqual(contactPageNode(SITE, '2026-10-02').breadcrumb, breadcrumbsOf('/contact'));
  assert.deepEqual(profilePageNode(SITE, '2026-10-02').breadcrumb, breadcrumbsOf('/about'));
  assert.deepEqual(faqPageNode(SITE, SAMPLE_QUESTION).breadcrumb, breadcrumbsOf('/faq/what-is-ai-governance'));
  assert.deepEqual(resourceNode(SITE, SAMPLE_RESOURCE).breadcrumb, breadcrumbsOf('/resources/kit'));
  assert.equal(webPageNode(SITE, '/', null, 'Home').breadcrumb, undefined);
});

test('a webpage node points at the faq it hosts only when told it hosts one', () => {
  const hosting = webPageNode(SITE, '/blog/x', null, 'X', { faq: true });
  assert.deepEqual(hosting.hasPart, { '@id': `${SITE}/blog/x#faqpage` });
  assert.equal(webPageNode(SITE, '/blog/x', null, 'X').hasPart, undefined);
});

test('a composed graph for each page family identifies every node, declares no id twice and resolves every reference', () => {
  for (const [family, [, build]] of Object.entries(PAGE_FAMILIES)) {
    const document = graph(build());
    assert.ok(
      idsOf(document).every((id) => typeof id === 'string' && id.length > 0),
      `${family} has a node with no @id`
    );
    assert.deepEqual(duplicateIds([document]), [], `${family} declares an @id twice`);
    assert.deepEqual(danglingIds([document]), [], `${family} points at an @id it does not declare`);
  }
});

test('from the page node a consumer reaches the breadcrumbs of every page below the home page, ending at that page', () => {
  for (const [family, [path, build]] of Object.entries(PAGE_FAMILIES)) {
    const document = graph(build());
    const pointing = nodesPointingAtBreadcrumbs(document);
    if (path === '/') {
      assert.equal(pointing.length, 0, `${family} points at breadcrumbs it does not have`);
      continue;
    }
    assert.equal(pointing.length, 1, `${family} must have exactly one page node pointing at its breadcrumbs`);
    const crumbs = nodeWithId(document, pointing[0].breadcrumb['@id']);
    assert.equal(crumbs['@type'], 'BreadcrumbList', family);
    assert.equal(crumbs.itemListElement.at(-1).item, pointing[0].url, family);
  }
});

test('from the page node a consumer reaches the faq of a post and of a service, and the faq points back', () => {
  for (const family of ['a blog post with a faq', 'a service with a faq']) {
    const document = graph(PAGE_FAMILIES[family][1]());
    const [pageNode] = nodesPointingAtBreadcrumbs(document);
    const faq = nodeWithId(document, pageNode.hasPart['@id']);
    assert.equal(faq['@type'], 'FAQPage', family);
    assert.deepEqual(faq.isPartOf, { '@id': pageNode['@id'] }, family);
  }
});

test('every id is a pure function of the origin and the page, so two builds of a page agree', () => {
  for (const [family, [, build]] of Object.entries(PAGE_FAMILIES)) {
    assert.deepEqual(idsOf(graph(build())), idsOf(graph(build())), family);
  }
});
