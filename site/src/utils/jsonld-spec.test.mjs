import assert from 'node:assert/strict';
import { test } from 'node:test';

import { imageObject, specNode, specSeriesStub } from './jsonld.mjs';

const SITE = 'https://meshin.co';

const SPEC = {
  id: 'evals-baseline/1.0',
  name: 'evals-baseline',
  version: '1.0',
  title: 'evals-baseline specification 1.0',
  description: 'What the baseline file holds.',
  publishDate: new Date('2026-11-12T00:00:00Z'),
  updatedDate: new Date('2026-11-14T00:00:00Z'),
  license: 'CC-BY-4.0',
};

test('a specification version is a TechArticle at its own address, carrying its version and licence', () => {
  const image = imageObject({ url: `${SITE}/og/spec/evals-baseline/1.0.png`, width: 1200, height: 630 });

  assert.deepEqual(specNode(SITE, SPEC, { image }), {
    '@type': 'TechArticle',
    '@id': `${SITE}/spec/evals-baseline/1.0#spec`,
    url: `${SITE}/spec/evals-baseline/1.0`,
    headline: 'evals-baseline specification 1.0',
    description: 'What the baseline file holds.',
    datePublished: '2026-11-12T00:00:00.000Z',
    dateModified: '2026-11-14T00:00:00.000Z',
    version: '1.0',
    inLanguage: 'en',
    image,
    mainEntityOfPage: { '@id': `${SITE}/spec/evals-baseline/1.0#webpage` },
    author: { '@id': `${SITE}/#person` },
    publisher: { '@id': `${SITE}/#org` },
    license: 'CC-BY-4.0',
    isPartOf: { '@id': `${SITE}/spec/evals-baseline#page` },
  });
});

test('a specification given no image falls back to its own card', () => {
  assert.equal(specNode(SITE, SPEC).image, `${SITE}/og/spec/evals-baseline/1.0.png`);
});

test('the series stub is the page a version points at, and declares no more than that', () => {
  const stub = specSeriesStub(SITE, 'evals-baseline');

  assert.deepEqual(stub, {
    '@type': 'CollectionPage',
    '@id': `${SITE}/spec/evals-baseline#page`,
    url: `${SITE}/spec/evals-baseline`,
    name: 'evals-baseline specification',
    isPartOf: { '@id': `${SITE}/#website` },
  });
  assert.equal(stub['@id'], specNode(SITE, SPEC).isPartOf['@id']);
});
