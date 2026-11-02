import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { runCli } from '../spend-ceiling.mjs';
import { createScene, ledgerOf } from './spend-scene.mjs';

export const WEBHOOK = 'https://hooks.slack.test/services/T0SECRET/B0SECRET/xoxSECRETpath';
export const NOTICE = 'audits/autowriter/spend-ceiling-2026-11.json';
export const NOW = new Date('2026-11-10T09:00:00.000Z');
export const IN_NOVEMBER = '2026-11-03T08:00:00Z';

export const withScene = (body) => async () => {
  const scene = createScene();
  try {
    await body(scene);
  } finally {
    scene.cleanup();
  }
};

export const spending = (slug, usd, at = IN_NOVEMBER) => ledgerOf({ slug, attempts: [{ at, usd }] });
export function fakeApi({ slack = [200], issue = [201] } = {}) {
  const calls = { slack: [], issue: [] };
  const next = (list, count) => list[Math.min(count, list.length - 1)];
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    if (url === WEBHOOK) {
      calls.slack.push(body);
      return new Response('ok', { status: next(slack, calls.slack.length - 1) });
    }
    calls.issue.push(body);
    const code = next(issue, calls.issue.length - 1);
    return new Response(JSON.stringify({ number: 41, html_url: 'https://github.test/o/r/issues/41' }), {
      status: code,
    });
  };
  return { fetch, calls };
}

export function harness(scene, { api = fakeApi(), now = NOW } = {}) {
  const out = [];
  const err = [];
  const files = mkdtempSync(join(scene.root, '.runner-'));
  const env = {
    GITHUB_TOKEN: 'ghp_SECRETtokenVALUE0123456789',
    GITHUB_REPOSITORY: 'meshin-co/website',
    GITHUB_SERVER_URL: 'https://github.test',
    GITHUB_RUN_ID: '777',
    SLACK_WEBHOOK_URL: WEBHOOK,
    GITHUB_OUTPUT: join(files, 'output'),
    GITHUB_STEP_SUMMARY: join(files, 'summary'),
  };
  const run = (argv = []) =>
    runCli(['--repo-root', scene.root, ...argv], {
      env,
      fetch: api.fetch,
      now: () => now,
      stdout: (line) => out.push(line),
      stderr: (line) => err.push(line),
    });
  const read = (name) => (existsSync(env[name]) ? readFileSync(env[name], 'utf8') : '');
  return {
    run,
    out,
    err,
    api,
    env,
    output: () => read('GITHUB_OUTPUT'),
    summary: () => read('GITHUB_STEP_SUMMARY'),
    files,
  };
}
