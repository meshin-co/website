import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { HANDLED_PATH, readingOf } from './keyword-handled.mjs';

const REPO = new URL('../../', import.meta.url);
const ledger = readFileSync(new URL(HANDLED_PATH, REPO), 'utf8');
const routes = new Set(JSON.parse(readFileSync(new URL('audits/routes.json', REPO), 'utf8')));

test('the committed ledger of handled keyword pairs has no problem a reader would trip on', () => {
  assert.deepEqual(readingOf(ledger).problems, []);
});

test('every committed handled pair names a route the site builds, so a record cannot point at a page that is gone', () => {
  const unknown = readingOf(ledger)
    .rows.filter(({ route }) => !routes.has(route))
    .map(({ phrase, route }) => `"${phrase}" -> ${route}`);
  assert.deepEqual(unknown, []);
});
