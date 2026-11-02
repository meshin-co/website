import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { newLedger } from '../autowriter-ledger.mjs';
import { buildRecord } from '../generation-record.mjs';
import { callOf, recordInput } from './generation-input.mjs';

export const GIT_ENVIRONMENT = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};
const IDENTITY = ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test'];
const MICRO = 1e6;

const part = (usd) => ({ tokens: { input: Math.round(usd * MICRO), output: 0 }, costUsd: usd });
const sum = (values) => values.reduce((total, value) => total + value, 0);

export function ledgerOf({ slug, generationUsd, attempts = [], decidedAt = null }) {
  const made = attempts.map(({ at, usd }, index) => ({
    number: index + 1,
    judgedCommit: 'a'.repeat(40),
    recordedAt: at,
    failingRule: null,
    failingPath: null,
    ...part(usd),
  }));
  const parts = generationUsd === undefined ? made : [part(generationUsd), ...made];
  const verdict = decidedAt === null ? {} : { verdict: { state: 'stopped', reason: 'generation failed', decidedAt } };
  return {
    ...newLedger({ slug, runId: '1', pullRequest: null }),
    attempts: made,
    ...(generationUsd === undefined ? {} : { generation: part(generationUsd) }),
    spend: {
      tokens: { input: sum(parts.map((entry) => entry.tokens.input)), output: 0 },
      costUsd: sum(parts.map((entry) => entry.costUsd)),
    },
    ...verdict,
  };
}

export function recordOf({ slug, generatedAt, usd }) {
  const input = recordInput();
  const entryPath = `site/src/data/post/${slug}.md`;
  return buildRecord({
    ...input,
    claim: { ...input.claim, slug },
    route: `/blog/${slug}`,
    entryPath,
    ledger: `audits/autowriter/${slug}.json`,
    generatedAt,
    calls: [callOf('draft', { input: Math.round(usd * MICRO), output: 0 }, `draft-${slug}`)],
    published: { callIndex: 0 },
    files: [entryPath, `audits/autowriter/generations/${slug}.json`, 'docs/SEMANTIC-CORE.md'],
  });
}

export function createScene() {
  const root = mkdtempSync(join(tmpdir(), 'spend-scene-'));
  const git = (...args) =>
    execFileSync('git', [...IDENTITY, ...args], { cwd: root, env: GIT_ENVIRONMENT, encoding: 'utf8' }).trim();
  const put = (path, value) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  };
  const commit = (message = 'commit') => {
    git('add', '-A');
    git('commit', '-q', '-m', message);
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q', '-b', 'main');
  put('README.md', 'scene\n');
  commit('start');
  const scene = {
    root,
    git,
    put,
    commit,
    putLedger: (ledger) => put(`audits/autowriter/${ledger.slug}.json`, ledger),
    putRecord: (record) => put(`audits/autowriter/generations/${record.slug}.json`, record),
    onBranch(name, work) {
      git('checkout', '-q', '-b', name);
      work(scene);
      const tip = commit(`work on ${name}`);
      git('checkout', '-q', 'main');
      return tip;
    },
    asRemote(name, work) {
      const tip = scene.onBranch('staging', work);
      git('update-ref', `refs/remotes/origin/${name}`, tip);
      git('branch', '-q', '-D', 'staging');
      return tip;
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
  return scene;
}
