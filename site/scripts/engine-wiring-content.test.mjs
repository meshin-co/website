import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after as afterAll, test } from 'node:test';

import { engineScene } from './fixtures/engine-scene.mjs';

const scenes = [];
afterAll(() => scenes.forEach((scene) => scene.remove()));
const sceneOf = (options) => {
  const scene = engineScene(options);
  scenes.push(scene);
  return scene;
};

const renamed = (config) => ({
  ...config,
  routeFamilies: {
    ...config.routeFamilies,
    rules: [
      { prefix: '/terms/', family: 'term', profile: 'term' },
      { prefix: '/notes/', family: 'article', profile: 'article' },
      ...config.routeFamilies.rules,
    ],
  },
  content: {
    dataDirectory: 'site/src/store',
    formats: {
      term: { collection: 'terms', routePrefix: '/terms/' },
      article: { collection: 'posts', routePrefix: '/notes/', author: 'someone', resourceCollection: 'assets' },
    },
  },
});

const DRAFT = { description: 'd', shortDefinition: 'a b', definition: 'c d', relatedTerms: ['known', 'ghost'] };
const ARTICLE_DRAFT = {
  description: 'd',
  shortAnswer: 'a b',
  fullAnswer: 'c d',
  keyTakeaways: [],
  faq: [],
  category: 'none',
  tags: [],
  relatedResources: ['known', 'ghost'],
};
const unknownSlugs = (format, fields, slugs) =>
  `m.fieldProblems({
    draft: { format: '${format}', fields: ${JSON.stringify(fields)}, sources: [], passage: '', body: '' },
    claim: { format: '${format}' },
    context: { slugs: ${JSON.stringify(slugs)}, routes: [], tags: [] },
    runDate: '2026-11-02',
  }).filter(({ rule }) => rule.startsWith('unknown')).map(({ detail }) => detail)`;

const LIVE = [
  [
    'the collection of each format and the resource collection come from the content section',
    'site/scripts/entry-prose.mjs',
    `[m.COLLECTION_OF, Object.isFrozen(m.COLLECTION_OF), m.RESOURCE_COLLECTION]`,
    [{ term: 'terms', article: 'posts' }, true, 'assets'],
  ],
  [
    'the prose fields of a collection follow its renamed collection',
    'site/scripts/entry-prose.mjs',
    `[
      m.proseBlocks({ collection: 'posts', frontmatter: { shortAnswer: 'Alpha beta.' }, body: '' }),
      m.proseBlocks({ collection: 'terms', frontmatter: { shortDefinition: 'Gamma delta.', definition: 'Eps zeta.' }, body: '' }),
    ]`,
    [['Alpha beta.'], ['Gamma delta.', 'Eps zeta.']],
  ],
  [
    'the data directory and the collection directories of the writer tree follow the content section',
    'site/scripts/writer-tree.mjs',
    '[m.DATA_DIRECTORY, m.REPO_FILES.collections, m.REPO_FILES.tags]',
    [
      'site/src/store',
      { posts: 'site/src/store/posts', terms: 'site/src/store/terms', assets: 'site/src/store/assets' },
      'site/src/store/tags.mjs',
    ],
  ],
  [
    'the path, the route and the author of a written entry follow the content section',
    'site/scripts/entry-files.mjs',
    `[
      m.entryPath({ format: 'article', slug: 's' }),
      m.entryRoute({ format: 'article', slug: 's' }),
      m.entryPath({ format: 'term', slug: 't' }),
      m.entryRoute({ format: 'term', slug: 't' }),
      m.renderEntry({
        claim: { format: 'article', slug: 's', title: 'A title' },
        draft: { fields: ${JSON.stringify(ARTICLE_DRAFT)}, sources: [], body: '' },
        runDate: '2026-11-02',
      }).text.includes('author: someone\\n'),
    ]`,
    ['site/src/store/posts/s.md', '/notes/s', 'site/src/store/terms/t.md', '/terms/t', true],
  ],
  [
    'the route prefix of each format in the topic owners follows the content section',
    'site/scripts/topic-owners.mjs',
    "[m.ROUTE_PREFIX, m.routeOf('article', 'a'), m.routeOf('term', 'b')]",
    [{ term: '/terms/', article: '/notes/' }, '/notes/a', '/terms/b'],
  ],
  [
    'the labels of the user prompt name the directories the content section gives',
    'site/scripts/writer-prompt-text.mjs',
    `m.userPrompt({
      claim: { format: 'term', slug: 't', title: 'What is t?', query: 'q', prompt: { number: 1, text: 'p' }, demand: { impressions: 1, position: null } },
      runDate: '2026-11-02',
      read: { data: { promptBlock: '', routes: [], glossary: ['g'], resource: ['r'], tags: ['x'] } },
    }).split('\\n').filter((line) => / that exist \\(site\\//.test(line))`,
    [
      'Glossary terms that exist (site/src/store/terms):',
      'Resources that exist (site/src/store/assets):',
      'Tags that exist (site/src/store/tags.mjs):',
    ],
  ],
  [
    'the slugs a draft may link to are looked up under the renamed collections',
    'site/scripts/writer-preflight-fields.mjs',
    `[${unknownSlugs('term', DRAFT, { terms: ['known'], glossary: [] })}, ${unknownSlugs('article', ARTICLE_DRAFT, { assets: ['known'], resource: [] })}]`,
    [['relatedTerms "ghost" is not in the site\'s list'], ['relatedResources "ghost" is not in the site\'s list']],
  ],
];

