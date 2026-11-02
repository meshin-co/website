import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, posix } from 'node:path';

import { describeRefusal, isDispositionFile, refusalFor, sealSignature } from './autowriter-refusals.mjs';
import { GENERATION_DIR } from './generation-record.mjs';
import { BOT_EMAIL } from './pr-classify.mjs';

const PATH_RULE = 'refused-path-committed';
const SEAL_RULE = 'disposition-seal-committed';
const SHALLOW_REASON = 'the clone is shallow';
const MAX_BUFFER = 256 * 1024 * 1024;
const SHORT_SHA = 12;
const ABSENT = /^0+$/;
const PROVENANCE = /^Provenance:[ \t]*(\S.*?)[ \t]*$/gm;
const LOCATION_VARIABLES = [
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_DIR',
  'GIT_GRAFT_FILE',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_NAMESPACE',
  'GIT_NO_REPLACE_OBJECTS',
  'GIT_OBJECT_DIRECTORY',
  'GIT_PREFIX',
  'GIT_REPLACE_REF_BASE',
  'GIT_SHALLOW_FILE',
  'GIT_WORK_TREE',
];
const QUOTEPATH = ['-c', 'core.quotepath=off'];
const LOG = [
  ...QUOTEPATH,
  'log',
  '--full-history',
  '--no-merges',
  '--no-show-signature',
  '-z',
  '--format=%H%x00%ae%x00%B',
  '--',
  GENERATION_DIR,
];
const diffOf = (sha) => [
  ...QUOTEPATH,
  'diff-tree',
  '--root',
  '--no-commit-id',
  '-r',
  '--raw',
  '-z',
  '--no-renames',
  sha,
];

const isolatedEnvironment = () =>
  Object.fromEntries(Object.entries(process.env).filter(([name]) => !LOCATION_VARIABLES.includes(name)));

export const repositoryGit =
  (root, env = {}) =>
  (args, input) =>
    execFileSync('git', args, {
      cwd: root,
      env: { ...isolatedEnvironment(), ...env },
      input,
      encoding: 'utf8',
      maxBuffer: MAX_BUFFER,
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });

export const skippedLine = (reason) => `autowriter: history rules skipped: ${reason}`;

const isRecord = (path) => posix.dirname(path) === GENERATION_DIR && path.endsWith('.json');

function fieldsOf(text, size, what) {
  const fields = text.split('\0');
  if (fields.at(-1) === '') fields.pop();
  if (fields.length % size !== 0)
    throw new Error(`${what} printed ${fields.length} fields, which is not a whole number of ${size}`);
  return Array.from({ length: fields.length / size }, (_, index) => fields.slice(index * size, (index + 1) * size));
}

const loggedCommits = (text) => fieldsOf(text, 3, 'git log').map(([sha, email, message]) => ({ sha, email, message }));

const objectOrNull = (id) => (ABSENT.test(id) ? null : id);

const changesOf = (text) =>
  fieldsOf(text, 2, 'git diff-tree').map(([header, path]) => {
    const [, , before, after] = header.split(' ');
    return { path, before: objectOrNull(before), after: objectOrNull(after) };
  });

const namedRecords = (message) => [...message.matchAll(PROVENANCE)].map(([, path]) => path);

export function pipelineCommits(git) {
  return loggedCommits(git(LOG)).flatMap(({ sha, email, message }) => {
    const changes = changesOf(git(diffOf(sha)));
    const records = changes.map(({ path }) => path).filter(isRecord);
    const named = namedRecords(message);
    const isPipeline = records.length > 0 && (email === BOT_EMAIL || records.some((path) => named.includes(path)));
    return isPipeline ? [{ sha, records, changes }] : [];
  });
}

const describedSeal = ({ id, why, path, targets }) => {
  const what = targets.length === 0 ? `changed ${path}` : `sealed ${targets.join(', ')} in ${path}`;
  return `${what} (${describeRefusal({ id, why })})`;
};

const textOf = (read, id) => (id === null ? null : read(id));

function refusedThings({ changes }, read) {
  return changes.flatMap(({ path, before, after }) => {
    const refusal = refusalFor(path);
    if (refusal !== null) return [{ rule: PATH_RULE, detail: `touched ${refusal.path} (${describeRefusal(refusal)})` }];
    if (!isDispositionFile(path)) return [];
    const seal = sealSignature({ path, before: textOf(read, before), after: textOf(read, after) });
    return seal === null ? [] : [{ rule: SEAL_RULE, detail: describedSeal(seal) }];
  });
}

export function judgeCommit(commit, read) {
  const things = refusedThings(commit, read);
  const commitId = `in commit ${commit.sha.slice(0, SHORT_SHA)}`;
  return commit.records.flatMap((record) =>
    things.map(({ rule, detail }) => ({ rule, path: record, detail: `${detail}, ${commitId}` }))
  );
}

const notJudged = (skipped) => ({ findings: [], commits: null, skipped });

export function historyReport({ root, git = repositoryGit(root) }) {
  if (!existsSync(join(root, '.git'))) return notJudged(`${root} is not a git repository`);
  if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') return notJudged(SHALLOW_REASON);
  const commits = pipelineCommits(git);
  const read = (id) => git(['cat-file', 'blob', id]);
  return { findings: commits.flatMap((commit) => judgeCommit(commit, read)), commits: commits.length, skipped: null };
}
