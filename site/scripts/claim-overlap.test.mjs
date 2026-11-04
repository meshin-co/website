import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, test } from 'node:test';

import { parse } from 'yaml';

import { newClaim, readClaims, writeClaim } from './autowriter-claim-store.mjs';
import { CommitError, commitAndPush } from './commit-to-main.mjs';
import { SUFFIX, inputsFor, prompt, reportOf } from './fixtures/topic-inputs.mjs';
import { BOT_EMAIL, BOT_NAME } from './pr-classify.mjs';
import { recordDirectory, recordFiles, recordPath } from './record-layout.mjs';
import { claimRefusal } from './topic-claims.mjs';
import { selectTopic } from './topic-selection.mjs';

for (const variable of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete process.env[variable];
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';

const REPOSITORY = resolve(import.meta.dirname, '..', '..');
const IDENTITY = { name: BOT_NAME, email: BOT_EMAIL };
const SEED_IDENTITY = ['-c', 'user.name=Seed', '-c', 'user.email=seed@example.test', '-c', 'commit.gpgsign=false'];
const PILOTS = prompt(9, 'why do AI pilots fail to reach production');
const HANDOVER = prompt(15, 'how to hand over AI leadership to internal team');
const REPORT = reportOf([PILOTS, HANDOVER]);
const PILOTS_SLUG = 'why-do-ai-pilots-fail-to-reach-production';
const FIRST_RUN = new Date('2026-11-02T03:17:00.000Z');
const OVERLAPPING_RUN = new Date('2026-11-02T03:19:00.000Z');
const LAST_OF_OCTOBER = new Date('2026-10-31T23:50:00.000Z');
const FIRST_OF_NOVEMBER = new Date('2026-11-01T03:17:00.000Z');

const directories = [];
after(() => directories.forEach((directory) => rmSync(directory, { recursive: true, force: true })));

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function put(root, path, text) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

function makeWorld(seedFiles = {}) {
  const base = mkdtempSync(join(tmpdir(), 'claim-overlap-'));
  directories.push(base);
  const remote = join(base, 'remote.git');
  const seed = join(base, 'seed');
  git(base, 'init', '--bare', '--initial-branch=main', remote);
  mkdirSync(seed);
  git(seed, 'init', '--initial-branch=main');
  put(seed, 'README.md', 'seed\n');
  for (const [path, text] of Object.entries(seedFiles)) put(seed, path, text);
  git(seed, 'add', '--all');
  git(seed, ...SEED_IDENTITY, 'commit', '--message', 'seed');
  git(seed, 'push', remote, 'main');
  const [first, second] = ['first-run', 'second-run'].map((name) => {
    const path = join(base, name);
    git(base, 'clone', remote, path);
    return path;
  });
  return {
    first,
    second,
    remoteHead: () => git(remote, 'rev-parse', 'refs/heads/main'),
    claimsOnOrigin: () =>
      git(remote, 'ls-tree', '-r', '--name-only', 'refs/heads/main', '--', recordDirectory('claim'))
        .split('\n')
        .filter(Boolean),
    originText: (path) => git(remote, 'show', `refs/heads/main:${path}`),
  };
}

const pick = (repo, now) =>
  selectTopic(inputsFor(REPORT, { claims: readClaims(repo), ledgerPaths: recordFiles(repo, 'ledger'), now }));

function claimFor(decision, runId, now) {
  const { topic, prompt: asked, demand } = decision.entries[0];
  const { slug, title, format, query } = topic;
  return newClaim({ slug, title, format, query, demand, prompt: asked, origin: 'demand', runId, now });
}

function fileClaim(repo, claim) {
  const path = recordPath('claim', claim.slug, claim.claimedAt);
  writeClaim(join(repo, path), claim);
  return path;
}

const commitClaim = (repo, path, claim) =>
  commitAndPush({
    repoRoot: repo,
    paths: [path],
    message: `chore(autowriter): claim ${claim.slug}`,
    identity: IDENTITY,
  });

async function runOnce(repo, runId, now) {
  const decision = pick(repo, now);
  const claim = claimFor(decision, runId, now);
  const path = fileClaim(repo, claim);
  const { commit } = await commitClaim(repo, path, claim);
  return { decision, claim, path, commit };
}

const freshTip = (repo) => {
  git(repo, 'fetch', '--quiet', 'origin', 'main');
  git(repo, 'reset', '--quiet', '--hard', 'origin/main');
};

test('two runs that pick one topic from one stale tree are told apart at the claim commit: the second is refused and pushes nothing', async () => {
  const world = makeWorld();
  const firstDecision = pick(world.first, FIRST_RUN);
  const secondDecision = pick(world.second, OVERLAPPING_RUN);
  assert.equal(firstDecision.entries[0].topic.slug, PILOTS_SLUG);
  assert.equal(secondDecision.entries[0].topic.slug, PILOTS_SLUG);

  const firstClaim = claimFor(firstDecision, '4242-1', FIRST_RUN);
  const secondClaim = claimFor(secondDecision, '4243-1', OVERLAPPING_RUN);
  const path = fileClaim(world.first, firstClaim);
  assert.equal(fileClaim(world.second, secondClaim), path);

  const pushed = await commitClaim(world.first, path, firstClaim);
  assert.equal(world.remoteHead(), pushed.commit);

  await assert.rejects(commitClaim(world.second, path, secondClaim), (error) => {
    assert.ok(error instanceof CommitError, String(error));
    assert.match(error.message, /rebase onto origin\/main hit a conflict/);
    assert.match(error.message, /nothing was pushed or forced/);
    assert.ok(error.message.includes(path), error.message);
    return true;
  });

  assert.equal(world.remoteHead(), pushed.commit);
  assert.deepEqual(world.claimsOnOrigin(), [path]);
  assert.equal(JSON.parse(world.originText(path)).runId, '4242-1');
  for (const directory of ['rebase-merge', 'rebase-apply']) {
    assert.equal(existsSync(join(world.second, '.git', directory)), false, directory);
  }
});

test('a run that starts from the fresh tip of main sees the earlier claim, the picker refuses that topic and the run takes another', async () => {
  const world = makeWorld();
  const earlier = await runOnce(world.first, '4242-1', FIRST_RUN);
  const { topic } = earlier.decision.entries[0];
  assert.equal(topic.slug, PILOTS_SLUG);

  freshTip(world.second);
  const held = readClaims(world.second);
  assert.deepEqual(
    held.map(({ path }) => path),
    [earlier.path]
  );
  const refusal = claimRefusal({
    topic,
    generated: [],
    suffix: SUFFIX,
    claims: held,
    ledgerPaths: [],
    now: OVERLAPPING_RUN,
  });
  assert.equal(refusal.reason, 'title-collision');
  assert.ok(refusal.detail.includes(earlier.path), refusal.detail);

  const later = pick(world.second, OVERLAPPING_RUN);
  assert.equal(later.entries[0].prompt.number, 15);
  assert.notEqual(later.entries[0].topic.slug, topic.slug);
  assert.deepEqual(
    later.refusals.map(({ reason, against }) => [reason, against]),
    [['title-collision', topic.title]]
  );

  const claim = claimFor(later, '4243-1', OVERLAPPING_RUN);
  const path = fileClaim(world.second, claim);
  const pushed = await commitClaim(world.second, path, claim);
  assert.equal(world.remoteHead(), pushed.commit);
  assert.deepEqual(world.claimsOnOrigin(), [earlier.path, path].sort());
});

test('the slug alone holds the topic when a later run words the title differently', async () => {
  const world = makeWorld();
  const earlier = await runOnce(world.first, '4242-1', FIRST_RUN);
  freshTip(world.second);
  const reworded = { ...earlier.decision.entries[0].topic, title: `Why pilots stall before production${SUFFIX}` };
  const refusal = claimRefusal({
    topic: reworded,
    generated: [],
    suffix: SUFFIX,
    claims: readClaims(world.second),
    ledgerPaths: [],
    now: OVERLAPPING_RUN,
  });
  assert.equal(refusal.reason, 'slug-held');
  assert.equal(refusal.against, earlier.path);
});

test('a claim filed on the last day of October still blocks the topic for a run on the first of November', async () => {
  const world = makeWorld();
  const earlier = await runOnce(world.first, '4242-1', LAST_OF_OCTOBER);
  assert.match(earlier.path, /\/2026\/10\//);
  assert.match(recordPath('claim', PILOTS_SLUG, FIRST_OF_NOVEMBER), /\/2026\/11\//);
  assert.ok(Date.parse(earlier.claim.expiresAt) > FIRST_OF_NOVEMBER.getTime());

  freshTip(world.second);
  assert.deepEqual(recordFiles(world.second, 'claim'), [earlier.path]);
  const later = pick(world.second, FIRST_OF_NOVEMBER);
  assert.equal(later.entries[0].prompt.number, 15);
  assert.deepEqual(
    later.refusals.map(({ reason }) => reason),
    ['title-collision']
  );
  assert.ok(later.refusals[0].detail.includes(earlier.path), later.refusals[0].detail);
});

test('a ledger filed two months earlier holds the slug for ever, so no month change frees a topic that already spent money', () => {
  const ledgerPath = recordPath('ledger', PILOTS_SLUG, '2026-09-20T07:00:00.000Z');
  const world = makeWorld({ [ledgerPath]: '{}\n' });
  freshTip(world.second);
  const later = pick(world.second, FIRST_OF_NOVEMBER);
  assert.equal(later.entries[0].prompt.number, 15);
  assert.equal(later.refusals[0].reason, 'slug-held');
  assert.equal(later.refusals[0].against, ledgerPath);
  const afterLapse = new Date('2027-03-01T03:17:00.000Z');
  assert.equal(pick(world.second, afterLapse).refusals[0].against, ledgerPath);
});

test('a tree that predates the first run and a run in the next month file the claim at two paths, which git cannot see, so only the checkout of main and the queue stop it', async () => {
  const world = makeWorld();
  const stale = pick(world.second, FIRST_OF_NOVEMBER);
  const earlier = await runOnce(world.first, '4242-1', LAST_OF_OCTOBER);
  const claim = claimFor(stale, '4243-1', FIRST_OF_NOVEMBER);
  const path = fileClaim(world.second, claim);
  assert.notEqual(path, earlier.path);
  await commitClaim(world.second, path, claim);
  assert.deepEqual(world.claimsOnOrigin(), [earlier.path, path].sort());
});

test('the workflow queues runs one behind another and checks out the tip of main, the two things that make the fresh tip the one a run sees', () => {
  const workflow = parse(readFileSync(join(REPOSITORY, '.github', 'workflows', 'write-daily.yml'), 'utf8'));
  assert.deepEqual(workflow.concurrency, { group: 'write-daily', 'cancel-in-progress': false });
  const checkouts = workflow.jobs.write.steps.filter(({ uses }) => uses?.startsWith('actions/checkout@'));
  assert.equal(checkouts.length, 1);
  assert.equal(checkouts[0].with.ref, 'main');
});
