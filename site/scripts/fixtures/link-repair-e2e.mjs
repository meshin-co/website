import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

import { REPOSITORY, startGitHub } from './github-host.mjs';
import { startHost } from './http-host.mjs';
import { GIT_ENVIRONMENT, entryText, makeLinkRotRepo } from './link-rot-repo.mjs';
import { startArchive } from './wayback-host.mjs';
import { availabilityFor } from './wayback-recorded.mjs';

const SCRIPT = resolve(import.meta.dirname, '..', 'repair-links.mjs');
const SITE = resolve(import.meta.dirname, '..', '..');

export const TODAY = '2026-11-03';
export const TITLE = 'AI Risk Management Framework';
export const ENTRY = 'site/src/data/glossary/ai-rmf.md';
export const BRANCH = `autowriter/link-rot-${TODAY}`;
export const newestCapture = () =>
  availabilityFor({ address: 'http://x.example/', timestamp: null }).archived_snapshots.closest;

const gone = (req, res) => res.writeHead(404).end();

const openEntry = (address) => ({
  [ENTRY]: entryText({
    sources: [{ title: TITLE, url: address, publisher: 'NIST', retrieved: '2023-03-01' }],
    body: `See [the framework](${address}) for the detail.\n`,
  }),
});

export async function startScene({
  archive = {},
  openBranches = [],
  refuse = {},
  host = null,
  respond = gone,
  files = openEntry,
  outbound = (address) => [address],
} = {}) {
  const dead = await startHost(respond);
  const origin = host === null ? dead.origin : `http://${host}:${new URL(dead.origin).port}`;
  const address = `${origin}/reports/ai-rmf`;
  const archiveHost = await startArchive(archive);
  const github = await startGitHub({ openBranches, refuse });
  const repo = makeLinkRotRepo({ files: files(address), dist: { 'index.html': outbound(address) } });

  const run = ({ today = TODAY, args = [], env = {}, nodeArgs = [] } = {}) =>
    new Promise((done) => {
      const argv = [...nodeArgs, SCRIPT, '--repo-root', repo.root, '--today', today, ...args];
      const child = spawn(process.execPath, argv, {
        cwd: SITE,
        env: {
          ...GIT_ENVIRONMENT,
          ...archiveHost.environment,
          GITHUB_API_URL: github.origin,
          GITHUB_REPOSITORY: REPOSITORY,
          AUTOWRITER_PAT: 'a-token-the-fake-accepts',
          REPAIR_LINKS_ARCHIVE_SPACING_MS: '0',
          ...env,
        },
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => (stdout += chunk));
      child.stderr.on('data', (chunk) => (stderr += chunk));
      child.on('close', (code) => done({ code, stdout, stderr }));
    });

  const close = async () => {
    await Promise.all([dead.close(), archiveHost.close(), github.close()]);
    repo.remove();
  };
  return { address, repo, github, archive: archiveHost, dead, run, close };
}
