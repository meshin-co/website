import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { newLedger, writeLedger } from './autowriter-ledger.mjs';
import { fingerprint } from './lh-evidence.mjs';
import { ledgerWithDebt } from './measurement-debt.mjs';
import { recordPath } from './record-layout.mjs';

const RUN_DEPLOY = fileURLToPath(new URL('./run-deploy.mjs', import.meta.url));
const RUN_CHECK = fileURLToPath(new URL('./run-deploy-check.mjs', import.meta.url));

const CREDENTIALS = {
  CLOUDFLARE_API_TOKEN: 'cf-secret-value',
  CLOUDFLARE_ACCOUNT_ID: 'account-1234',
  CLOUDFLARE_PAGES_PROJECT: 'meshin',
};

const GREEN = 'audits/lighthouse-green.json';
const MEASURED_AT = '2026-11-04T02:51:16.487Z';
const DEBT_AT = '2026-11-04T03:43:07.953Z';
const ENTRY_SLUG = 'named-person-responsible-for-ai-risk-in-vendor-procurement';

const git = (root, ...args) =>
  execFileSync('git', ['-c', 'user.name=specimen', '-c', 'user.email=specimen@example.invalid', ...args], {
    cwd: root,
    encoding: 'utf8',
  }).trim();

const write = (root, path, text) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

const commit = (root, message) => {
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', message);
};

function treeOf(root) {
  const listing = git(root, 'ls-tree', '-r', 'HEAD');
  return fingerprint(
    listing
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [meta, path] = line.split('\t');
        return [path, meta.split(' ')[2]];
      })
  );
}

const recordMeasured = (root, at = MEASURED_AT) =>
  write(root, GREEN, `${JSON.stringify({ fingerprint: treeOf(root), recordedAt: at, phase: 'zz' }, null, 2)}\n`);

function mergeEntry(root) {
  write(root, `site/src/data/post/${ENTRY_SLUG}.md`, '---\ntitle: An entry\n---\n\nBody.\n');
  commit(root, 'feat(autowriter): write an entry');
  const ledger = ledgerWithDebt(newLedger({ slug: ENTRY_SLUG, runId: '41', pullRequest: 84 }), {
    mergedCommit: git(root, 'rev-parse', 'HEAD'),
    fingerprint: treeOf(root),
    now: new Date(DEBT_AT),
  });
  writeLedger(join(root, recordPath('ledger', ENTRY_SLUG, DEBT_AT)), ledger);
  commit(root, 'chore(autowriter): record the measurement debt');
}

function workspace({ routes, pages = 'meshin', wranglerStatus = 0, silent = false, measured = true, owing = false }) {
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

  write(root, '.gitignore', 'site/dist/\nsite/node_modules/\nwrangler-args.txt\n');
  write(root, 'site/src/pages/index.astro', '<h1>home</h1>\n');
  git(root, 'init', '-q');
  git(root, 'config', 'maintenance.auto', 'false');
  commit(root, 'the tree the run measured');
  if (measured) {
    recordMeasured(root);
    commit(root, 'chore(audits): record the run');
  }
  if (owing) mergeEntry(root);

  return { site, root, log };
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

const wranglerRan = (log) => {
  try {
    readFileSync(log, 'utf8');
    return true;
  } catch {
    return false;
  }
};

const UNMEASURED_WARNING = /::warning::DEPLOY the tree being published, [0-9a-f]{12}, was never measured by Lighthouse/;

test('a production deploy while a measurement debt is open goes through and warns, naming the entry and the command', () => {
  const { site, log } = workspace({ routes: ['/'], owing: true });

  const result = runIn(site, RUN_DEPLOY, [], CREDENTIALS);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, UNMEASURED_WARNING);
  assert.match(result.stderr, new RegExp(`${ENTRY_SLUG} owes the measurement`));
  assert.match(result.stderr, /GATE_PHASE=<bucket> npm run gate:lh && GATE_PHASE=<bucket> npm run lh:record/);
  assert.equal(wranglerRan(log), true);
});

test('the same deploy is silent about measurement once a recorded run measured the tree that carries the entry', () => {
  const { site, root, log } = workspace({ routes: ['/'], owing: true });
  recordMeasured(root, '2026-11-04T09:00:00.000Z');
  commit(root, 'chore(audits): clear the debt by measuring');

  const result = runIn(site, RUN_DEPLOY, [], CREDENTIALS);

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /Lighthouse/);
  assert.equal(wranglerRan(log), true);
});

test('a tree no run was ever recorded for is published with a warning that says so', () => {
  const { site, log } = workspace({ routes: ['/'], measured: false });

  const result = runIn(site, RUN_DEPLOY, [], CREDENTIALS);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /no Lighthouse run is recorded for this repository/);
  assert.equal(wranglerRan(log), true);
});

