import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { after, afterEach, test } from 'node:test';

import { DRAFTS } from './fixtures/entry-drafts.mjs';
import {
  ENTRY,
  landedRepo,
  pathsOf,
  read,
  removeRepos,
  removeTemplates,
  repair,
  REPAIRED,
  repairRun,
  textOf,
  treeOf,
} from './fixtures/repair-repo.mjs';
import { collectRoutes } from './routes-gate.mjs';
import { WriterError } from './writer-error.mjs';

afterEach(removeRepos);
after(removeTemplates);

const LEDGER = 'audits/routes.json';
const withFields = (changes) => ({ ...REPAIRED, fields: { ...REPAIRED.fields, ...changes } });

test('a repair that adds a tag carries the route ledger with the tag page it makes', async () => {
  const root = await landedRepo();
  const draft = withFields({ tags: [...DRAFTS.article.fields.tags, 'incident-response'] });

  const result = await repair(root, repairRun(root), { draft });

  assert.ok(pathsOf(result).includes(LEDGER), `the repair carries ${pathsOf(result).join(', ')}`);
  const carried = JSON.parse(textOf(result, LEDGER));
  assert.ok(carried.includes('/blog/tag/incident-response'));
  assert.deepEqual(carried, collectRoutes(join(root, 'site', 'dist')));
});

test('a repair that leaves every route as it was does not carry the ledger', async () => {
  const root = await landedRepo();

  const result = await repair(root, repairRun(root));

  assert.ok(!pathsOf(result).includes(LEDGER));
  assert.ok(pathsOf(result).includes(ENTRY));
});

test('a repair that moves the entry out of its only category is refused, because the category page would drop unexplained', async () => {
  const root = await landedRepo();
  const before = treeOf(root);
  const draft = withFields({ category: 'executive' });

  await assert.rejects(repair(root, repairRun(root), { draft }), (error) => {
    assert.ok(error instanceof WriterError && error.kind === 'build', error.message);
    assert.match(error.message, /drops \/blog\/category\/governance/);
    return true;
  });

  assert.deepEqual(treeOf(root), before);
  assert.ok(read(root, LEDGER).includes('/blog/category/governance'));
});
