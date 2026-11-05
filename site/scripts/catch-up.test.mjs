import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';

import { catchUp } from './catch-up.mjs';
import { GIT_ENVIRONMENT } from './fixtures/route-repo.mjs';
import { REPORT_INSTANT, landOnRemote, mergeProbe, sceneRun, startDay } from './fixtures/two-writers.mjs';
import { spendReportFile } from './spend-report.mjs';

const IDENTITY = ['-c', 'user.name=Human', '-c', 'user.email=human@example.test'];
const SHARED = [
  'audits/phase-4.7/dispositions/routes.json',
  'audits/routes.json',
  'audits/spend-report.md',
  'docs/SEMANTIC-CORE.md',
  'site/content-facts.json',
];

const scratch = [];
const days = [];
after(() => {
  days.forEach((started) => started.cleanup());
  scratch.forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

const git = (cwd, ...args) => execFileSync('git', args, { cwd, env: GIT_ENVIRONMENT, encoding: 'utf8' }).trim();

async function day() {
  const started = await startDay();
  days.push(started);
  return started;
}

function checkout(remote, branch) {
  const directory = mkdtempSync(join(tmpdir(), 'catch-up-'));
  scratch.push(directory);
  git(directory, 'clone', '--quiet', remote, '.');
  git(directory, 'checkout', '--quiet', '-B', branch, `origin/${branch}`);
  return directory;
}

async function caughtUp(remote, branch) {
  const work = checkout(remote, branch);
  const head = git(work, 'rev-parse', 'HEAD');
  const result = await catchUp({ repoRoot: work, head, base: 'origin/main', run: sceneRun(work) });
  return { work, head, result };
}

async function bothLanded() {
  const started = await day();
  const [first, second] = started.runs;
  landOnRemote(started.remote, first.branch, 'feat(autowriter): first (#1)');
  const { work, result } = await caughtUp(started.remote, second.branch);
  git(work, 'push', '--quiet', 'origin', `HEAD:${second.branch}`);
  assert.equal(result.outcome, 'caught-up');
  assert.equal(landOnRemote(started.remote, second.branch, 'feat(autowriter): second (#2)').merged, true);
  return started;
}

test('the second pull request of the day merges with no human once it is caught up on main', async () => {
  const { remote, runs } = await day();
  const [first, second] = runs;
  assert.equal(landOnRemote(remote, first.branch, 'feat(autowriter): first (#1)').merged, true);
  assert.equal(mergeProbe(remote, 'main', second.branch).status, 1, 'today the second pull request conflicts');

  const { work, head, result } = await caughtUp(remote, second.branch);

  assert.equal(result.outcome, 'caught-up');
  assert.equal(git(work, 'rev-parse', 'HEAD^1'), head, 'the merge keeps the old head as its first parent');
  assert.equal(git(work, 'rev-parse', 'HEAD^2'), git(work, 'rev-parse', 'origin/main'));
  git(work, 'push', '--quiet', 'origin', `HEAD:${second.branch}`);
  const probe = mergeProbe(remote, 'main', second.branch);
  assert.equal(probe.status, 0, 'git merge-tree --write-tree exits 0');
  assert.deepEqual(probe.conflicts, []);
  assert.equal(landOnRemote(remote, second.branch, 'feat(autowriter): second (#2)').merged, true);
});

test('after both land, regenerating the derived files from the corpus moves no byte and no row is lost', async () => {
  const { remote, runs } = await bothLanded();
  const final = checkout(remote, 'main');
  const run = sceneRun(final);
  for (const command of [
    ['npm', 'run', 'build'],
    ['npm', 'run', 'assets:routes'],
    ['node', 'scripts/semantic-core.mjs'],
    ['node', 'scripts/generate-registers.mjs'],
  ])
    assert.equal(run(command[0], command.slice(1), { cwd: join(final, 'site') }).status, 0, command.join(' '));
  const report = spendReportFile({ repoRoot: final, revision: 'regenerated', at: REPORT_INSTANT });
  writeFileSync(join(final, report.path), report.text);

  assert.equal(git(final, 'status', '--porcelain', '--', ...SHARED), '', 'a fresh regeneration changes nothing');
  const routes = JSON.parse(readFileSync(join(final, 'audits/routes.json'), 'utf8'));
  const facts = JSON.parse(readFileSync(join(final, 'site/content-facts.json'), 'utf8'));
  const core = readFileSync(join(final, 'docs/SEMANTIC-CORE.md'), 'utf8');
  for (const { claim, draft } of runs) {
    assert.ok(routes.includes(`/blog/${claim.slug}`), `${claim.slug} is in audits/routes.json`);
    assert.equal(facts.targetQuery[`/blog/${claim.slug}`], claim.query.toLowerCase());
    assert.ok(core.includes(draft.passage), `${claim.slug} keeps its passage in the semantic core`);
  }
});

test('a pull request that is already on top of main is left alone, so the watcher cannot loop', async () => {
  const { remote, runs } = await day();
  const [first, second] = runs;
  landOnRemote(remote, first.branch, 'feat(autowriter): first (#1)');
  const { work, result } = await caughtUp(remote, second.branch);
  const healed = git(work, 'rev-parse', 'HEAD');
  assert.equal(result.outcome, 'caught-up');

  const again = await catchUp({ repoRoot: work, head: healed, base: 'origin/main', run: sceneRun(work) });

  assert.equal(again.outcome, 'current');
  assert.equal(git(work, 'rev-parse', 'HEAD'), healed);
});

test('a conflict outside the derived set stops the catch-up and leaves the branch exactly as it was', async () => {
  const { remote, runs } = await day();
  const [first, second] = runs;
  landOnRemote(remote, first.branch, 'feat(autowriter): first (#1)');
  const human = checkout(remote, 'main');
  const article = `site/src/data/post/${second.claim.slug}.md`;
  mkdirSync(dirname(join(human, article)), { recursive: true });
  writeFileSync(join(human, article), 'A person wrote this slug first.\n');
  git(human, 'add', '--', article);
  git(human, ...IDENTITY, 'commit', '--quiet', '-m', 'a person took the slug');
  git(human, 'push', '--quiet', 'origin', 'main');

  const { work, head, result } = await caughtUp(remote, second.branch);

  assert.equal(result.outcome, 'conflict');
  assert.ok(result.paths.includes(article));
  assert.equal(git(work, 'rev-parse', 'HEAD'), head);
  assert.equal(git(work, 'status', '--porcelain'), '');
});