test('a content entry moves the fingerprint of the tree, so the record made before it covers nothing', () => {
  const { site, root, log } = workspace({ routes: ['/'] });
  const before = treeOf(root);
  write(root, `site/src/data/post/${ENTRY_SLUG}.md`, '---\ntitle: An entry\n---\n\nBody.\n');
  commit(root, 'feat: an entry nobody measured');

  const result = runIn(site, RUN_DEPLOY, [], CREDENTIALS);

  assert.notEqual(treeOf(root), before);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, UNMEASURED_WARNING);
  assert.equal(wranglerRan(log), true);
});

const CLEARING_ATTEMPTS = {
  'deleting the debt from the ledger': (root) => {
    const path = join(root, recordPath('ledger', ENTRY_SLUG, DEBT_AT));
    const { measurementDebt, ...rest } = JSON.parse(readFileSync(path, 'utf8'));
    assert.ok(measurementDebt);
    writeFileSync(path, `${JSON.stringify(rest, null, 2)}\n`);
  },
  'marking the debt cleared by hand': (root) => {
    const path = join(root, recordPath('ledger', ENTRY_SLUG, DEBT_AT));
    const ledger = JSON.parse(readFileSync(path, 'utf8'));
    ledger.measurementDebt.clearedAt = '2026-11-04T09:00:00.000Z';
    writeFileSync(path, `${JSON.stringify(ledger, null, 2)}\n`);
  },
  'rewriting the date of the recorded run to be later than the debt': (root) => {
    write(
      root,
      GREEN,
      `${JSON.stringify({ ...JSON.parse(readFileSync(join(root, GREEN), 'utf8')), recordedAt: '2026-11-05T00:00:00.000Z' }, null, 2)}\n`
    );
  },
  'writing prose that says it was measured': (root) => {
    write(root, 'docs/measured.md', 'Lighthouse measured this tree.\n');
    write(root, 'investigation/measured.md', 'Every route scored 100.\n');
  },
};

for (const [attempt, act] of Object.entries(CLEARING_ATTEMPTS)) {
  test(`${attempt} leaves the build fingerprint untouched and the warning in place`, () => {
    const { site, root, log } = workspace({ routes: ['/'], owing: true });
    const before = treeOf(root);

    act(root);
    commit(root, `chore: ${attempt}`);
    const result = runIn(site, RUN_DEPLOY, [], CREDENTIALS);

    assert.equal(treeOf(root), before, 'the attempt must be one the fingerprint cannot see');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, UNMEASURED_WARNING);
    assert.equal(wranglerRan(log), true);
  });
}

test('a record that names another tree clears nothing, however recent it is', () => {
  const { site, root, log } = workspace({ routes: ['/'], owing: true });
  write(
    root,
    GREEN,
    `${JSON.stringify({ fingerprint: '0'.repeat(64), recordedAt: '2026-11-05T00:00:00.000Z', phase: 'zz' })}\n`
  );
  commit(root, 'chore: a record of some other tree');

  const result = runIn(site, RUN_DEPLOY, [], CREDENTIALS);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, UNMEASURED_WARNING);
  assert.equal(wranglerRan(log), true);
});

test('no flag and no variable silences the warning', () => {
  const { site } = workspace({ routes: ['/'], owing: true });
  const quiet = {
    CI: 'true',
    GITHUB_ACTIONS: 'true',
    FORCE: '1',
    ALLOW_UNMEASURED: '1',
    SKIP_MEASUREMENT: '1',
    LIGHTHOUSE_WAIVED: '1',
    AUTOWRITER_UNATTENDED: '1',
  };

  const withVariables = runIn(site, RUN_DEPLOY, [], { ...CREDENTIALS, ...quiet });
  const withFlags = runIn(site, RUN_DEPLOY, ['--force', '--allow-unmeasured', '--waive-measurement'], CREDENTIALS);

  assert.match(withVariables.stderr, UNMEASURED_WARNING);
  assert.match(withFlags.stderr, UNMEASURED_WARNING);
});

test('a preview is not a publication, so a pull request is previewed before anything measured it', () => {
  const { site, log } = workspace({ routes: ['/'], owing: true });

  const result = runIn(site, RUN_DEPLOY, ['--preview', 'pr-9'], CREDENTIALS);

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /Lighthouse/);
  assert.equal(wranglerRan(log), true);
});

test('a build file nobody committed is refused, because no commit names the tree being published', () => {
  const { site, root, log } = workspace({ routes: ['/'] });
  write(root, 'site/src/pages/uncommitted.astro', '<p>uncommitted</p>\n');

  const result = runIn(site, RUN_DEPLOY, [], CREDENTIALS);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /site\/src\/pages\/uncommitted\.astro is not committed/);
  assert.equal(wranglerRan(log), false);
});
