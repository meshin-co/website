import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DIGEST_KINDS, requiredChannels } from './autowriter-ledger.mjs';
import { CLEAR_COMMAND, debtFinding } from './measurement-debt.mjs';

const MERGED = 'f'.repeat(40);
const FINGERPRINT = 'a'.repeat(64);
const error = new Error('GitHub PUT contents/audits/autowriter/a-slug.json answered 409: main is protected');

const finding = (patch = {}) =>
  debtFinding({ number: 72, mergedCommit: MERGED, fingerprint: FINGERPRINT, error, ...patch });

test('a debt that was not recorded is a hard stop: an issue and the morning digest, and no Slack message', () => {
  assert.equal(finding().kind, 'hard-stop');
  assert.ok(DIGEST_KINDS.includes(finding().kind));
  assert.deepEqual(requiredChannels(finding().kind), ['issue']);
});

test('the title names the pull request and the debt', () => {
  assert.match(finding().title, /#72/);
  assert.match(finding().title, /measurement debt/);
});

test('the detail names the merged commit, the fingerprint, the error and the command that clears the debt', () => {
  const { detail } = finding();

  for (const named of [MERGED, FINGERPRINT, error.message, CLEAR_COMMAND]) assert.ok(detail.includes(named), named);
});

test('a fingerprint that was never computed is said to be missing, never printed as a value', () => {
  const { detail } = finding({ fingerprint: null });

  assert.match(detail, /fingerprint of the merged tree was not computed/i);
  assert.doesNotMatch(detail, /null|undefined/);
  assert.ok(detail.includes(MERGED));
  assert.ok(detail.includes(CLEAR_COMMAND));
  assert.ok(detail.includes(error.message));
});

test('the title carries no error text and no commit, so a line of the digest stays short and fixed', () => {
  const { title } = finding();

  assert.equal(title.includes(error.message), false);
  assert.equal(title.includes(MERGED), false);
  assert.equal(finding({ fingerprint: null }).title, title);
});
