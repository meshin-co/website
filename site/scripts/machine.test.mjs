import assert from 'node:assert/strict';
import { test } from 'node:test';

import { publicCollections, missingFromGenerator, sidecarGaps } from './machine.mjs';

const CONFIG = `
const postCollection = defineCollection({ loader: glob({ pattern: ['*.md'], base: 'src/data/post' }) });
export const collections = {
  post: postCollection,
  service: serviceCollection,
  resource: resourceCollection,
  glossary: glossaryCollection,
  case: caseCollection,
  faq: faqCollection,
  author: authorCollection,
  speaking: speakingCollection,
};
`;

test('the public collection list comes from the content config, not a hand-written array', () => {
  assert.deepEqual(publicCollections(CONFIG), ['post', 'service', 'resource', 'glossary', 'case']);
});

test('a generator that omits one public collection is reported', () => {
  const text = 'https://meshin.co/blog/a-post\nhttps://meshin.co/services/x\nhttps://meshin.co/resources/y';

  assert.deepEqual(missingFromGenerator(text, ['post', 'service', 'resource', 'glossary']), ['glossary']);
});

test('a generator covering every public collection reports nothing', () => {
  const text = '/blog/a /services/b /resources/c /glossary/d /case-studies/e';

  assert.deepEqual(missingFromGenerator(text, ['post', 'service', 'resource', 'glossary', 'case']), []);
});

test('a page whose markdown sidecar was not built is reported', () => {
  const gaps = sidecarGaps(['/blog/a-post', '/glossary/evals', '/about'], ['blog/a-post.md']);

  assert.deepEqual(gaps, ['/glossary/evals.md']);
});
