import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import {
  ENGINE_CONFIG_FILE,
  EngineConfigError,
  inspectEngineConfig,
  matchRoute,
  readEngineConfig,
} from './engine-config.mjs';

const REPOSITORY = resolve(import.meta.dirname, '..', '..');
const REAL_TEXT = readFileSync(ENGINE_CONFIG_FILE, 'utf8');
const REMOVE = Symbol('remove');

const mutated = (path, value) => {
  const config = JSON.parse(REAL_TEXT);
  const keys = path.split('.');
  const last = keys.pop();
  const holder = keys.reduce((node, key) => node[key], config);
  if (value === REMOVE) delete holder[last];
  else holder[last] = value;
  return config;
};

const inspected = (config) => inspectEngineConfig(JSON.stringify(config));
const namesField = (problems, field) => problems.some(({ path }) => path === `$.${field}`);

const leafPaths = (node, prefix = '') =>
  Object.entries(node).flatMap(([key, value]) =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? leafPaths(value, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  );

test('the real configuration loads, and what it returns cannot be changed by a consumer', () => {
  const config = readEngineConfig();
  assert.deepEqual(Object.keys(config), ['schema', 'diff', 'routeFamilies', 'content', 'loop', 'demand']);
  assert.throws(() => {
    config.loop.attemptCap = 99;
  }, TypeError);
  assert.throws(() => (config.content.formats.article.author = 'x'), TypeError);
  assert.equal(config.loop.attemptCap, 3);
  assert.deepEqual(config.loop.writeTimesUtc, ['03:17', '15:17']);
  assert.deepEqual(config.loop.categoryRotation, [
    'governance',
    'agentic-architecture',
    'operating-model',
    'executive',
  ]);
  assert.throws(() => config.loop.writeTimesUtc.push('01:01'), TypeError);
  assert.throws(() => config.loop.categoryRotation.push('legal'), TypeError);
});

test('the file is found from the module, so the working directory never decides', () => {
  const probe =
    "import('./site/scripts/engine-config.mjs').then((m) => console.log(m.readEngineConfig().loop.holdLabel))";
  for (const cwd of [REPOSITORY, resolve(REPOSITORY, 'site'), tmpdir()]) {
    const run = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', probe.replace('./site/scripts/', `${REPOSITORY}/site/scripts/`)],
      {
        cwd,
        encoding: 'utf8',
      }
    );
    assert.equal(run.status, 0, `from ${cwd}: ${run.stderr}`);
    assert.equal(run.stdout.trim(), 'autowriter-hold');
  }
});

const leaves = leafPaths(JSON.parse(REAL_TEXT));

test('the real file has leaves to remove, so the loop below proves something', () => {
  assert.ok(leaves.length >= 25, `only ${leaves.length} leaves`);
});

for (const field of leaves) {
  test(`removing ${field} fails naming the field, and nothing derives it from another`, () => {
    const { config, problems } = inspected(mutated(field, REMOVE));
    assert.equal(config, null);
    assert.ok(namesField(problems, field), `${field} not named in ${JSON.stringify(problems)}`);
  });
}

