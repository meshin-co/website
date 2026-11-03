import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { commitAndPush, runGit } from './commit-to-main.mjs';
import { variable } from './escalate-channels.mjs';
import { BRANCH_PREFIX, branchFor, commitMessage, pullRequestBody, pullRequestTitle } from './link-repair-report.mjs';
import { BOT_IDENTITY } from './pr-classify.mjs';
import { createApi, dispatchSuccessor } from './pr-github.mjs';
import { WORKFLOW } from './pr-watch.mjs';

export const SECRET = 'AUTOWRITER_PAT';
export const BASE_BRANCH = 'main';

const PAGE_SIZE = 100;
const MAX_PAGES = 10;

export class PublishError extends Error {
  name = 'PublishError';
}

export function connectGitHub({ env, fetch }) {
  const repo = variable(env, 'GITHUB_REPOSITORY');
  const token = variable(env, SECRET);
  const missing = [...(repo === '' ? ['GITHUB_REPOSITORY'] : []), ...(token === '' ? [SECRET] : [])];
  if (missing.length > 0)
    throw new PublishError(
      `${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} not set, so the job cannot open a pull request`
    );
  const origin = variable(env, 'GITHUB_API_URL');
  return createApi({ repo, token, fetch, ...(origin === '' ? {} : { origin }) });
}

export async function openLinkRotPulls(api) {
  const open = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const batch = await api.get(`pulls?state=open&per_page=${PAGE_SIZE}&page=${page}`);
    open.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return open.filter(({ head }) => head.ref.startsWith(BRANCH_PREFIX));
}

const gitStep = (run, cwd) => async (label, args) => {
  const result = await run(args, { cwd });
  if (result.status !== 0) throw new PublishError(`git ${label} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
};

async function freeBranch(step, today) {
  for (let attempt = 1; ; attempt += 1) {
    const name = branchFor(today, attempt);
    if ((await step('ls-remote', ['ls-remote', '--heads', 'origin', `refs/heads/${name}`])) === '') return name;
  }
}

const runUrlOf = (env) => {
  const id = variable(env, 'GITHUB_RUN_ID');
  if (id === '') return undefined;
  return `${variable(env, 'GITHUB_SERVER_URL') || 'https://github.com'}/${variable(env, 'GITHUB_REPOSITORY')}/actions/runs/${id}`;
};

const noSettle = async () => [];

export async function publishRepair({
  repoRoot,
  api,
  result,
  today,
  env,
  run = runGit,
  commit = commitAndPush,
  settle = noSettle,
}) {
  const step = gitStep(run, repoRoot);
  const branch = await freeBranch(step, today);
  const here = await step('rev-parse', ['rev-parse', '--abbrev-ref', 'HEAD']);
  const previous = here === 'HEAD' ? await step('rev-parse', ['rev-parse', 'HEAD']) : here;
  await step('checkout', ['checkout', '--quiet', '-b', branch]);
  try {
    for (const [path, text] of result.files) {
      mkdirSync(dirname(join(repoRoot, path)), { recursive: true });
      writeFileSync(join(repoRoot, path), text);
    }
    const settled = await settle({ repoRoot, result });
    const paths = [...result.files.keys(), ...settled];
    const identity = BOT_IDENTITY;
    const outcome = await commit({
      repoRoot,
      paths,
      message: commitMessage({ today, counts: result.counts }),
      identity,
      ref: branch,
      run,
    }).catch((error) => {
      throw new PublishError(error.message);
    });
    if (!outcome.committed) throw new PublishError('the repair changed no file git could commit');
    try {
      const pull = await api.post('pulls', {
        title: pullRequestTitle({ today, counts: result.counts }),
        head: branch,
        base: BASE_BRANCH,
        body: pullRequestBody({ today, result, runUrl: runUrlOf(env) }),
      });
      await dispatchSuccessor(api, { workflow: WORKFLOW, ref: BASE_BRANCH, inputs: { pr: String(pull.number) } });
      return pull.html_url;
    } catch (error) {
      throw new PublishError(
        `the branch ${branch} was pushed, but the pull request or the watcher failed: ${error.message}`
      );
    }
  } finally {
    await run(['checkout', '--quiet', previous], { cwd: repoRoot });
  }
}
