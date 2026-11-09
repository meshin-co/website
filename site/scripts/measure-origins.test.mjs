import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ORIGINS } from './autowriter-claims.mjs';
import { buildRecord } from './generation-record.mjs';
import { recordPath } from './record-layout.mjs';
import {
  callOf,
  categoryInput,
  orderedPromptInput,
  orderedTitleInput,
  recordInput,
  weakDemandInput,
} from './fixtures/generation-input.mjs';
import { run } from './measure-origins.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_ROOT = join(HERE, '..', '..');
const SCRIPT = join(HERE, 'measure-origins.mjs');

const INPUTS = {
  demand: recordInput,
  'weak-demand': weakDemandInput,
  category: categoryInput,
  ordered: orderedPromptInput,
};

function recordOf({ origin = 'demand', input = INPUTS[origin], slug, at, explicit = false, extra = {} }) {
  const base = input();
  const entryPath = 'site/src/data/post/' + slug + '.md';
  const claim = { ...base.claim, slug, ...(explicit ? { origin } : {}), ...extra };
  return buildRecord({
    ...base,
    claim,
    route: '/blog/' + slug,
    entryPath,
    generatedAt: at,
    files: [entryPath, recordPath('generation', slug, at)],
  });
}

function plant(root, record) {
  const path = join(root, recordPath('generation', record.slug, record.generatedAt));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(record, null, 2) + '\n');
  return path;
}

function plantEntry(root, slug, publishDate) {
  const path = join(root, 'site', 'src', 'data', 'post', slug + '.md');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, '---\ntitle: x\npublishDate: ' + publishDate + '\n---\n\nbody\n');
}

function measure(root) {
  const out = [];
  const err = [];
  const code = run({ repoRoot: root, out: (line) => out.push(line), err: (line) => err.push(line) });
  return { code, out, err };
}

const cellsOf = (line) => line.trim().split(/\s{2,}/);
const rowOf = (lines, first) => cellsOf(lines.find((line) => line.startsWith(first + '  ')));

function withRoot(body) {
  const root = mkdtempSync(join(tmpdir(), 'measure-origins-'));
  try {
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function mixedTree(root) {
  plant(root, recordOf({ slug: 'a-demand-entry', at: '2026-11-02T07:00:00.000Z', explicit: true }));
  plant(root, recordOf({ slug: 'a-legacy-entry', at: '2026-11-02T08:00:00.000Z' }));
  plant(root, recordOf({ origin: 'weak-demand', slug: 'a-weak-entry', at: '2026-11-03T07:00:00.000Z' }));
  plant(root, recordOf({ origin: 'category', slug: 'a-category-entry', at: '2026-11-03T08:00:00.000Z' }));
  plantEntry(root, 'a-weak-entry', '2026-11-05');
}

function orderedTree(root) {
  mixedTree(root);
  plant(root, recordOf({ origin: 'ordered', slug: 'an-ordered-prompt-entry', at: '2026-11-04T07:00:00.000Z' }));
  plant(
    root,
    recordOf({
      origin: 'ordered',
      input: orderedTitleInput,
      slug: 'an-ordered-title-entry',
      at: '2026-11-04T08:00:00.000Z',
    })
  );
}

function snapshot(root) {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const path = join(entry.parentPath, entry.name);
      return [path, readFileSync(path, 'utf8')];
    })
    .sort(([left], [right]) => left.localeCompare(right));
}

test('with no records it prints 0 entries and exits 0', () => {
  withRoot((root) => {
    const { code, out, err } = measure(root);
    assert.equal(code, 0);
    assert.deepEqual(out, ['0 entries']);
    assert.deepEqual(err, []);
  });
});

