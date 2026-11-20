import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  LEGACY_FILES,
  STATE_BRANCH,
  STATE_DIRECTORY,
  STATE_FILES,
  StateMissingError,
  hasState,
  isLegacyRecord,
  isStatePath,
  legacyFamilyOf,
  requireState,
} from './record-layout.mjs';

const SLUG = 'fractional-caio-vs-full-time-caio-cost';

function inTemp(check) {
  const root = mkdtempSync(join(tmpdir(), 'record-layout-state-'));
  try {
    return check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('the state branch and its folder have fixed names, and the three files that are no record sit in that folder', () => {
  assert.equal(STATE_BRANCH, 'autowriter-state');
  assert.equal(STATE_DIRECTORY, 'state');
  assert.deepEqual(STATE_FILES, {
    spendReport: 'state/spend-report.md',
    searchDemand: 'state/search-demand.md',
    keywordDemand: 'state/keyword-demand.md',
  });
  assert.ok(Object.isFrozen(STATE_FILES));
});

test('a state path is a plain path under state/, and never one that leaves it', () => {
  for (const good of [
    'state/ledger/2026/11/' + SLUG + '.json',
    'state/claims/2026/11/' + SLUG + '.json',
    STATE_FILES.spendReport,
    'state/README.md',
  ])
    assert.equal(isStatePath(good), true, good);
  for (const bad of [
    'state',
    'state/',
    'audits/spend-report.md',
    'state/../audits/routes.json',
    'state/./a.json',
    'state/.git/config',
    'state/ledger\\x.json',
    'statement/x.json',
    '/state/x.json',
    'site/state/x.json',
    '',
    null,
    7,
  ])
    assert.equal(isStatePath(bad), false, String(bad));
});

test('a folder is a state, and an absent path or a file is not', () => {
  inTemp((root) => {
    assert.equal(hasState(root), false);
    writeFileSync(join(root, STATE_DIRECTORY), 'not a folder\n');
    assert.equal(hasState(root), false);
  });
  inTemp((root) => {
    mkdirSync(join(root, STATE_DIRECTORY));
    assert.equal(hasState(root), true);
  });
});

test('hasState fails when the state cannot be inspected, so a broken tree is never read as an absent state', () => {
  assert.throws(() => hasState('\0'), { code: 'ERR_INVALID_ARG_VALUE' });
});

test('requireState refuses an absent state, and the refusal names the folder, the branch and the checkout', () => {
  inTemp((root) => {
    assert.throws(
      () => requireState(root),
      (error) => {
        assert.ok(error instanceof StateMissingError);
        assert.equal(error.name, 'StateMissingError');
        assert.match(error.message, new RegExp(STATE_DIRECTORY + '/'));
        assert.match(error.message, new RegExp(STATE_BRANCH));
        assert.match(error.message, /never read as an empty one/);
        assert.match(error.message, /git worktree add state autowriter-state/);
        return true;
      }
    );
  });
});

test('an empty state is not a missing one', () => {
  inTemp((root) => {
    mkdirSync(join(root, STATE_DIRECTORY));
    assert.doesNotThrow(() => requireState(root));
  });
});

test('a ledger or a claim filed in the layout that predates the state branch is legacy, and a generation record is not', () => {
  assert.equal(legacyFamilyOf('audits/autowriter/2026/11/' + SLUG + '.json'), 'ledger');
  assert.equal(legacyFamilyOf('audits/autowriter/' + SLUG + '.json'), 'ledger');
  assert.equal(legacyFamilyOf('audits/autowriter/claims/2026/11/' + SLUG + '.json'), 'claim');
  assert.equal(legacyFamilyOf('audits/autowriter/claims/' + SLUG + '.json'), 'claim');
  assert.equal(legacyFamilyOf('audits/autowriter/generations/2026/11/' + SLUG + '.json'), null);
  assert.equal(legacyFamilyOf('state/ledger/2026/11/' + SLUG + '.json'), null);
  assert.equal(legacyFamilyOf('audits/autowriter/README.md'), null);
  assert.equal(legacyFamilyOf(null), null);
});

test('the spend report and the two demand reports of the old layout are legacy files', () => {
  assert.deepEqual(LEGACY_FILES, ['audits/spend-report.md', 'audits/search-demand.md', 'audits/keyword-demand.md']);
  for (const path of LEGACY_FILES) assert.equal(isLegacyRecord(path), true, path);
  assert.equal(isLegacyRecord('audits/autowriter/2026/11/' + SLUG + '.json'), true);
  assert.equal(isLegacyRecord('audits/autowriter/generations/2026/11/' + SLUG + '.json'), false);
  assert.equal(isLegacyRecord('audits/routes.json'), false);
  assert.equal(isLegacyRecord(STATE_FILES.spendReport), false);
});
