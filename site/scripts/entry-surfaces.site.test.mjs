import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import { surfacesOf } from './entry-surfaces.mjs';
import { ROUTE_LEDGER } from './route-ledger.mjs';
import { corpusFiles } from './spend-report.mjs';
import { corpusOf, reportModel } from './spend-report-model.mjs';

const ORIGIN = 'https://site.test';
const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');

test('the page address of every entry the writer committed is a route of the committed route ledger, so its form is the one the build serves', () => {
  const { rows } = reportModel(corpusOf(corpusFiles(REPOSITORY_ROOT)), { at: '2026-11-03T09:00:00.000Z' });
  const ledger = new Set(JSON.parse(readFileSync(resolve(REPOSITORY_ROOT, ROUTE_LEDGER), 'utf8')));
  assert.ok(rows.length >= 1);
  for (const { format, slug } of rows) {
    const [page] = surfacesOf({ format, slug, origin: ORIGIN });
    assert.equal(ledger.has(new URL(page.url).pathname), true, page.url);
  }
});
