import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { ATTEMPT_CAP } from '../autowriter-ledger.mjs';
import { entryRoute } from '../entry-files.mjs';
import { assembleRepair } from '../repair-assembly.mjs';
import { assembleRoute } from '../route-assembly.mjs';
import { recordPath } from '../record-layout.mjs';
import { WriterError } from '../writer-error.mjs';
import { claimOf, DRAFTS, RUN_DATE } from './entry-drafts.mjs';
import { freshDigest } from './route-dispositions.mjs';
import { fakeRun, FIXTURE_IDENTITY, GIT_ENVIRONMENT, gitIn, makeRepo, snapshotOf } from './route-repo.mjs';

const DISPOSITIONS = 'audits/phase-4.7/dispositions';
export const SLUG = 'how-to-write-an-ai-incident-runbook';
export const ROUTE = `/blog/${SLUG}`;
export const ENTRY = `site/src/data/post/${SLUG}.md`;
export const OWN = recordPath('disposition', SLUG, claimOf('article').claimedAt);
export const GENERATION = recordPath('generation', SLUG, claimOf('article').claimedAt);
export const ROUTES = `${DISPOSITIONS}/routes.json`;
export const UNTOUCHED = 'site/untouched.txt';
export const OWNER_REASON = 'The page was read by the owner.';
export const PRETTIER_ENTRY = `npx prettier --write src/data/post/${SLUG}.md`;
export const STALE_COMMAND = 'node scripts/stale-dispositions.mjs . dist';
export const FORMAT = `npx prettier --write ../${OWN} ../${ROUTES}`;
export const ATTEMPT = { number: 1, of: ATTEMPT_CAP };

export const reworded = (description) => ({ ...DRAFTS.article, fields: { ...DRAFTS.article.fields, description } });
export const REPAIRED = reworded(
  'Write the runbook around who is paged, what stops the system and who tells the customer.'
);

const copies = [];
const templates = new Map();

export const read = (root, path) => readFileSync(join(root, path), 'utf8');
export const textOf = ({ files }, path) => files.find((file) => file.path === path)?.text;
export const pathsOf = ({ files }) => files.map(({ path }) => path);
export const keysOf = (run) => run.calls.map(({ key }) => key);

export const buildFailure =
  (...needles) =>
  (error) =>
    error instanceof WriterError && error.kind === 'build' && needles.every((needle) => error.message.includes(needle));

export const put = (root, path, text) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

export function commitFiles(root, files, message = 'landed') {
  for (const { path, text } of files) put(root, path, text);
  gitIn(root, 'add', '--', ...files.map(({ path }) => path));
  gitIn(root, ...FIXTURE_IDENTITY, 'commit', '--quiet', '-m', message);
}

async function land(format) {
  const root = makeRepo();
  const claim = claimOf(format);
  const entries = [{ claim, draft: DRAFTS[format] }];
  const { files } = await assembleRoute({ repoRoot: root, entries, runDate: RUN_DATE, run: fakeRun(root) });
  for (const { path, text } of files) put(root, path, text);

  const route = entryRoute(claim);
  const owner = { target: route, status: 'verified', reason: OWNER_REASON, digest: freshDigest(root, route) };
  const shared = files.find(({ path }) => path === ROUTES);
  const text = `${JSON.stringify([...JSON.parse(shared.text), owner], null, 2)}\n`;
  const landed = [...files.filter((file) => file !== shared), { path: ROUTES, text }, { path: UNTOUCHED, text: 'x\n' }];
  commitFiles(root, landed);
  return root;
}

export async function landedRepo(format = 'article') {
  if (!templates.has(format)) templates.set(format, land(format));
  const root = mkdtempSync(join(tmpdir(), 'repair-repo-'));
  copies.push(root);
  cpSync(await templates.get(format), root, { recursive: true });
  return root;
}

export function emptyRepo() {
  const root = makeRepo();
  copies.push(root);
  return root;
}

export async function removeRepos() {
  for (const root of copies.splice(0)) rmSync(root, { recursive: true, force: true });
}

export async function removeTemplates() {
  for (const made of await Promise.allSettled(templates.values()))
    if (made.status === 'fulfilled') rmSync(made.value, { recursive: true, force: true });
  templates.clear();
}

export const treeOf = (root) => ({ files: snapshotOf(root), status: gitIn(root, 'status', '--porcelain', '-z') });

export function repairRun(root, { fail, exits, before = {}, git } = {}) {
  const inner = fakeRun(root, { fail, exits });
  const calls = [];
  const run = (command, args, options) => {
    const key = [command, ...args].join(' ');
    calls.push({ key, cwd: options.cwd });
    before[key]?.(root);
    if (command !== 'git') return inner(command, args, options);
    if (git) return git(args);
    const { status, stdout, stderr } = spawnSync('git', args, {
      cwd: options.cwd,
      env: GIT_ENVIRONMENT,
      encoding: 'utf8',
    });
    return { status, stdout, stderr };
  };
  run.calls = calls;
  return run;
}

export const strayRun = (root, change, options = {}) =>
  repairRun(root, { ...options, before: { 'npm run gate:machine': change } });

export const refusedAsDeleted = (path) => (error) =>
  buildFailure()(error) && error.message === `the repair deleted ${path}`;

export const repair = (root, run, overrides = {}) =>
  assembleRepair({
    repoRoot: root,
    claim: claimOf('article'),
    draft: REPAIRED,
    runDate: RUN_DATE,
    attempt: ATTEMPT,
    run,
    ...overrides,
  });
