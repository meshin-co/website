import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { TIME_OF_DAY, compilePattern, consistencyProblems, matchRoute } from './engine-config-checks.mjs';

const REAL = JSON.parse(readFileSync(new URL('../engine.config.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(REAL);

test('the real configuration contradicts nothing', () => {
  assert.deepEqual(consistencyProblems(REAL), []);
});

test('the first prefix a route starts with decides, and a route no prefix claims takes the fallback', () => {
  const table = {
    rules: [
      { prefix: '/a/b/', family: 'deep' },
      { prefix: '/a/', family: 'shallow' },
    ],
    fallback: { family: 'rest' },
  };
  assert.equal(matchRoute(table, '/a/b/c').family, 'deep');
  assert.equal(matchRoute(table, '/a/c').family, 'shallow');
  assert.equal(matchRoute(table, '/a').family, 'rest');
  assert.equal(matchRoute(table, '/').family, 'rest');
});

test('a pattern is compiled the way every consumer compiles it, so a bad one is found here first', () => {
  assert.ok(compilePattern('\\.test\\.mjs$').test('a.test.mjs'));
  assert.throws(() => compilePattern('('));
});

const SEMANTIC = [
  [
    'an earlier prefix that swallows a later one',
    (config) => {
      const [first, second, third, fourth, ...rest] = config.routeFamilies.rules;
      config.routeFamilies.rules = [fourth, first, second, third, ...rest];
    },
    '$.routeFamilies.rules[1].prefix',
    /"\/blog\/category\/" is unreachable: "\/blog\/" above it/,
  ],
  [
    'a prefix listed twice',
    (config) => config.routeFamilies.rules.push({ ...config.routeFamilies.rules[0] }),
    (config) => `$.routeFamilies.rules[${config.routeFamilies.rules.length - 1}].prefix`,
    /unreachable/,
  ],
  [
    'the article resources kept in the glossary collection',
    (config) => {
      config.content.formats.article.resourceCollection = 'glossary';
    },
    '$.content.formats.article.resourceCollection',
    /"glossary" already holds the entries of format "term"/,
  ],
  [
    'the article resources kept in the article collection',
    (config) => {
      config.content.formats.article.resourceCollection = 'post';
    },
    '$.content.formats.article.resourceCollection',
    /"post" already holds the entries of format "article"/,
  ],
  [
    'two formats written into one collection',
    (config) => {
      config.content.formats.term.collection = 'post';
    },
    '$.content.formats.term.collection',
    /"post" already holds the entries of format "article"/,
  ],
  [
    'a format whose prefix the route table gives to another family',
    (config) => {
      config.content.formats.article.routePrefix = '/faq/';
    },
    '$.content.formats.article.routePrefix',
    /belongs to family "faq-answer", and the writer needs "article"/,
  ],
  [
    'a format prefix with no closing slash',
    (config) => {
      config.content.formats.article.routePrefix = '/blog';
    },
    '$.content.formats.article.routePrefix',
    /must end with a slash/,
  ],
  [
    'a test pattern that is not a regular expression',
    (config) => {
      config.diff.testFilePattern = '(';
    },
    '$.diff.testFilePattern',
    /is not a regular expression/,
  ],
  [
    'a directory pattern that is not a regular expression',
    (config) => {
      config.diff.testDirectoryPattern = '[';
    },
    '$.diff.testDirectoryPattern',
    /is not a regular expression/,
  ],
  [
    'a strengthen band whose floor is above its ceiling',
    (config) => {
      config.demand.strengthenBand.min = 31;
    },
    '$.demand.strengthenBand.min',
    /31 is above demand.strengthenBand.max 30/,
  ],
  [
    'a prose directory that sits inside a shipped one',
    (config) => {
      config.diff.proseDirectories.push('site/src/docs/');
    },
    '$.diff.proseDirectories[5]',
    /"site\/src\/docs\/" overlaps "site\/src\/" in diff.shippedDirectories/,
  ],
  [
    'an automation directory that holds a shipped one',
    (config) => {
      config.diff.automationDirectories.push('site/');
    },
    '$.diff.shippedDirectories[0]',
    /"site\/src\/" overlaps "site\/" in diff.automationDirectories/,
  ],
  [
    'a content directory outside every shipped directory',
    (config) => {
      config.content.dataDirectory = 'content';
    },
    '$.content.dataDirectory',
    /"content" is not inside a diff.shippedDirectories entry, so the entries the writer commits would classify as prose/,
  ],
  [
    'a content directory that only shares a prefix with a shipped one',
    (config) => {
      config.content.dataDirectory = 'site/srcs/data';
    },
    '$.content.dataDirectory',
    /is not inside a diff.shippedDirectories entry/,
  ],
];

for (const [label, plant, path, pattern] of SEMANTIC) {
  test(`${label} is named at its field`, () => {
    const config = clone();
    plant(config);
    const expected = typeof path === 'function' ? path(config) : path;
    const found = consistencyProblems(config).find((problem) => problem.path === expected);
    assert.ok(found, `no problem at ${expected}`);
    assert.match(found.problem, pattern);
  });
}

const withTimes = (writeTimesUtc) => ({ ...clone(), loop: { ...clone().loop, writeTimesUtc } });

test('an entry that is not a time of day is never also called a repeat, so each bad entry has one message', () => {
  const found = consistencyProblems(withTimes(['noon', 'noon', '03:17']));
  assert.deepEqual(
    found.map(({ path }) => path),
    ['$.loop.writeTimesUtc[0]', '$.loop.writeTimesUtc[1]']
  );
  for (const { problem } of found) assert.match(problem, /^"noon" is not a time of day/);
});

test('a repeat is named at its later position and points back at the first', () => {
  const [found] = consistencyProblems(withTimes(['15:17', '03:17', '15:17']));
  assert.equal(found.path, '$.loop.writeTimesUtc[2]');
  assert.match(found.problem, /^"15:17" is already at loop\.writeTimesUtc\[0\]/);
});

test('the time of day pattern is the one every consumer of the schedule shares', () => {
  for (const time of ['00:00', '09:05', '23:59']) assert.match(time, TIME_OF_DAY);
  for (const time of ['24:00', '12:60', '9:05', '09:5', '0900', '09:05:00', ' 09:05', '09:05\n'])
    assert.doesNotMatch(time, TIME_OF_DAY);
});
