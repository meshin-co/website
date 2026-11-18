import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import { mainWriteFindings } from './main-write-scan.mjs';

const REPOSITORY = resolve(import.meta.dirname, '..', '..');
const WORKFLOWS = '.github/workflows';
const SCRIPTS = 'site/scripts';
const WRITE_DAILY = `${WORKFLOWS}/write-daily.yml`;
const MEASURE_KEYWORDS = `${WORKFLOWS}/measure-keywords.yml`;
const REMOVED = 'removed-commit-script';

const filesIn = (directory, accepts) =>
  readdirSync(join(REPOSITORY, directory))
    .filter(accepts)
    .sort()
    .map((name) => ({ path: `${directory}/${name}`, text: readFileSync(join(REPOSITORY, directory, name), 'utf8') }));

const found = mainWriteFindings([
  ...filesIn(WORKFLOWS, (name) => /\.ya?ml$/.test(name)),
  ...filesIn(SCRIPTS, (name) => name.endsWith('.mjs') && !name.endsWith('.test.mjs')),
]);

const inside = (directory) => found.filter(({ path }) => path.startsWith(`${directory}/`));

test('the five workflow lines that still call commit-to-main are every workflow line that writes to main', () => {
  assert.deepEqual(
    inside(WORKFLOWS).map(({ path, rule }) => [path, rule]),
    [
      [MEASURE_KEYWORDS, REMOVED],
      [WRITE_DAILY, REMOVED],
      [WRITE_DAILY, REMOVED],
      [WRITE_DAILY, REMOVED],
      [WRITE_DAILY, REMOVED],
    ]
  );
});

test('no script but commit-to-main itself trips the scan, so no importer of it is left behind', () => {
  assert.deepEqual([...new Set(inside(SCRIPTS).map(({ path }) => path))], [`${SCRIPTS}/commit-to-main.mjs`]);
});
