import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const REL = 'rel="nofollow noopener noreferrer"';
const SEED_IDENTITY = ['-c', 'user.name=Seed', '-c', 'user.email=seed@example.test', '-c', 'commit.gpgsign=false'];

export const GIT_ENVIRONMENT = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_TERMINAL_PROMPT: '0',
};

export const SITE_ORIGIN = 'https://example.test';

const quoted = (text) => `'${String(text).replaceAll("'", "''")}'`;

export function sourceRow({ title, url, publisher, retrieved, original }) {
  const lines = [`  - title: ${quoted(title)}`, `    url: ${quoted(url)}`];
  if (original !== undefined) lines.push(`    original: ${quoted(original)}`);
  if (publisher !== undefined) lines.push(`    publisher: ${quoted(publisher)}`);
  if (retrieved !== undefined) lines.push(`    retrieved: ${retrieved}`);
  return lines.join('\n');
}

export function entryText({
  title = 'What a gone citation looks like',
  updatedDate = '2023-03-01',
  sources,
  body = 'A sentence.\n',
}) {
  return [
    '---',
    `title: ${quoted(title)}`,
    "shortAnswer: 'A short answer that stands on its own.'",
    'publishDate: 2023-03-01',
    `updatedDate: ${updatedDate}`,
    'sources:',
    ...sources.map(sourceRow),
    '---',
    '',
    body,
  ].join('\n');
}

export function distPage(addresses) {
  const anchors = addresses.map((address) => `<a href="${address}" ${REL}>cited</a>`).join('');
  return `<!doctype html><html><head><title>t</title></head><body>${anchors}</body></html>`;
}

const defaultFiles = () => ({
  'site/src/config.yaml': `site:\n  site: ${SITE_ORIGIN}\n`,
});

export function makeLinkRotRepo({ files = {}, dist = {}, versioned = true } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'link-rot-repo-'));
  const remote = join(base, 'origin.git');
  const root = join(base, 'work');
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, env: GIT_ENVIRONMENT, encoding: 'utf8' }).trim();
  const put = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };

  mkdirSync(root);
  if (versioned) {
    git(base, 'init', '--quiet', '--bare', '--initial-branch=main', remote);
    git(root, 'init', '--quiet', '--initial-branch=main');
    git(root, 'remote', 'add', 'origin', remote);
  }
  for (const [path, text] of Object.entries({ ...defaultFiles(), ...files })) put(path, text);
  for (const [page, addresses] of Object.entries(dist)) put(`site/dist/${page}`, distPage(addresses));
  put('.gitignore', 'site/dist/\n');
  if (versioned) {
    git(root, 'add', '--all');
    git(root, ...SEED_IDENTITY, 'commit', '--quiet', '-m', 'seed');
    git(root, 'push', '--quiet', 'origin', 'main');
  }

  const commit = (message = 'fixture') => {
    git(root, 'add', '--all');
    git(root, ...SEED_IDENTITY, 'commit', '--quiet', '--allow-empty', '-m', message);
    return git(root, 'rev-parse', 'HEAD');
  };

  return {
    root,
    siteRoot: join(root, 'site'),
    dist: join(root, 'site', 'dist'),
    remote,
    git: (...args) => git(root, ...args),
    put,
    read: (path) => readFileSync(join(root, path), 'utf8'),
    exists: (path) => existsSync(join(root, path)),
    commit,
    push: () => git(root, 'push', '--quiet', 'origin', 'main'),
    remoteBranches: () =>
      git(remote, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/').split('\n').filter(Boolean).sort(),
    remoteFile: (branch, path) => git(remote, 'show', `${branch}:${path}`),
    remoteLog: (branch) => git(remote, 'log', '--format=%an <%ae> | %cn <%ce> | %s', branch).split('\n'),
    remove: () => rmSync(base, { recursive: true, force: true }),
  };
}