for (const [label, module, expression, expected] of LIVE) {
  test(label, () => {
    const scene = sceneOf({ entries: [module], mutate: renamed });
    assert.deepEqual(scene.evaluate(module, expression), expected);
  });
}

test('the prompt sources point at the renamed directories and keep their labels', () => {
  const module = 'site/scripts/writer-prompt.mjs';
  const scene = sceneOf({ entries: [module], mutate: renamed });
  const sources = scene.evaluate(
    module,
    "m.PROMPT_SOURCES.filter(({ take }) => take.some(({ kind }) => ['slugs', 'tags'].includes(kind))).map(({ path, take }) => [path, take[0].key])"
  );
  assert.deepEqual(sources, [
    ['site/src/store/tags.mjs', 'tags'],
    ['site/src/store/terms', 'glossary'],
    ['site/src/store/assets', 'resource'],
  ]);
});

test('the corpus is read from the renamed data directory and collections', () => {
  const module = 'site/scripts/sentence-band.mjs';
  const scene = sceneOf({ entries: [module], mutate: renamed });
  for (const [collection, slug] of [
    ['posts', 'first'],
    ['terms', 'second'],
  ]) {
    const directory = join(scene.root, 'site/src/store', collection);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, `${slug}.md`), '---\ntitle: T\n---\nBody.\n');
  }
  const ids = scene.evaluate(module, `m.loadCorpus(${JSON.stringify(scene.root)}).map(({ id }) => id)`);
  assert.deepEqual(ids.sort(), ['posts/first', 'terms/second']);
});

const REQUIRED = [
  'site/scripts/entry-prose.mjs',
  'site/scripts/writer-tree.mjs',
  'site/scripts/entry-files.mjs',
  'site/scripts/topic-owners.mjs',
  'site/scripts/sentence-band.mjs',
  'site/scripts/writer-prompt.mjs',
  'site/scripts/writer-prompt-text.mjs',
  'site/scripts/writer-preflight-fields.mjs',
];

for (const module of REQUIRED) {
  test(`${module} refuses to load when the resource collection is missing from its own configuration file`, () => {
    const scene = sceneOf({
      entries: [module],
      mutate: (config) => {
        delete config.content.formats.article.resourceCollection;
        return config;
      },
    });
    assert.throws(
      () => scene.evaluate(module, '0'),
      (error) =>
        error.message.includes(join(scene.root, 'site/engine.config.json')) &&
        error.message.includes('content.formats.article.resourceCollection is required')
    );
  });
}
