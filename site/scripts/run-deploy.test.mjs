import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const RUN_DEPLOY = fileURLToPath(new URL('./run-deploy.mjs', import.meta.url));
const RUN_CHECK = fileURLToPath(new URL('./run-deploy-check.mjs', import.meta.url));

const CREDENTIALS = {
  CLOUDFLARE_API_TOKEN: 'cf-secret-value',
  CLOUDFLARE_ACCOUNT_ID: 'account-1234',
  CLOUDFLARE_PAGES_PROJECT: 'meshin',
};

function workspace({ routes, pages = 'meshin', wranglerStatus = 0, silent = false }) {
  const root = mkdtempSync(join(tmpdir(), 'deploy-'));
  const site = join(root, 'site');
  mkdirSync(join(site, 'dist'), { recursive: true });
  mkdirSync(join(root, 'audits'), { recursive: true });
  mkdirSync(join(site, 'node_modules', '.bin'), { recursive: true });

  for (const route of routes) {
    const file = route === '/' ? 'index.html' : `${route.slice(1)}.html`;
    writeFileSync(join(site, 'dist', file), '<!DOCTYPE html><html></html>');
  }
  writeFileSync(join(root, 'audits', 'routes.json'), JSON.stringify(routes));

  const log = join(root, 'wrangler-args.txt');
  const bin = join(site, 'node_modules', '.bin', 'wrangler');
  writeFileSync(
    bin,
    [
      '#!/bin/sh',
      `printf '%s\\n' "$@" > "${log}"`,
      `echo "\u2502 ${pages} \u2502 ${pages}.pages.dev \u2502"`,
      silent ? 'true' : 'echo "\u2728 Deployment complete! Take a peek over at https://abc123.meshin.pages.dev"',
      `exit ${wranglerStatus}`,
    ].join('\n')
  );
  chmodSync(bin, 0o755);

  return { site, log };
}

const runIn = (site, script, args, env) =>
  spawnSync(process.execPath, [script, ...args], {
    cwd: site,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });

test('a deploy without credentials names the variable and never reaches wrangler', () => {
  const { site, log } = workspace({ routes: ['/'] });

  const result = runIn(site, RUN_DEPLOY, [], { ...CREDENTIALS, CLOUDFLARE_API_TOKEN: '' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /CLOUDFLARE_API_TOKEN is not set/);
  assert.throws(() => readFileSync(log, 'utf8'), 'wrangler must not be spawned');
});

test('a build the route ledger has not seen is refused, naming the route', () => {
  const { site, log } = workspace({ routes: ['/'] });
  writeFileSync(join(site, 'dist', 'surprise.html'), '<!DOCTYPE html><html></html>');

  const result = runIn(site, RUN_DEPLOY, [], CREDENTIALS);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /adds \/surprise/);
  assert.throws(() => readFileSync(log, 'utf8'), 'wrangler must not be spawned');
});

test('a gated build is uploaded to the branch the caller asked for', () => {
  const { site, log } = workspace({ routes: ['/', '/about'] });

  const production = runIn(site, RUN_DEPLOY, [], CREDENTIALS);
  assert.equal(production.status, 0);
  assert.deepEqual(readFileSync(log, 'utf8').trim().split('\n'), [
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

  const preview = runIn(site, RUN_DEPLOY, ['--preview', 'pr-7'], CREDENTIALS);
  assert.equal(preview.status, 0);
  const args = readFileSync(log, 'utf8').trim().split('\n');
  assert.equal(args[args.indexOf('--branch') + 1], 'pr-7');
});

test("wrangler's failure is the deploy's failure", () => {
  const { site } = workspace({ routes: ['/'], wranglerStatus: 3 });

  const result = runIn(site, RUN_DEPLOY, [], CREDENTIALS);

  assert.equal(result.status, 3);
});

test('the check reports a project that exists, and one that does not, without failing', () => {
  const present = workspace({ routes: ['/'], pages: 'meshin' });
  const existing = runIn(present.site, RUN_CHECK, [], CREDENTIALS);
  assert.equal(existing.status, 0);
  assert.match(existing.stdout, /project meshin exists/);
  assert.doesNotMatch(existing.stdout + existing.stderr, /cf-secret-value/);
  assert.doesNotMatch(existing.stdout, /account-1234/);

  const absent = workspace({ routes: ['/'], pages: 'something-else' });
  const missing = runIn(absent.site, RUN_CHECK, [], CREDENTIALS);
  assert.equal(missing.status, 0);
  assert.match(missing.stdout, /project meshin does not exist yet/);
});

test('a token that cannot list Pages fails the check, naming the scope it needs', () => {
  const { site } = workspace({ routes: ['/'], wranglerStatus: 1 });

  const result = runIn(site, RUN_CHECK, [], CREDENTIALS);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cloudflare Pages \| Edit/);
});

test('the deploy prints the address it produced, so nothing downstream guesses it', () => {
  const { site } = workspace({ routes: ['/'] });

  const result = runIn(site, RUN_DEPLOY, [], CREDENTIALS);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^deploy: url=https:\/\/abc123\.meshin\.pages\.dev$/m);
});

test('a deploy that printed no address fails rather than publishing a blank link', () => {
  const { site } = workspace({ routes: ['/'], silent: true });

  const result = runIn(site, RUN_DEPLOY, [], CREDENTIALS);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /no deployment address/);
});

test('a preview labelled main is refused before wrangler is spawned', () => {
  const { site, log } = workspace({ routes: ['/'] });

  const result = runIn(site, RUN_DEPLOY, ['--preview', 'main'], CREDENTIALS);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /may not be labelled main/);
  assert.throws(() => readFileSync(log, 'utf8'), 'wrangler must not be spawned');
});