test('the origin table counts entries, calls, tokens and cost, and reads an absent origin as demand', () => {
  withRoot((root) => {
    mixedTree(root);
    const { code, out, err } = measure(root);
    assert.deepEqual(err, []);
    assert.equal(code, 0);
    assert.equal(out[0], '4 entries');
    assert.deepEqual(rowOf(out, 'demand'), [
      ...['demand', '2', '4', '60000'],
      ...['0.0000', '0.1000', '0.0000', '0.1000', '0.0500'],
    ]);
    assert.deepEqual(rowOf(out, 'weak-demand'), [
      ...['weak-demand', '1', '2', '30000'],
      ...['0.0000', '0.0500', '0.0000', '0.0500', '0.0500'],
    ]);
    assert.deepEqual(rowOf(out, 'category'), [
      ...['category', '1', '3', '31860'],
      ...['0.0021', '0.0500', '0.0000', '0.0521', '0.0521'],
    ]);
    assert.deepEqual(rowOf(out, 'all'), [
      ...['all', '4', '9', '121860'],
      ...['0.0021', '0.2000', '0.0000', '0.2021', '0.0505'],
    ]);
  });
});

test('a repair call is shown apart from the topic and writing cost', () => {
  withRoot((root) => {
    const record = recordOf({ slug: 'a-repaired-entry', at: '2026-11-02T07:00:00.000Z' });
    const repair = callOf('repair', { input: 10000, output: 1000 }, 'repair');
    record.calls = [...record.calls, repair];
    record.totals = {
      tokens: { input: record.totals.tokens.input + 10000, output: record.totals.tokens.output + 1000 },
      costUsd: Math.round((record.totals.costUsd + repair.costUsd) * 1e6) / 1e6,
    };
    plant(root, record);
    const { code, err, out } = measure(root);
    assert.deepEqual(err, []);
    assert.equal(code, 0);
    assert.deepEqual(rowOf(out, 'demand').slice(4, 8), ['0.0000', '0.0500', '0.0150', '0.0650']);
  });
});

test('weak-demand entries are counted per weakness reason', () => {
  withRoot((root) => {
    mixedTree(root);
    plant(
      root,
      recordOf({
        origin: 'weak-demand',
        slug: 'another-weak-entry',
        at: '2026-11-03T09:00:00.000Z',
        extra: { weakness: ['no-buyer-prompt', 'impressions-at-floor'], demand: { impressions: 5, position: 40 } },
      })
    );
    const { out } = measure(root);
    assert.deepEqual(rowOf(out, 'no-buyer-prompt'), ['no-buyer-prompt', '2']);
    assert.deepEqual(rowOf(out, 'impressions-at-floor'), ['impressions-at-floor', '1']);
    assert.deepEqual(rowOf(out, 'position-beyond-strengthen-band'), ['position-beyond-strengthen-band', '0']);
  });
});

test('category entries are counted per category, every category listed', () => {
  withRoot((root) => {
    mixedTree(root);
    const { out } = measure(root);
    assert.deepEqual(rowOf(out, 'governance'), ['governance', '1']);
    assert.deepEqual(rowOf(out, 'agentic-architecture'), ['agentic-architecture', '0']);
    assert.deepEqual(rowOf(out, 'operating-model'), ['operating-model', '0']);
    assert.deepEqual(rowOf(out, 'executive'), ['executive', '0']);
  });
});

test('the rewrite list holds only entries without a buyer prompt, oldest first, by publish or written date', () => {
  withRoot((root) => {
    mixedTree(root);
    const { out } = measure(root);
    const start = out.findIndex((line) => line.startsWith('written without a buyer prompt'));
    assert.notEqual(start, -1);
    assert.deepEqual(out.slice(start + 1).map(cellsOf), [
      ['slug', 'origin', 'category or weakness', 'date'],
      ['a-category-entry', 'category', 'governance', '2026-11-03'],
      ['a-weak-entry', 'weak-demand', 'no-buyer-prompt', '2026-11-05'],
    ]);
  });
});

