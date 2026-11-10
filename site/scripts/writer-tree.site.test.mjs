import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { routeList } from './writer-tree.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));

test('routeList equals the live file', () => {
  assert.deepEqual(routeList(REPO), JSON.parse(readFileSync(join(REPO, 'audits/routes.json'), 'utf8')));
});
