import { rmSync } from 'node:fs';
import { join } from 'node:path';

import { headOfHistory } from './autowriter-history-specimens.mjs';
import { SQUASH_OF_133, repositoryGit } from './autowriter-refusal-rules.mjs';

const GATE = 'gate:autowriter';
const SHORT_SHA = 12;
const TEMPORARY_INDEX = 'zz-specimen-third-path-index';
const PLAIN_COMMITS = ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null'];
const IDENTITY_FORMAT = ['%an', '%ae', '%aI', '%cn', '%ce', '%cI'].join('%x00');

export const THIRD_PATH = 'audits/zz-specimen-third-path.json';

function identityOf(git, sha) {
  const [authorName, authorEmail, authorDate, committerName, committerEmail, committerDate] = git([
    'log',
    '-1',
    `--format=${IDENTITY_FORMAT}`,
    sha,
  ])
    .trim()
    .split('\0');
  return {
    GIT_AUTHOR_NAME: authorName,
    GIT_AUTHOR_EMAIL: authorEmail,
    GIT_AUTHOR_DATE: authorDate,
    GIT_COMMITTER_NAME: committerName,
    GIT_COMMITTER_EMAIL: committerEmail,
    GIT_COMMITTER_DATE: committerDate,
  };
}

function treeWithThirdPath({ repo, sha }) {
  const index = join(repositoryGit(repo)(['rev-parse', '--absolute-git-dir']).trim(), TEMPORARY_INDEX);
  const staged = repositoryGit(repo, { GIT_INDEX_FILE: index });
  try {
    staged(['read-tree', sha]);
    const blob = staged(['hash-object', '-w', '--stdin'], '{}\n').trim();
    staged(['update-index', '--add', '--cacheinfo', `100644,${blob},${THIRD_PATH}`]);
    return staged(['write-tree']).trim();
  } finally {
    rmSync(index, { force: true });
  }
}

function commitWithThirdPath({ repo, git, sha }) {
  const parents = git(['rev-list', '--parents', '-n', '1', sha]).trim().split(' ').slice(1);
  const asOriginal = repositoryGit(repo, identityOf(git, sha));
  return asOriginal(
    [...PLAIN_COMMITS, 'commit-tree', treeWithThirdPath({ repo, sha }), ...parents.flatMap((parent) => ['-p', parent])],
    git(['log', '-1', '--format=%B', sha])
  ).trim();
}

const plantThirdPath = (sha) => async (copySite) => {
  const { repo, git } = headOfHistory(copySite);
  try {
    git(['cat-file', '-e', `${sha}^{commit}`]);
  } catch {
    throw new Error(`${sha} is not in the history of ${repo}, so there is no excepted commit to give a third path`);
  }
  git(['replace', sha, commitWithThirdPath({ repo, git, sha })]);
  return async () => {
    git(['replace', '--delete', sha]);
  };
};

export const exceptedCommitWithAThirdPath = (sha) => ({
  gate: GATE,
  token: `touched ${THIRD_PATH}, which is not this run's own and is not registered in derived-files.mjs for the catch-up to heal, in commit ${sha.slice(0, SHORT_SHA)}`,
  plant: plantThirdPath(sha),
});

export const legacySpecimens = () => ({
  autowriterExceptedCommitTouchesAThirdPath: exceptedCommitWithAThirdPath(SQUASH_OF_133.sha),
});
