import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recordPath } from './record-layout.mjs';
import { dispositionFor } from './route-derive.mjs';
import { claimOf } from './fixtures/entry-drafts.mjs';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
const CLAIMED = claimOf('term').claimedAt;

test('the row has the keys and the order of the dispositions the repository already holds', () => {
  const directory = join(REPO, 'audits/phase-4.7/dispositions');
  const live = JSON.parse(
    readFileSync(
      join(
        directory,
        readdirSync(directory).find((name) => name === 'faq.json')
      ),
      'utf8'
    )
  );
  const row = dispositionFor({
    claimPath: recordPath('claim', 'x', CLAIMED),
    generationPath: recordPath('generation', 'x', CLAIMED),
    target: 'src/data/glossary/x.md',
    digest: 'a'.repeat(12),
    runDate: '2026-11-02',
  });

  assert.deepEqual(Object.keys(row), Object.keys(live[0]));
});
