import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, test } from 'node:test';

import { EngineConfigError, readEngineConfig } from './engine-config.mjs';
import { CATEGORIES } from './entry-limits.mjs';
import { engineScene } from './fixtures/engine-scene.mjs';
import { CATEGORY_ROTATION, checkedRotation, readPublishedPosts } from './topic-categories.mjs';

const MODULE = 'site/scripts/topic-categories.mjs';
const POSTS = 'site/src/data/post';
const FACTS = 'site/content-facts.json';
const [GOVERNANCE, AGENTIC, , EXECUTIVE] = CATEGORIES;
const OPERATING = CATEGORIES[2];

const cleanup = [];
after(() => cleanup.forEach((remove) => remove()));

const sceneWith = (categoryRotation) => {
  const scene = engineScene({
    entries: [MODULE],
    mutate: (config) => ({ ...config, loop: { ...config.loop, categoryRotation } }),
  });
  cleanup.push(scene.remove);
  return scene;
};

const tree = (files) => {
  const root = mkdtempSync(join(tmpdir(), 'topic-categories-'));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
};

const entry = (frontmatter) => `---\n${frontmatter}\n---\n\nBody.\n`;
const facts = (targetQuery) => JSON.stringify({ targetQuery, numbers: {} });

test('the shipped rotation is the configured list, and every id in it is one of the categories', () => {
  assert.deepEqual(CATEGORY_ROTATION, readEngineConfig().loop.categoryRotation);
  assert.ok(CATEGORY_ROTATION.every((id) => CATEGORIES.includes(id)));
});

test('an empty rotation, one category, a pair and every category are all legal and come back as they were', () => {
  for (const rotation of [[], [OPERATING], [EXECUTIVE, GOVERNANCE], [...CATEGORIES]]) {
    assert.deepEqual(checkedRotation(rotation), rotation);
  }
});

test('an id that is no category is refused by its value and its position, and the categories are listed', () => {
  assert.throws(
    () => checkedRotation([GOVERNANCE, 'nope']),
    (error) => {
      assert.ok(error instanceof EngineConfigError);
      assert.ok(error.message.includes('loop.categoryRotation[1] "nope" is not a category'), error.message);
      assert.ok(error.message.includes(`the categories are ${CATEGORIES.join(', ')}`), error.message);
      assert.deepEqual(error.fields, ['loop.categoryRotation[1]']);
      return true;
    }
  );
});

test('every bad id is named, not only the first one', () => {
  assert.throws(
    () => checkedRotation(['Governance', GOVERNANCE, 'nope']),
    (error) =>
      error.message.includes('"Governance"') && error.message.includes('"nope"') && !error.message.includes('[1]')
  );
});

test('a module that loads with a configured id that is no category refuses to load and names the value', () => {
  const scene = sceneWith([GOVERNANCE, 'growth']);
  assert.throws(
    () => scene.evaluate(MODULE, '0'),
    (error) =>
      error.message.includes('site/engine.config.json') &&
      error.message.includes('loop.categoryRotation[1] "growth" is not a category')
  );
});

test('a module that loads with a configured subset, or with none, exposes it in the configured order', () => {
  assert.deepEqual(sceneWith([EXECUTIVE, GOVERNANCE]).evaluate(MODULE, 'm.CATEGORY_ROTATION'), [EXECUTIVE, GOVERNANCE]);
  assert.deepEqual(sceneWith([]).evaluate(MODULE, 'm.CATEGORY_ROTATION'), []);
});

test('the published posts are read in slug order with their route, title, target query, category and day', () => {
  const root = tree({
    [`${POSTS}/b-second.md`]: entry(`title: Second article\ncategory: ${EXECUTIVE}\npublishDate: 2026-10-02`),
    [`${POSTS}/a-first.md`]: entry(`title: 'First: an article'\ncategory: ${GOVERNANCE}\npublishDate: 2026-09-08`),
    [FACTS]: facts({ '/blog/a-first': 'first query', '/glossary/x': 'not a post' }),
  });
  assert.deepEqual(readPublishedPosts(root), [
    {
      slug: 'a-first',
      route: '/blog/a-first',
      title: 'First: an article',
      query: 'first query',
      category: GOVERNANCE,
      publishDate: '2026-09-08',
    },
    {
      slug: 'b-second',
      route: '/blog/b-second',
      title: 'Second article',
      query: null,
      category: EXECUTIVE,
      publishDate: '2026-10-02',
    },
  ]);
});

test('a post with no category or no date is still listed, with null for what it lacks; an instant reads as its day', () => {
  const root = tree({
    [`${POSTS}/no-category.md`]: entry('title: One\npublishDate: 2026-10-02'),
    [`${POSTS}/no-date.md`]: entry(`title: Two\ncategory: ${AGENTIC}`),
    [`${POSTS}/an-instant.md`]: entry(`title: Three\ncategory: ${AGENTIC}\npublishDate: 2026-10-03T22:30:00Z`),
    [FACTS]: facts({}),
  });
  assert.deepEqual(
    readPublishedPosts(root).map(({ slug, category, publishDate }) => [slug, category, publishDate]),
    [
      ['an-instant', AGENTIC, '2026-10-03'],
      ['no-category', null, '2026-10-02'],
      ['no-date', AGENTIC, null],
    ]
  );
});

test('a file that is no markdown entry is not a post', () => {
  const root = tree({
    [`${POSTS}/real.md`]: entry(`title: Real\ncategory: ${AGENTIC}\npublishDate: 2026-10-02`),
    [`${POSTS}/notes.txt`]: 'not an entry',
    [`${POSTS}/.hidden`]: 'not an entry',
    [FACTS]: facts({}),
  });
  assert.deepEqual(
    readPublishedPosts(root).map(({ slug }) => slug),
    ['real']
  );
});

test('a tree with no post directory, no facts file or a facts file that is not JSON is refused, naming the path', () => {
  const noPosts = tree({ [FACTS]: facts({}) });
  assert.throws(() => readPublishedPosts(noPosts), /site\/src\/data\/post does not exist or cannot be listed/);
  const noFacts = tree({ [`${POSTS}/real.md`]: entry('title: Real') });
  assert.throws(() => readPublishedPosts(noFacts), /site\/content-facts\.json does not exist or cannot be read/);
  const brokenFacts = tree({ [`${POSTS}/real.md`]: entry('title: Real'), [FACTS]: '{ nope' });
  assert.throws(() => readPublishedPosts(brokenFacts), /site\/content-facts\.json is not valid JSON/);
});

test('a post whose front matter cannot be read is refused, naming the file', () => {
  const root = tree({ [`${POSTS}/broken.md`]: 'no front matter here', [FACTS]: facts({}) });
  assert.throws(
    () => readPublishedPosts(root),
    (error) => error.message.startsWith(`${POSTS}/broken.md: `) && error.message.includes('front matter')
  );
});

test('on the committed tree every post has a route, a title, a real category or none, and a calendar day or none', () => {
  const posts = readPublishedPosts(resolve(import.meta.dirname, '..', '..'));
  assert.deepEqual(
    posts.map(({ slug }) => slug),
    posts.map(({ slug }) => slug).sort()
  );
  for (const { slug, route, title, category, publishDate } of posts) {
    assert.equal(route, `/blog/${slug}`);
    assert.ok(title.length > 0, slug);
    assert.ok(category === null || CATEGORIES.includes(category), `${slug}: ${category}`);
    assert.ok(publishDate === null || /^\d{4}-\d{2}-\d{2}$/.test(publishDate), slug);
  }
});
