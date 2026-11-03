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

export async function startScene({ archive = {}, openBranches = [], refuse = {} } = {}) {
  const dead = await startHost((req, res) => res.writeHead(404).end());
  const address = `${dead.origin}/reports/ai-rmf`;
  const archiveHost = await startArchive(archive);
  const github = await startGitHub({ openBranches, refuse });
  const repo = makeLinkRotRepo({
    files: {
      [ENTRY]: entryText({
        sources: [{ title: TITLE, url: address, publisher: 'NIST', retrieved: '2023-03-01' }],
        body: `See [the framework](${address}) for the detail.\n`,
      }),
    },
    dist: { 'index.html': [address] },
  });

  const run = () =>
    new Promise((done) => {
      const child = spawn(process.execPath, [SCRIPT, '--repo-root', repo.root, '--today', TODAY], {
        cwd: SITE,
        env: {
          ...GIT_ENVIRONMENT,
          ...archiveHost.environment,
          GITHUB_API_URL: github.origin,
          GITHUB_REPOSITORY: REPOSITORY,
          AUTOWRITER_PAT: 'a-token-the-fake-accepts',
          REPAIR_LINKS_ARCHIVE_SPACING_MS: '0',
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