test('a missing field fails the load naming the field and the file', () => {
  const root = mkdtempSync(join(tmpdir(), 'engine-config-'));
  try {
    const file = join(root, 'engine.config.json');
    writeFileSync(file, JSON.stringify(mutated('loop.quarantineHours', REMOVE)));
    assert.throws(
      () => readEngineConfig(file),
      (error) => {
        assert.ok(error instanceof EngineConfigError);
        assert.equal(error.file, file);
        assert.deepEqual(error.fields, ['loop.quarantineHours']);
        assert.equal(error.message, `${file}: loop.quarantineHours is required`);
        return true;
      }
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a file that is absent or is not JSON fails the load naming the file', () => {
  const root = mkdtempSync(join(tmpdir(), 'engine-config-'));
  try {
    const absent = join(root, 'absent.json');
    assert.throws(
      () => readEngineConfig(absent),
      (error) => error.message.startsWith(`${absent}: the file cannot be read`)
    );
    const broken = join(root, 'broken.json');
    writeFileSync(broken, '{ "schema": 1,');
    assert.throws(
      () => readEngineConfig(broken),
      (error) => error.message.startsWith(`${broken}: the file is not valid JSON`)
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const MALFORMED = [
  ['schema', 2, 'must equal 1'],
  ['loop.attemptCap', '3', 'must be of type integer'],
  ['loop.attemptCap', 0, 'must be >= 1'],
  ['loop.quarantineHours', 0.5, 'must be of type integer'],
  ['loop.monthlySpendCeilingUsd', 0, 'must be >= 0.01'],
  ['loop.claimLifetimeDays', -1, 'must be >= 1'],
  ['loop.holdLabel', '', 'must have at least 1 characters'],
  ['loop.holdLabel', 'a,b', 'must match pattern'],
  ['diff.proseDirectories', ['docs'], 'must match pattern'],
  ['diff.proseDirectories', ['../docs/'], 'must match pattern'],
  ['diff.proseDirectories', ['docs/', 'docs/'], 'must have unique items'],
  ['diff.shippedDirectories', [], 'must have at least 1 items'],
  ['diff.proseExtensions', ['md'], 'must match pattern'],
  ['diff.testTooling', ['site/./playwright.config.ts'], 'must match pattern'],
  ['diff.testFilePattern', '', 'must have at least 1 characters'],
  ['content.dataDirectory', '/site/src/data', 'must match pattern'],
  ['content.dataDirectory', 'site/src/data/', 'must match pattern'],
  ['content.formats.article.resourceCollection', 'Resource', 'must match pattern'],
  ['routeFamilies.fallback.family', 'blog', 'must be one of'],
  ['routeFamilies.fallback.profile', 'blog', 'must be one of'],
  ['content.formats.article.routePrefix', 'blog/', 'must match pattern'],
  ['routeFamilies.rules', [], 'must have at least 1 items'],
  ['routeFamilies.fallback.family', 'Static', 'must match pattern'],
  ['demand.windowDays', 0, 'must be >= 1'],
  ['demand.dataLagDays', -1, 'must be >= 0'],
  ['demand.strengthenBand.min', 0, 'must be >= 1'],
  ['demand.minImpressions', 1.5, 'must be of type integer'],
  ['content.formats.article.author', 'Dmitri', 'must match pattern'],
  ['content.formats.article.collection', '', 'must match pattern'],
  ['loop.categoryRotation', ['governance', 'governance'], 'must have unique items'],
  ['loop.categoryRotation', 'governance', 'must be of type array'],
  ['loop.categoryRotation', ['Governance'], 'must match pattern'],
  ['loop.categoryRotation', [7], 'must be of type string'],
];

for (const [field, value, problem] of MALFORMED) {
  test(`${field} set to ${JSON.stringify(value)} fails naming the field`, () => {
    const { config, problems } = inspected(mutated(field, value));
    assert.equal(config, null);
    assert.ok(
      problems.some(
        (found) =>
          (found.path === `$.${field}` || found.path.startsWith(`$.${field}[`)) && found.problem.includes(problem)
      ),
      `expected "${field} ${problem}" in ${JSON.stringify(problems)}`
    );
  });
}

test('an empty category rotation is legal and turns the fallback off, so the loop keeps its older behaviour', () => {
  const { config, problems } = inspected(mutated('loop.categoryRotation', []));
  assert.deepEqual(problems, []);
  assert.deepEqual(config.loop.categoryRotation, []);
});

const WRITE_TIMES = [
  [['3:17', '15:17'], '$.loop.writeTimesUtc[0]', /^"3:17" is not a time of day/],
  [['03:17', '24:00'], '$.loop.writeTimesUtc[1]', /^"24:00" is not a time of day/],
  [['12:60'], '$.loop.writeTimesUtc[0]', /^"12:60" is not a time of day/],
  [['03:17', '15:17', 'noon'], '$.loop.writeTimesUtc[2]', /^"noon" is not a time of day/],
  [['03:17', 317], '$.loop.writeTimesUtc[1]', /^317 is not a time of day/],
  [['03:17', null], '$.loop.writeTimesUtc[1]', /^null is not a time of day/],
  [['03:17 '], '$.loop.writeTimesUtc[0]', /^"03:17 " is not a time of day/],
  [['03:17', '15:17', '03:17'], '$.loop.writeTimesUtc[2]', /^"03:17" is already at loop\.writeTimesUtc\[0\]/],
  [[], '$.loop.writeTimesUtc', /^lists no time.*pause the writer.*disable the Write daily workflow.*secret.*unset/],
  ['03:17', '$.loop.writeTimesUtc', /^"03:17" is not a list of times/],
  [{ first: '03:17' }, '$.loop.writeTimesUtc', /^\{"first":"03:17"\} is not a list of times/],
  [null, '$.loop.writeTimesUtc', /^null is not a list of times/],
];

for (const [value, path, message] of WRITE_TIMES) {
  test(`loop.writeTimesUtc set to ${JSON.stringify(value)} is refused at load with one message at ${path}`, () => {
    const { config, problems } = inspected(mutated('loop.writeTimesUtc', value));
    assert.equal(config, null);
    assert.equal(problems.length, 1, JSON.stringify(problems));
    assert.equal(problems[0].path, path);
    assert.match(problems[0].problem, message);
  });
}

test('a refused schedule names every bad entry at once, so one edit fixes the file', () => {
  const { problems } = inspected(mutated('loop.writeTimesUtc', ['3:17', '15:17', '25:00', '15:17']));
  assert.deepEqual(
    problems.map(({ path }) => path),
    ['$.loop.writeTimesUtc[0]', '$.loop.writeTimesUtc[2]', '$.loop.writeTimesUtc[3]']
  );
});

test('the times the engine accepts run from 00:00 to 23:59 and a single time is a schedule', () => {
  for (const times of [['00:00'], ['23:59'], ['00:00', '23:59'], ['09:05', '12:30', '19:45']]) {
    assert.deepEqual(inspected(mutated('loop.writeTimesUtc', times)).problems, [], times.join(' '));
  }
});

test('an unreadable schedule reaches the consumer as the load error, naming the file, the position and the value', () => {
  const root = mkdtempSync(join(tmpdir(), 'engine-config-'));
  try {
    const file = join(root, 'engine.config.json');
    writeFileSync(file, JSON.stringify(mutated('loop.writeTimesUtc', ['03:17', '7:5'])));
    assert.throws(
      () => readEngineConfig(file),
      (error) => {
        assert.ok(error instanceof EngineConfigError);
        assert.deepEqual(error.fields, ['loop.writeTimesUtc[1]']);
        assert.ok(error.message.startsWith(`${file}: loop.writeTimesUtc[1] "7:5" is not a time of day`), error.message);
        return true;
      }
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a key the schema does not know is refused by name, so a typo cannot pass for a setting', () => {
  const { problems } = inspected({
    ...mutated('loop.attemptCap', 3),
    loop: { ...JSON.parse(REAL_TEXT).loop, attemptcap: 3 },
  });
  assert.deepEqual(problems, [{ path: '$.loop.attemptcap', problem: 'has an unexpected key' }]);
});

const family = (route) => matchRoute(readEngineConfig().routeFamilies, route);

test('one table gives both the title family and the content profile of a route', () => {
  const expected = [
    ['/blog/category/governance', 'blog-category', 'page'],
    ['/blog/why-your-ai-pilot-never-reached-production', 'article', 'article'],
    ['/blog', 'static', 'page'],
    ['/blog/tags', 'tag-index', 'page'],
    ['/blog/tag/shadow-ai', 'tag', 'page'],
    ['/services/90-day-production-sprint', 'service', 'offer'],
    ['/resources/ai-governance-starter-kit', 'resource', 'offer'],
    ['/case-studies/example-case', 'case-study', 'offer'],
    ['/glossary/ai-register', 'term', 'term'],
    ['/glossary', 'static', 'page'],
    ['/faq/how-do-you-charge-for-the-work', 'faq-answer', 'faq-answer'],
    ['/pricing', 'static', 'page'],
    ['/', 'static', 'page'],
  ];
  for (const [route, familyName, profile] of expected) {
    const found = family(route);
    assert.deepEqual([found.family, found.profile], [familyName, profile], route);
  }
});

test('a file that reads well but contradicts itself is refused by the cross checks, naming the field', () => {
  const { config, problems } = inspected(mutated('content.formats.article.resourceCollection', 'post'));
  assert.equal(config, null);
  assert.deepEqual(problems, [
    {
      path: '$.content.formats.article.resourceCollection',
      problem: '"post" already holds the entries of format "article"',
    },
  ]);
});

test('the cross checks run only on a file of the right shape, so they never report on a half-read file', () => {
  const { problems } = inspected(mutated('content.formats', REMOVE));
  assert.deepEqual(problems, [{ path: '$.content.formats', problem: 'is required' }]);
});
