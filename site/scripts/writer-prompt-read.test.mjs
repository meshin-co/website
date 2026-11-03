import assert from 'node:assert/strict';
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { claimFor } from './fixtures/writer-drafts.mjs';
import { makeRepo, removeRepo } from './fixtures/writer-repo.mjs';
import { parseBuyerPrompts } from './semantic-core.mjs';
import { WriterError } from './writer-error.mjs';
import { PROMPT_SOURCES } from './writer-prompt.mjs';
import { readSources } from './writer-prompt-read.mjs';

const FACTS_FILE = 'site/content-facts.json';
const LIST_KINDS = ['json', 'routes', 'tags', 'slugs'];
const REPOSITORY = join(import.meta.dirname, '..', '..');
const DECLARED_KEYS = PROMPT_SOURCES.flatMap(({ take }) => take.filter(({ key }) => key).map(({ key }) => key)).sort();

const roots = [];
const freshRoot = () => {
  const root = makeRepo();
  roots.push(root);
  return root;
};
after(() => roots.forEach(removeRepo));

const withNumbers = (root, numbers) => {
  const facts = JSON.parse(readFileSync(join(root, FACTS_FILE), 'utf8'));
  writeFileSync(join(root, FACTS_FILE), JSON.stringify({ ...facts, numbers }));
};
const factsSource = (take) => [
  { path: FACTS_FILE, part: 'The numbers a page may state without a source.', take: [take] },
];
const read = (root, sources = PROMPT_SOURCES) => readSources({ repoRoot: root, claim: claimFor('term'), sources });
const refusing = (path) => (error) =>
  error instanceof WriterError && error.kind === 'config' && error.message.includes(path);

const NOT_A_LIST = [
  ['a missing key', undefined],
  ['null', null],
  ['an empty string', ''],
  ['an empty object', {}],
];

test('a take that allows an empty list returns the empty list its file holds, under any key', () => {
  const root = freshRoot();
  withNumbers(root, []);
  const { data } = read(root, factsSource({ kind: 'json', key: 'figures', field: 'numbers', allowEmpty: true }));
  assert.deepEqual(data, { figures: [] });
});

test('a take that does not allow an empty list refuses the same empty list, naming the file and the field', () => {
  const root = freshRoot();
  withNumbers(root, []);
  assert.throws(
    () => read(root, factsSource({ kind: 'json', key: 'figures', field: 'numbers' })),
    (error) => refusing(FACTS_FILE)(error) && error.message.includes('numbers is gone or empty')
  );
});

test('the numbers of PROMPT_SOURCES read as an empty list when the site publishes none', () => {
  const root = freshRoot();
  withNumbers(root, []);
  assert.deepEqual(read(root).data.numbers, []);
});

for (const [what, value] of NOT_A_LIST) {
  test(`the numbers of PROMPT_SOURCES still refuse ${what}, naming the file and the field`, () => {
    const root = freshRoot();
    withNumbers(root, value);
    assert.throws(
      () => read(root),
      (error) => refusing(FACTS_FILE)(error) && error.message.includes('numbers is gone or empty')
    );
  });
}

const emptyDirectory = (root, path) => {
  for (const name of readdirSync(join(root, path))) rmSync(join(root, path, name));
};
const overwrite = (text) => (root, path) => writeFileSync(join(root, path), text);
const EMPTIED = {
  'site/banned-phrases.json': overwrite('[]'),
  'site/controlled-words.json': overwrite('{}'),
  'audits/routes.json': overwrite('[]'),
  'site/src/data/tags.mjs': overwrite('export const TAGS = [];\n'),
  'site/src/data/glossary': emptyDirectory,
  'site/src/data/resource': emptyDirectory,
};

test('only the numbers of content-facts.json carry the permission to be read as an empty list', () => {
  const allowing = PROMPT_SOURCES.flatMap(({ path, take }) =>
    take.filter(({ allowEmpty }) => allowEmpty).map(({ key }) => [path, key])
  );
  assert.deepEqual(allowing, [[FACTS_FILE, 'numbers']]);
});

test('the sources that stay refused when empty are every list the prompt reads, except the allowed numbers', () => {
  const lists = PROMPT_SOURCES.flatMap(({ path, take }) =>
    take.filter(({ kind, allowEmpty }) => LIST_KINDS.includes(kind) && !allowEmpty).map(() => path)
  );
  assert.deepEqual(lists.sort(), Object.keys(EMPTIED).sort());
});

for (const [path, empty] of Object.entries(EMPTIED)) {
  test(`${path} still refuses to be read empty, naming itself`, () => {
    const root = freshRoot();
    empty(root, path);
    assert.throws(() => read(root), refusing(path));
  });
}

for (const format of ['term', 'article']) {
  test(`the ${format} walk resolves every anchor of every source against the committed tree of the repository`, () => {
    const [prompt] = parseBuyerPrompts(readFileSync(join(REPOSITORY, 'docs/SEMANTIC-CORE.md'), 'utf8'));
    assert.ok(prompt, 'the committed core holds no buyer prompt');
    const claim = claimFor(format, { prompt: { number: prompt.number, text: 'the first buyer prompt' } });
    const { texts, data } = readSources({ repoRoot: REPOSITORY, claim, sources: PROMPT_SOURCES });
    assert.ok(texts.every(({ blocks }) => blocks.length > 0));
    assert.deepEqual(Object.keys(data).sort(), DECLARED_KEYS);
  });
}
