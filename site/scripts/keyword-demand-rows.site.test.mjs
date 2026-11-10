import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { brandFromDisk, titleSuffix } from '../src/utils/brand.mjs';
import { readEngineConfig } from './engine-config.mjs';
import { expandPhrases, readRouteFacts, termTitles } from './keyword-demand-rows.mjs';
import { readConceptRegister } from './topic-owners.mjs';

const CORE = readFileSync(new URL('../../docs/SEMANTIC-CORE.md', import.meta.url), 'utf8');

test('the real register, routes and shapes build a list of distinct phrases, and no glossary title keeps the site name', () => {
  const suffix = titleSuffix(brandFromDisk());
  const { keywords, content } = readEngineConfig();
  const routes = readRouteFacts(CORE, suffix);
  const titles = termTitles(routes, content.formats.term.routePrefix);
  const concepts = readConceptRegister(CORE).map(({ concept }) => concept);
  const phrases = expandPhrases({ concepts, titles, templates: keywords.templates });

  assert.ok(routes.length > 0, `${routes.length} routes`);
  assert.ok(titles.length > 0 && concepts.length > 0);
  assert.ok(
    titles.every((title) => !title.endsWith(suffix)),
    titles.join(' | ')
  );
  assert.equal(new Set(phrases).size, phrases.length);
  assert.ok(phrases.every((phrase) => phrase === phrase.toLowerCase().trim() && !phrase.includes('?')));
  assert.ok(phrases.length >= concepts.length);
});