test('an ordered entry counts in the ordered row, whether it was ordered by prompt or by title', () => {
  withRoot((root) => {
    orderedTree(root);
    const { code, out, err } = measure(root);
    assert.deepEqual(err, []);
    assert.equal(code, 0);
    assert.equal(out[0], '6 entries');
    assert.deepEqual(
      out.slice(2, 8).map((line) => cellsOf(line)[0]),
      ['origin', 'demand', 'weak-demand', 'category', 'ordered', 'all']
    );
    assert.deepEqual(rowOf(out, 'ordered'), [
      ...['ordered', '2', '4', '60000'],
      ...['0.0000', '0.1000', '0.0000', '0.1000', '0.0500'],
    ]);
    assert.equal(rowOf(out, 'demand')[1], '2');
  });
});

test('the rewrite list holds an ordered entry only when it was ordered by title, and shows no category or weakness for it', () => {
  withRoot((root) => {
    orderedTree(root);
    const { out } = measure(root);
    const start = out.findIndex((line) => line.startsWith('written without a buyer prompt'));
    assert.notEqual(start, -1);
    assert.deepEqual(out.slice(start + 1).map(cellsOf), [
      ['slug', 'origin', 'category or weakness', 'date'],
      ['a-category-entry', 'category', 'governance', '2026-11-03'],
      ['an-ordered-title-entry', 'ordered', '2026-11-04'],
      ['a-weak-entry', 'weak-demand', 'no-buyer-prompt', '2026-11-05'],
    ]);
  });
});

test('with only demand entries the rewrite list says none', () => {
  withRoot((root) => {
    plant(root, recordOf({ slug: 'a-legacy-entry', at: '2026-11-02T08:00:00.000Z' }));
    const { code, out } = measure(root);
    assert.equal(code, 0);
    assert.equal(out.at(-1), 'none');
  });
});

test('an invalid record is an error naming its file, exit 1, and no table', () => {
  withRoot((root) => {
    plant(root, recordOf({ slug: 'a-legacy-entry', at: '2026-11-02T08:00:00.000Z' }));
    const bad = recordOf({ slug: 'a-broken-entry', at: '2026-11-02T09:00:00.000Z' });
    plant(root, { ...bad, totals: { tokens: { input: 1, output: 1 }, costUsd: 9 } });
    const { code, out, err } = measure(root);
    assert.equal(code, 1);
    assert.deepEqual(out, []);
    assert.equal(err.length, 1);
    assert.match(err[0], /a-broken-entry\.json/);
  });
});

test('a record that is not JSON is an error naming its file', () => {
  withRoot((root) => {
    const path = plant(root, recordOf({ slug: 'a-legacy-entry', at: '2026-11-02T08:00:00.000Z' }));
    writeFileSync(path, '{ not json');
    const { code, err } = measure(root);
    assert.equal(code, 1);
    assert.match(err[0], /a-legacy-entry\.json/);
  });
});

test('the measure writes no file', () => {
  withRoot((root) => {
    mixedTree(root);
    const before = snapshot(root);
    measure(root);
    assert.deepEqual(snapshot(root), before);
  });
});

test('bad usage exits 2 and prints the usage', () => {
  for (const args of [['--write'], ['one', 'two']]) {
    const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /usage: node scripts\/measure-origins\.mjs/);
    assert.equal(result.stdout, '');
  }
});

test('over the committed tree it exits 0 and every entry is counted under exactly one known origin', () => {
  const { code, out, err } = measure(REAL_ROOT);
  assert.deepEqual(err, []);
  assert.equal(code, 0);
  const total = Number(out[0].split(' ')[0]);
  assert.ok(total >= 2, out[0]);
  const counted = ORIGINS.map((origin) => Number(rowOf(out, origin)[1]));
  assert.equal(
    counted.reduce((sum, count) => sum + count, 0),
    total,
    out.join('\n')
  );
  assert.equal(Number(rowOf(out, 'all')[1]), total);
});
