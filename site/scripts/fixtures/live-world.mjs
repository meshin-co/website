import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { NOW, liveRepo } from './live-repo.mjs';
import { closedOrigin, localServer, reply } from './local-server.mjs';

export { NOW };
export const WEBHOOK_PATH = '/services/T0SECRET/B0SECRET/xoxSECRETpath';
export const SECRETS = /xoxSECRET|T0SECRET|B0SECRET/;
export const STATUS = { month: '2026-11', spentMicro: 62_000, ceilingUsd: 25 };
export const RUN_ENV = { GITHUB_SERVER_URL: 'https://github.test', GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: '777' };

export const accepts = ({ response }) => reply(response, 200, {}, 'ok');

export const ARTICLE = {
  slug: 'a-post',
  hoursAgo: 6,
  title: 'What an AI system register holds',
  prompt: { number: 3, text: 'How do I keep an AI system register?' },
};
export const TERM = {
  slug: 'a-term',
  format: 'term',
  hoursAgo: 3,
  title: 'What is an AI register?',
  input: 6_000,
  output: 1_200,
};
export const aged = (slug, hoursAgo) => ({ slug, hoursAgo });

export const failing =
  (path, status, times = Infinity) =>
  ({ request, response, seen }) =>
    reply(response, request.url === path && seen <= times ? status : 200);

export function flakySlack() {
  const state = { healthy: false };
  const slack = ({ request, response }) =>
    state.healthy ? reply(response, 200, {}, 'ok') : reply(response, 500, {}, `no hook at ${request.url}`);
  return {
    slack,
    recover: () => {
      state.healthy = true;
    },
    fail: () => {
      state.healthy = false;
    },
  };
}

export async function liveWorld({
  runCli,
  entries = [{ slug: 'a-post' }],
  built,
  state = { announced: {} },
  site = accepts,
  slack = accepts,
  closed = false,
}) {
  const repo = liveRepo({ entries, built });
  const statePath = join(repo.base, '.live-entries.json');
  if (state !== null) writeFileSync(statePath, typeof state === 'string' ? state : `${JSON.stringify(state)}\n`);
  const liveSite = closed ? null : await localServer(site);
  const origin = closed ? await closedOrigin() : liveSite.origin;
  const hooks = await localServer(slack);
  const webhook = `${hooks.origin}${WEBHOOK_PATH}`;
  const waits = [];
  const shown = { out: [], err: [] };

  const lines = () => ({ out: [...shown.out], err: [...shown.err] });
  const io = ({ env = {}, now = () => NOW, hook = true } = {}) => {
    shown.out.length = 0;
    shown.err.length = 0;
    return {
      env: { ...RUN_ENV, ...(hook && { SLACK_WEBHOOK_URL: webhook }), ...env },
      now,
      sleep: async (ms) => void waits.push(ms),
      stdout: (line) => shown.out.push(line),
      stderr: (line) => shown.err.push(line),
    };
  };

  async function run({ args, statusOf = () => STATUS, unmeasuredOf = async () => null, ...options } = {}) {
    const argv = args ?? ['--dist', repo.dist, '--state', statePath, '--repo-root', repo.root];
    const code = await runCli(argv, { ...io(options), origin, statusOf, unmeasuredOf });
    return { code, ...lines() };
  }

  return {
    ...repo,
    origin,
    webhook,
    statePath,
    waits,
    run,
    io,
    lines,
    visits: (path) => (liveSite?.requests ?? []).filter(({ url }) => url === path).length,
    posted: () => hooks.requests.filter(({ method }) => method === 'POST').map(({ body }) => JSON.parse(body)),
    bodies: () => hooks.requests.map(({ body }) => body),
    state: () => JSON.parse(readFileSync(statePath, 'utf8')),
    stateText: () => readFileSync(statePath, 'utf8'),
    close: async () => {
      await Promise.all([liveSite?.close(), hooks.close()]);
      repo.remove();
    },
  };
}
