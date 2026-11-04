import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  GREEN,
  change,
  chunk,
  firstQueryLine,
  page,
  problemsOf,
  scratch,
  withDist,
  without,
} from './fixtures/search-budget-world.mjs';
import { FAMILIES, manifestFamilies } from './mutation-smoke.mjs';
import { SPECIMENS, proveWithSpecimen } from './mutation-specimens.mjs';
import { FIRST_QUERY_BUDGET_BYTES, firstQueryWorstCase, searchIndexProblems } from './search-budget.mjs';

const SCRIPT = fileURLToPath(new URL('./search-budget.mjs', import.meta.url));

const cli = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

test('the command prints one summary line and exits 0 on a good index, from the directory it is given or from dist', () => {
  const { site, dist, discard } = scratch(GREEN.files);

  try {
    const summary = `search-index: ${GREEN.files.size} files, first query worst case ${firstQueryWorstCase(dist)} bytes gz (cap ${FIRST_QUERY_BUDGET_BYTES})\n`;
    const named = cli(dist);
    assert.equal(named.status, 0, named.stderr);
    assert.equal(named.stdout, summary);

    const defaulted = spawnSync(process.execPath, [SCRIPT], { cwd: site, encoding: 'utf8' });
    assert.equal(defaulted.status, 0, defaulted.stderr);
    assert.equal(defaulted.stdout, summary);
  } finally {
    discard();
  }
});

test('the command prints one search-index line per violation and exits 1, and no summary', () => {
  const broken = change(without(GREEN.files, chunk(3)), page(0), '[{');
  const expected = problemsOf(broken);
  assert.equal(expected.length, 2);

  withDist(broken, (dist) => {
    const { status, stdout } = cli(dist);

    assert.equal(status, 1);
    assert.deepEqual(stdout.trimEnd().split('\n'), expected);
    assert.ok(expected.every((line) => line.startsWith('search-index: ')));
  });
});

test('the command refuses a dist with no index instead of passing an empty one', () => {
  withDist(new Map(), (dist) => {
    const { status, stdout } = cli(dist);

    assert.equal(status, 1);
    assert.equal(stdout, 'search-index: /search-index/manifest.json is missing\n');
  });
});

const gateRun = (_command, _args, cwd) => {
  const { status, stdout, stderr } = cli(join(cwd, 'dist'));
  return { code: status, output: `${stdout}${stderr}` };
};

const snapshot = (dist) =>
  new Map([...GREEN.files.keys()].map((path) => [path, readFileSync(join(dist, path), 'utf8')]));

test('the search specimen belongs to gate:search, and its token is the wording the guard prints over the first query budget', () => {
  assert.equal(SPECIMENS.search.gate, 'gate:search');
  assert.equal(SPECIMENS.search.token, `bytes gz (over ${FIRST_QUERY_BUDGET_BYTES})`);
  assert.ok(firstQueryLine(FIRST_QUERY_BUDGET_BYTES + 1).includes(SPECIMENS.search.token));
});

test('the search specimen puts body-sized text in every row of the first page, touches nothing else and restores byte for byte', async () => {
  const { site, dist, discard } = scratch(GREEN.files);

  try {
    const restore = await SPECIMENS.search.plant(site);
    const planted = snapshot(dist);
    const changed = [...planted].filter(([path, text]) => text !== GREEN.files.get(path)).map(([path]) => path);
    const rows = JSON.parse(planted.get(page(0)));

    assert.deepEqual(changed, [page(0)]);
    assert.equal(rows.length, GREEN.manifest.pageSize);
    for (const row of rows) {
      assert.equal(row.length, 4);
      assert.ok(row[3].length >= 10_000);
    }
    assert.ok(firstQueryWorstCase(dist) > FIRST_QUERY_BUDGET_BYTES);
    assert.ok(searchIndexProblems(dist).some((line) => line.includes(SPECIMENS.search.token)));

    await restore();
    assert.deepEqual(snapshot(dist), GREEN.files);
  } finally {
    discard();
  }
});

test('the search specimen is proven the way mutation smoke proves it: green on the index, red with the plant and its token, green again', async () => {
  const { site, dist, discard } = scratch(GREEN.files);

  try {
    const outcome = await proveWithSpecimen(SPECIMENS.search, { copySite: site, run: gateRun });

    assert.equal(outcome.ok, true, outcome.reason);
    assert.deepEqual(snapshot(dist), GREEN.files);
    assert.equal(gateRun('npm', ['run', 'gate:search'], site).code, 0);
  } finally {
    discard();
  }
});

test('the mutation smoke row for the search guard is named for what it proves and runs the search specimen', () => {
  const families = manifestFamilies(FAMILIES);

  assert.deepEqual(
    families.filter((family) => family.specimen === 'search'),
    [{ id: 'search-index-grows-with-corpus', kind: 'specimen', specimen: 'search' }]
  );
  assert.equal(families.filter((family) => family.id === 'search-shard-over-budget').length, 0);
});
