import assert from 'node:assert/strict';
import test from 'node:test';

import { REQUIRED_ENV, credentialFindings, deployArgs, ledgerFindings } from './deploy.mjs';

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
  const removed = ledgerFindings(ledger, ['/']);
  assert.match(removed[0], /about/);
});
