import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { STATE_DIRECTORY, StateMissingError, hasState, requireState } from '../record-layout.mjs';
import { checkOutState } from './state-checkout.mjs';

function inTemp(check) {
  const root = mkdtempSync(join(tmpdir(), 'state-checkout-'));
  try {
    return check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('a tree with no state is refused until a state is checked out of it', () =>
  inTemp((root) => {
    assert.throws(() => requireState(root), StateMissingError);
    checkOutState(root);
    assert.equal(hasState(root), true);
    assert.doesNotThrow(() => requireState(root));
  }));

test('the tree comes back, so a fixture can wrap the folder it made', () =>
  inTemp((root) => {
    assert.equal(checkOutState(root), root);
  }));

test('checking a state out of a tree that already holds one leaves what it holds', () =>
  inTemp((root) => {
    checkOutState(root);
    const held = join(root, STATE_DIRECTORY, 'spend-report.md');
    writeFileSync(held, 'held\n');
    checkOutState(root);
    assert.equal(readFileSync(held, 'utf8'), 'held\n');
  }));
