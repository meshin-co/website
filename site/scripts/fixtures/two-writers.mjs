import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { commitRoute } from '../entry-commit.mjs';
import { recordPath } from '../record-layout.mjs';
import { assembleRoute } from '../route-assembly.mjs';
import { spendReportFile } from '../spend-report.mjs';
import { DRAFTS, RUN_DATE, claimOf } from './entry-drafts.mjs';
import { gitRun } from './git-run.mjs';
import { FIXTURE_IDENTITY, GIT_ENVIRONMENT, fakeRun, gitIn, makeRepo } from './route-repo.mjs';
import { asText, ledgerOf, recordOf, writingCall } from './spend-report-corpus.mjs';

export const REPORT_INSTANT = '2026-11-05T12:00:00.000Z';
const NO_PROCESS = { status: 0, stdout: '', stderr: '' };

const FIRST_CLAIM = claimOf('article');
const FIRST_DRAFT = DRAFTS.article;

const SECOND_CLAIM = {
  ...FIRST_CLAIM,
  slug: 'ai-vendor-risk-questionnaire',
  title: 'AI vendor risk questionnaire',
  query: 'ai vendor risk questionnaire',
  prompt: { number: 3, text: 'AI vendor risk questionnaire' },
  runId: '9002',
  claimedAt: '2026-11-01T08:00:00.000Z',
};
const SECOND_DRAFT = {
  ...FIRST_DRAFT,
  fields: {
    ...FIRST_DRAFT.fields,
    description:
      'An AI vendor risk questionnaire has ten questions: where the data goes, who can read it and who pays.',
    shortAnswer: 'Ask a vendor ten questions before the contract: where the data goes and who can read it.',
    fullAnswer: 'A questionnaire is a page a procurement lead sends first. It asks where the data goes.',
    tags: ['ai-governance', 'vendor-risk'],
  },
  body: '## Where the data goes\n\nThe vendor names every region.\n\n- one\n- two\n',
  passage: 'A questionnaire is a page a procurement lead sends first.',
};

export const WRITERS = [
  { claim: FIRST_CLAIM, draft: FIRST_DRAFT },
  { claim: SECOND_CLAIM, draft: SECOND_DRAFT },
];

export const branchOf = ({ claim }) => `autowriter/${claim.slug}`;

const git = (cwd, ...args) => execFileSync('git', args, { cwd, env: GIT_ENVIRONMENT, encoding: 'utf8' });

export function mergeProbe(repo, left, right) {
  const probe = spawnSync('git', ['merge-tree', '--write-tree', '--no-messages', '--name-only', left, right], {
    cwd: repo,
    env: GIT_ENVIRONMENT,
    encoding: 'utf8',
  });
  const [tree, ...rest] = probe.stdout.split('\n');
  const conflicts = probe.status === 0 ? [] : rest.filter((line) => line !== '');
  return { status: probe.status, tree: tree.trim(), conflicts: [...new Set(conflicts)].sort() };
}

export function sceneRun(root) {
  const generators = fakeRun(root);
  const plain = gitRun();
  return (command, args, options) => {
    if (command === 'git') return plain(command, args, options);
    if (command === 'npm' && args[0] === 'ci') return NO_PROCESS;
    return generators(command, args, options);
  };
}

function ownFiles({ claim }) {
  const calls = [writingCall({ tag: `${claim.slug}-draft` })];
  const ledger = ledgerOf({ slug: claim.slug, runId: claim.runId, calls });
  const record = recordOf({ slug: claim.slug, format: claim.format, at: REPORT_INSTANT, runId: claim.runId, calls });
  return [
    { path: recordPath('generation', claim.slug, claim.claimedAt), text: asText(record) },
    { path: recordPath('claim', claim.slug, claim.claimedAt), text: asText({ ...claim, status: 'written' }) },
    { path: recordPath('ledger', claim.slug, claim.claimedAt), text: asText(ledger) },
  ];
}

function commitClaim(root, { claim }) {
  const path = recordPath('claim', claim.slug, claim.claimedAt);
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), asText(claim));
  gitIn(root, 'add', '--', path);
  gitIn(root, ...FIXTURE_IDENTITY, 'commit', '--quiet', '-m', `claim: ${claim.title}`);
  gitIn(root, 'push', '--quiet', 'origin', 'main');
}

async function writeBranch(root, writer) {
  const base = gitIn(root, 'rev-parse', 'HEAD').trim();
  const assembly = await assembleRoute({ repoRoot: root, entries: [writer], runDate: RUN_DATE, run: sceneRun(root) });
  const written = ownFiles(writer);
  const report = spendReportFile({ repoRoot: root, written, revision: base, at: REPORT_INSTANT });
  const files = [...assembly.files, ...written, { path: report.path, text: report.text }];
  const message = `feat(autowriter): write ${writer.claim.slug}\n\nProvenance: ${written[0].path}`;
  const { commit } = await commitRoute({ repoRoot: root, branch: branchOf(writer), files, message, run: gitRun() });
  gitIn(root, 'push', '--quiet', 'origin', branchOf(writer));
  gitIn(root, 'checkout', '--quiet', 'main');
  return { ...writer, branch: branchOf(writer), base, commit, files: files.map(({ path }) => path).sort() };
}

export async function startDay({ writers = WRITERS } = {}) {
  const root = makeRepo();
  const remote = join(mkdtempSync(join(tmpdir(), 'two-writers-')), 'remote.git');
  git(root, 'clone', '--quiet', '--bare', root, remote);
  gitIn(root, 'remote', 'add', 'origin', remote);
  gitIn(root, 'fetch', '--quiet', 'origin');
  gitIn(root, 'branch', '--set-upstream-to=origin/main', 'main');
  const runs = [];
  for (const writer of writers) {
    commitClaim(root, writer);
    runs.push(await writeBranch(root, writer));
  }
  return { root, remote, runs, cleanup: () => rmSync(dirname(remote), { recursive: true, force: true }) };
}

export function landOnRemote(remote, branch, subject) {
  const { status, tree } = mergeProbe(remote, 'main', branch);
  if (status !== 0) return { merged: false, status };
  const commit = git(remote, ...FIXTURE_IDENTITY, 'commit-tree', tree, '-p', 'main', '-m', subject).trim();
  git(remote, 'update-ref', 'refs/heads/main', commit);
  return { merged: true, commit };
}
