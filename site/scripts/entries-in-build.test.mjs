import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NOW, liveRepo } from './fixtures/live-repo.mjs';
import { entriesInBuild } from './entries-in-build.mjs';

const ARTICLE = {
  slug: 'a-post',
  hoursAgo: 6,
  title: 'What an AI system register holds',
  prompt: { number: 3, text: 'How do I keep an AI system register?' },
};
const TERM = {
  slug: 'a-term',
  format: 'term',
  hoursAgo: 3,
  title: 'What is an AI register?',
  input: 6_000,
  output: 1_200,
};

async function inRepo(options, body) {
  const repo = liveRepo(options);
  try {
    return await body(repo);
  } finally {
    repo.remove();
  }
}

const found = ({ root, dist }) => entriesInBuild({ repoRoot: root, dist, instant: NOW });

test('an entry of the build is its route, its title and the buyer prompt it served from the record, and what it cost', async () => {
  await inRepo({ entries: [ARTICLE, TERM] }, async (repo) => {
    const { entries, problems } = await found(repo);
    assert.deepEqual(problems, []);
    assert.deepEqual(
      entries.map((entry) => entry).sort((left, right) => (left.slug < right.slug ? -1 : 1)),
      [
        {
          route: '/blog/a-post',
          slug: 'a-post',
          format: 'article',
          title: 'What an AI system register holds',
          prompt: { number: 3, text: 'How do I keep an AI system register?' },
          generatedAt: '2026-11-03T03:00:00.000Z',
          input: 12_000,
          output: 3_000,
          micro: 27_000,
        },
        {
          route: '/glossary/a-term',
          slug: 'a-term',
          format: 'term',
          title: 'What is an AI register?',
          prompt: { number: 6, text: 'Which artefacts should an AI register hold for each model?' },
          generatedAt: '2026-11-03T06:00:00.000Z',
          input: 6_000,
          output: 1_200,
          micro: 12_000,
        },
      ]
    );
  });
});

test('an entry whose page is not in the build is not carried by it, although its record is committed', async () => {
  await inRepo({ entries: [ARTICLE, TERM], built: ['a-term'] }, async (repo) => {
    const { entries } = await found(repo);
    assert.deepEqual(
      entries.map(({ route }) => route),
      ['/glossary/a-term']
    );
  });
});

test('a page of the build that no generation record names is no entry of the writer, so it is never announced', async () => {
  await inRepo({ entries: [ARTICLE] }, async (repo) => {
    repo.put('../dist/blog/written-by-hand.html', '<!doctype html>');
    const { entries } = await found(repo);
    assert.deepEqual(
      entries.map(({ slug }) => slug),
      ['a-post']
    );
  });
});

test('a record that cannot be read is reported by name and costs the other entries nothing', async () => {
  await inRepo({ entries: [ARTICLE] }, async (repo) => {
    repo.put('audits/autowriter/generations/2026/11/broken.json', 'not json');
    const { entries, problems } = await found(repo);
    assert.deepEqual(
      entries.map(({ slug }) => slug),
      ['a-post']
    );
    assert.deepEqual(problems, [
      'audits/autowriter/generations/2026/11/broken.json is not counted: it is not readable JSON',
    ]);
  });
});

test('a build directory that cannot be read is refused by name, and is never read as a build with no entry', async () => {
  await inRepo({ entries: [ARTICLE] }, async (repo) => {
    const missing = `${repo.dist}-missing`;
    await assert.rejects(
      entriesInBuild({ repoRoot: repo.root, dist: missing, instant: NOW }),
      (error) => error.message.includes(missing) && /cannot be read/.test(error.message)
    );
  });
});

test('a repository with no generation record carries no entry', async () => {
  await inRepo({ entries: [] }, async (repo) => {
    assert.deepEqual(await found(repo), { entries: [], problems: [] });
  });
});
