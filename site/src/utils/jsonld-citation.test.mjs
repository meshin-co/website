import assert from 'node:assert/strict';
import { test } from 'node:test';

import { searchFallbackUrl } from './archive-url.mjs';
import { faqPageNode, postNode, resourceNode, serviceNode, termNode } from './jsonld.mjs';

const SITE = 'https://meshin.co';
const NIST_PAGE = 'https://www.nist.gov/itl/ai-risk-management-framework';
const ARCHIVED = `https://web.archive.org/web/20251025031200/${NIST_PAGE}`;
const SEARCHED = { title: 'Regulation (EU) 2024/1689', publisher: 'EUR-Lex' };
const PLAIN = { title: 'ISO/IEC 42001', url: 'https://www.iso.org/standard/42001' };
const ARCHIVE_COPY = { title: 'NIST AI RMF', url: ARCHIVED, original: NIST_PAGE };
const SEARCH_STAND_IN = {
  ...SEARCHED,
  url: searchFallbackUrl(SEARCHED),
  original: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj',
};
const DATES = { publishDate: new Date('2026-09-01T00:00:00Z'), updatedDate: new Date('2026-09-05T00:00:00Z') };
const citingNodes = (sources) => [
  serviceNode(SITE, { id: 's', name: 'S', description: 'D.', sources }),
  postNode(SITE, { id: 'p', title: 'P', description: 'D.', ...DATES, sources }),
  resourceNode(SITE, { id: 'r', name: 'R', description: 'D.', sources }),
  termNode(SITE, { id: 't', term: 'T', shortDefinition: 'D.', sources }),
  faqPageNode(SITE, { id: 'f', question: 'Q?', answer: 'A.', sources }),
];

test('a node lists a plain source and an archive copy as citations, and never a search page', () => {
  for (const node of citingNodes([PLAIN, ARCHIVE_COPY, SEARCH_STAND_IN])) {
    assert.deepEqual(
      node.citation,
      [
        { '@type': 'CreativeWork', name: 'ISO/IEC 42001', url: PLAIN.url },
        { '@type': 'CreativeWork', name: 'NIST AI RMF', url: ARCHIVED },
      ],
      node['@type']
    );
  }
});

test('when every source rests on a search page the citation list is empty, and an faq page node drops the property', () => {
  const [service, post, resource, term, faq] = citingNodes([SEARCH_STAND_IN]);

  for (const node of [service, post, resource, term]) assert.deepEqual(node.citation, [], node['@type']);
  assert.equal(faq.citation, undefined);
});
