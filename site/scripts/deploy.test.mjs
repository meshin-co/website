import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REQUIRED_ENV,
  credentialFindings,
  deployArgs,
  deploymentUrl,
  ledgerFindings,
  measurementWarnings,
  previewBranch,
  unmeasuredTree,
} from './deploy.mjs';
import { fingerprint } from './lh-evidence.mjs';
import { CLEAR_COMMAND, ledgerWithDebt } from './measurement-debt.mjs';
import { newLedger } from './autowriter-ledger.mjs';

const filled = {
  CLOUDFLARE_API_TOKEN: 't'.repeat(40),
  CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
  CLOUDFLARE_PAGES_PROJECT: 'meshin',
};

test('every variable the deploy needs is named, and a missing one is a sentence naming it', () => {
  assert.deepEqual(REQUIRED_ENV, ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_PAGES_PROJECT']);
  assert.deepEqual(credentialFindings(filled), []);
  const missing = credentialFindings({ ...filled, CLOUDFLARE_API_TOKEN: '' });
  assert.equal(missing.length, 1);
  assert.match(missing[0], /CLOUDFLARE_API_TOKEN/);
  assert.match(missing[0], /\.env\.example/);
});

test('a placeholder left from the example counts as missing, not as a credential', () => {
  const findings = credentialFindings({ ...filled, CLOUDFLARE_ACCOUNT_ID: '   ' });
  assert.equal(findings.length, 1);
  assert.match(findings[0], /CLOUDFLARE_ACCOUNT_ID/);
});

test('a finding never prints the secret it is complaining about', () => {
  const secret = 'super-secret-token-value';
  const findings = credentialFindings({ ...filled, CLOUDFLARE_PAGES_PROJECT: '', CLOUDFLARE_API_TOKEN: secret });
  assert.equal(
    findings.some((finding) => finding.includes(secret)),
    false
  );
});

test('a production deploy names the production branch, a preview names its own', () => {
  assert.deepEqual(deployArgs({ project: 'meshin', dist: 'dist', branch: 'main' }), [
    'pages',
    'deploy',
    'dist',
    '--project-name',
    'meshin',
    '--branch',
    'main',
    '--commit-dirty',
    'true',
  ]);
  const preview = deployArgs({ project: 'meshin', dist: 'dist', branch: 'pr-42' });
  assert.equal(preview[preview.indexOf('--branch') + 1], 'pr-42');
});

test('a branch name is reduced to what Pages can serve as a subdomain', () => {
  const args = deployArgs({ project: 'meshin', dist: 'dist', branch: 'feat/Deploy_Pages--step 2' });
  assert.equal(args[args.indexOf('--branch') + 1], 'feat-deploy-pages-step-2');
});

test('a build the route ledger has not seen is refused, naming what differs', () => {
  const ledger = ['/', '/about'];
  assert.deepEqual(ledgerFindings(ledger, ['/', '/about']), []);
  const added = ledgerFindings(ledger, ['/', '/about', '/zz-new']);
  assert.equal(added.length, 1);
  assert.match(added[0], /zz-new/);
  assert.match(added[0], /assets:routes/);
  assert.match(added[0], /unattended writer commits the ledger/);
  assert.match(added[0], /came from somewhere else/);
  const removed = ledgerFindings(ledger, ['/']);
  assert.match(removed[0], /about/);
});

test('the deployment url is read from what wrangler actually printed', () => {
  const output = [
    '✨ Success! Uploaded 308 files (12.03 sec)',
    '🌎 Deploying...',
    '✨ Deployment complete! Take a peek over at https://1e05d601.meshin.pages.dev',
    '✨ Deployment alias URL: https://pr-42.meshin.pages.dev',
  ].join('\n');

  assert.equal(deploymentUrl(output), 'https://pr-42.meshin.pages.dev');
});

test('a deploy with no alias falls back to the unique deployment address', () => {
  const output = '✨ Deployment complete! Take a peek over at https://844f2192.meshin.pages.dev';

  assert.equal(deploymentUrl(output), 'https://844f2192.meshin.pages.dev');
});

test('output with no address at all yields nothing to publish', () => {
  assert.equal(deploymentUrl('✘ [ERROR] Authentication error'), null);
});

test('a preview may never be labelled main, which would publish to production', () => {
  assert.equal(previewBranch(['--preview', 'pr-42']), 'pr-42');
  assert.equal(previewBranch(['--preview']), 'preview');
  assert.throws(() => previewBranch(['--preview', 'main']), /main/);
  assert.throws(() => previewBranch(['--preview', 'MAIN']), /main/);
});

const hash = (letter) => letter.repeat(40);
const MEASURED = 'a'.repeat(64);
const UNMEASURED = 'b'.repeat(64);
const SLUG = 'named-person-responsible-for-ai-risk-in-vendor-procurement';
const MERGED = 'd716823d25176f3ee98f8458aa8b6847e0ab6086';
const DEBT_RECORDED = '2026-11-04T03:43:07.953Z';
const MEASURED_AT = '2026-11-04T02:51:16.487Z';

const green = (at = MEASURED_AT) => ({ fingerprint: MEASURED, recordedAt: at, phase: 'zz' });
const owing = (slug = SLUG, recordedAt = DEBT_RECORDED) =>
  ledgerWithDebt(newLedger({ slug, runId: '41', pullRequest: 84 }), {
    mergedCommit: MERGED,
    fingerprint: UNMEASURED,
    now: new Date(recordedAt),
  });

test('a tree the last recorded run measured is published, whatever debts the ledgers hold', () => {
  assert.deepEqual(measurementWarnings({ record: green(), current: MEASURED, ledgers: [owing()] }), []);
  assert.deepEqual(measurementWarnings({ record: green(), current: MEASURED, ledgers: [] }), []);
});

test('a tree another run measured is warned about, naming both trees, the entry that owes it, the command to run and that it ships anyway', () => {
  const findings = measurementWarnings({ record: green(), current: UNMEASURED, ledgers: [owing()] });

  assert.equal(findings.length, 1);
  assert.match(findings[0], /the tree being published, b{12}, was never measured by Lighthouse/);
  assert.match(findings[0], new RegExp(`last recorded run \\(${MEASURED_AT}\\) measured a{12}`));
  assert.match(findings[0], new RegExp(`${SLUG} owes the measurement`));
  assert.match(findings[0], /d716823/);
  assert.ok(findings[0].includes(CLEAR_COMMAND));
  assert.match(findings[0], /commit audits\/lighthouse-green\.json/);
  assert.match(findings[0], /published anyway/);
});

test('the debt of an unmeasured tree is structured data the Slack message reads, and a measured tree has none', () => {
  assert.equal(unmeasuredTree({ record: green(), current: MEASURED, ledgers: [owing()] }), null);

  const debt = unmeasuredTree({ record: green(), current: UNMEASURED, ledgers: [owing()] });

  assert.equal(debt.tree, 'b'.repeat(12));
  assert.deepEqual(debt.owed, [{ slug: SLUG, mergedCommit: 'd716823', recordedAt: DEBT_RECORDED }]);
  assert.equal(debt.clear, CLEAR_COMMAND);
});

test('a repository with no recorded run warns about every tree, and every debt is owed', () => {
  const findings = measurementWarnings({
    record: undefined,
    current: UNMEASURED,
    ledgers: [owing('one-entry'), owing('another-entry')],
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0], /no Lighthouse run is recorded for this repository/);
  assert.match(findings[0], /one-entry owes/);
  assert.match(findings[0], /another-entry owes/);
});

test('a debt recorded before the last run is history, not an owed measurement', () => {
  const findings = measurementWarnings({
    record: green('2026-11-05T00:00:00.000Z'),
    current: UNMEASURED,
    ledgers: [owing()],
  });

  assert.equal(findings.length, 1);
  assert.doesNotMatch(findings[0], /owes the measurement/);
  assert.ok(findings[0].includes(CLEAR_COMMAND));
});

test('a ledger without a debt owes nothing, and a tree changed by hand is still warned about', () => {
  const findings = measurementWarnings({
    record: green(),
    current: UNMEASURED,
    ledgers: [newLedger({ slug: 'held', runId: '1', pullRequest: null })],
  });

  assert.equal(findings.length, 1);
  assert.doesNotMatch(findings[0], /owes the measurement/);
  assert.ok(findings[0].includes(CLEAR_COMMAND));
});

test('the command a person is told to run is the one the debt record carries', () => {
  const ledger = owing();
  ledger.measurementDebt.clear = 'cd site && GATE_PHASE=zz npm run gate:lh && GATE_PHASE=zz npm run lh:record';

  const [finding] = measurementWarnings({ record: green(), current: UNMEASURED, ledgers: [ledger] });

  assert.ok(finding.includes(ledger.measurementDebt.clear));
});

test('deleting the debt from the ledger clears nothing, because the tree is what is judged', () => {
  const { measurementDebt, ...withoutDebt } = owing();

  assert.ok(measurementDebt);
  assert.equal(measurementWarnings({ record: green(), current: UNMEASURED, ledgers: [withoutDebt] }).length, 1);
});

test('a debt cannot be cleared by marking it, because nothing in a ledger is read as a clearance', () => {
  const marked = { ...owing(), measurementDebt: { ...owing().measurementDebt, clearedAt: DEBT_RECORDED } };

  assert.equal(measurementWarnings({ record: green(), current: UNMEASURED, ledgers: [marked] }).length, 1);
});

const BLOB = hash('1');
const ENTRY = 'site/src/data/post/a-new-entry.md';

test('a content entry moves the fingerprint, and the prose around it does not, so a measured tree names its content', () => {
  const before = [['site/src/pages/index.astro', BLOB]];
  const withEntry = [...before, [ENTRY, hash('2')]];
  const withLedger = [...withEntry, ['audits/autowriter/2026/11/a-new-entry.json', hash('3')]];
  const withDocs = [...withLedger, ['docs/SEMANTIC-CORE.md', hash('4')]];

  assert.notEqual(fingerprint(withEntry), fingerprint(before));
  assert.equal(fingerprint(withLedger), fingerprint(withEntry));
  assert.equal(fingerprint(withDocs), fingerprint(withEntry));
});
