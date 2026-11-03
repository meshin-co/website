import { GitHubError } from '../pr-github.mjs';
import { createResumeSweep } from '../pr-resume.mjs';
import { NOW, OWN_COMMITS, ledgerRecord, openPull } from './resume-world.mjs';

export const READER = 'default-token-value';
export const WRITER = 'pat-secret-value';
export const REPOSITORY = 'meshin-co/website';

const WRITES = ['putLedger', 'dispatchSuccessor', 'commentOnIssue', 'closeIssue'];

export const refusal = (method, path, status, message) => new GitHubError({ method, path, status, body: { message } });

export const named = (calls, name) => calls.filter(([called]) => called === name);
export const writes = (calls) => calls.filter(([name]) => WRITES.includes(name)).map(([name]) => name);

export function sweepWorld({
  pulls = [openPull()],
  ledgers = [ledgerRecord()],
  branchCommits = {},
  main = [],
  issues = [],
  closed = {},
  failWith = {},
  now = NOW,
} = {}) {
  const calls = [];
  const stored = new Map(ledgers.map((record) => [record.value.slug, record]));
  const known = new Map([...pulls, ...Object.values(closed)].map((pull) => [pull.number, pull]));
  const fail = (name, args) => {
    const failure = failWith[name];
    const error = typeof failure === 'function' ? failure(args) : failure;
    if (error) throw error;
  };
  const record = (name, api, args) => {
    calls.push([name, api.token, args]);
    fail(name, args);
  };
  const io = {
    createApi: ({ token }) => ({ token, repo: REPOSITORY }),
    listOpenPullRequests: async (api) => {
      record('listOpenPullRequests', api);
      return pulls;
    },
    readPullRequest: async (api, number) => {
      record('readPullRequest', api, number);
      if (!known.has(number)) throw refusal('GET', `pulls/${number}`, 404, 'Not Found');
      return known.get(number);
    },
    readBranchCommits: async (api, number) => {
      record('readBranchCommits', api, number);
      return branchCommits[number] ?? OWN_COMMITS;
    },
    readLedgerAt: async (api, args) => {
      record('readLedgerAt', api, args);
      return stored.get(args.slug) ?? null;
    },
    listRecentCommits: async (api, args) => {
      record('listRecentCommits', api, args);
      return main.slice(0, args.limit).map(({ sha, committedAt }) => ({ sha, committedAt }));
    },
    readCommitFiles: async (api, sha) => {
      record('readCommitFiles', api, sha);
      return main.find((commit) => commit.sha === sha).files;
    },
    listOpenIssues: async (api) => {
      record('listOpenIssues', api);
      return issues;
    },
    commentOnIssue: async (api, args) => record('commentOnIssue', api, args),
    closeIssue: async (api, args) => record('closeIssue', api, args),
    putLedger: async (api, args) => {
      record('putLedger', api, args);
      const value = JSON.parse(args.text);
      stored.set(value.slug, { value, blobSha: `after-${calls.length}`, path: args.path });
      return { commit: 'e'.repeat(40) };
    },
    dispatchSuccessor: async (api, args) => record('dispatchSuccessor', api, args),
  };
  const sweep = createResumeSweep({
    io,
    reader: io.createApi({ token: READER }),
    writer: io.createApi({ token: WRITER }),
    ref: 'main',
    now: () => now,
  });
  return { sweep, calls, io, stored };
}
