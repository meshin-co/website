import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SHARED_DERIVED, classifyPath, isDerivedPath } from './derived-files.mjs';

const SLUG = 'ai-vendor-risk-questionnaire';
const OWN = [
  `audits/autowriter/2026/11/${SLUG}.json`,
  `audits/autowriter/claims/2026/11/${SLUG}.json`,
  `audits/autowriter/generations/2026/11/${SLUG}.json`,
  `audits/phase-4.7/dispositions/2026/11/generated-${SLUG}.json`,
  `site/src/data/post/${SLUG}.md`,
  `site/src/data/glossary/${SLUG}.md`,
];
const RESTATED = [
  'audits/phase-4.7/dispositions/articles-telemetry.json',
  'audits/phase-4.7/dispositions/2026/11/generated-another-slug.json',
];
const FOREIGN = [
  'site/tests/__screenshots__/linux/blog.png',
  'site/src/data/post/another-slug.md',
  'audits/autowriter/claims/2026/11/another-slug.json',
  'audits/sentence-band.json',
];

test('the shared derived set is the five files that every writer run rewrites whole', () => {
  assert.deepEqual(SHARED_DERIVED, [
    'audits/phase-4.7/dispositions/routes.json',
    'audits/routes.json',
    'audits/spend-report.md',
    'docs/SEMANTIC-CORE.md',
    'site/content-facts.json',
  ]);
});

test('a path is own, shared, restated or foreign, and a run may commit only the first three', () => {
  for (const path of OWN) assert.equal(classifyPath(path, [SLUG]), 'own', path);
  for (const path of SHARED_DERIVED) assert.equal(classifyPath(path, [SLUG]), 'shared', path);
  for (const path of RESTATED) assert.equal(classifyPath(path, [SLUG]), 'restated', path);
  for (const path of FOREIGN) assert.equal(classifyPath(path, [SLUG]), 'foreign', path);
});

test('a path that belongs to a slug the run does not write is not its own', () => {
  for (const path of OWN.filter((path) => !path.includes('dispositions')))
    assert.equal(classifyPath(path, []), 'foreign');
});

test('main moving a derived path is what puts a pull request behind, and an unrelated path is not', () => {
  for (const path of [...SHARED_DERIVED, ...RESTATED]) assert.equal(isDerivedPath(path), true, path);
  for (const path of [...FOREIGN, 'site/src/data/post/another-slug.md']) assert.equal(isDerivedPath(path), false, path);
});
