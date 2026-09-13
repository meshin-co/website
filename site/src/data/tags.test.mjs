import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import yaml from 'js-yaml';

import { TAGS, TAG_SLUGS, tagBySlug, postTagSchema } from './tags.mjs';

const frontmatter = (markdown) => {
  const match = /^---\n([\s\S]*?)\n---/.exec(markdown);
  return match ? yaml.load(match[1]) : {};
};

const usedTags = async () => {
  const used = new Set();
  for (const file of await readdir('src/data/post')) {
    if (!file.endsWith('.md')) continue;
    const { tags = [] } = frontmatter(await readFile(`src/data/post/${file}`, 'utf8'));
    for (const tag of tags) used.add(tag);
  }
  return used;
};

test('the controlled vocabulary covers exactly the tags the posts use', async () => {
  assert.deepEqual([...(await usedTags())].sort(), [...TAG_SLUGS].sort());
});

test('slugs are unique and kebab-case', () => {
  assert.equal(new Set(TAG_SLUGS).size, TAG_SLUGS.length);
  assert.deepEqual(
    TAG_SLUGS.filter((slug) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)),
    []
  );
});

test('every slug resolves to exactly one named tag', () => {
  for (const tag of TAGS) {
    assert.equal(tagBySlug[tag.slug].name, tag.name);
    assert.ok(tag.name.length > 0);
  }
});

test('a post frontmatter tag outside the vocabulary is rejected', () => {
  const result = postTagSchema.safeParse(['ai-governance', 'not-a-controlled-tag']);
  assert.equal(result.success, false);
});

test('the whole vocabulary parses as post tags', () => {
  assert.equal(postTagSchema.safeParse(TAG_SLUGS).success, true);
});
