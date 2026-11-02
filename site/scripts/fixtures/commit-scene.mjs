import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { claimFile } from '../autowriter-claims.mjs';
import { ledgerFile } from '../autowriter-ledger.mjs';
import { generationFile } from '../generation-record.mjs';
import { BOT_EMAIL, BOT_NAME } from '../pr-classify.mjs';
import { WriterError } from '../writer-error.mjs';
import { FIXTURE_IDENTITY, gitIn, makeRepo, snapshotOf } from './route-repo.mjs';

const SLUG = 'model-registry';

export const BRANCH = `autowriter/${SLUG}`;
export const MESSAGE = 'content: add the model registry term\n\nWritten by the unattended writer.';

const put = (root, path, text) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

export function scene() {
  const root = makeRepo();
  put(root, claimFile(SLUG), '{"status":"claimed"}\n');
  gitIn(root, 'add', '--', claimFile(SLUG));
  gitIn(root, ...FIXTURE_IDENTITY, 'commit', '--quiet', '-m', 'claim');

  const read = (path) => readFileSync(join(root, path), 'utf8');
  const files = [
    { path: `site/src/data/glossary/${SLUG}.md`, text: '---\ntitle: What is a model registry?\n---\nBody.\n' },
    {
      path: 'site/content-facts.json',
      text: read('site/content-facts.json').replace(
        '    "/glossary/ai-register": "ai register",\n',
        '    "/glossary/ai-register": "ai register",\n    "/glossary/model-registry": "model registry",\n'
      ),
    },
    { path: 'docs/SEMANTIC-CORE.md', text: `${read('docs/SEMANTIC-CORE.md')}\nOne more line.\n` },
    { path: `audits/phase-4.7/dispositions/generated-${SLUG}.json`, text: '[]\n' },
    { path: generationFile(SLUG), text: `{"slug":"${SLUG}"}\n` },
    { path: ledgerFile(SLUG), text: '{"attempts":1}\n' },
    { path: claimFile(SLUG), text: '{"status":"written"}\n' },
  ];
  put(root, 'scratch.txt', 'a file nobody listed\n');
  put(root, 'audits/phase-4.7/dispositions/existing.json', '[{"changed":"by someone else"}]\n');
  return { root, start: gitIn(root, 'rev-parse', 'HEAD').trim(), files, listed: files.map(({ path }) => path).sort() };
}

export const committedFiles = (root, ref = 'HEAD') =>
  gitIn(root, 'show', '--name-only', '--format=', ref).split('\n').filter(Boolean).sort();

export const BOT = `${BOT_NAME}|${BOT_EMAIL}|${BOT_NAME}|${BOT_EMAIL}`;

export const stateOf = (root) => ({
  files: snapshotOf(root),
  head: gitIn(root, 'rev-parse', 'HEAD'),
  branches: gitIn(root, 'branch', '--format=%(refname:short)'),
  current: gitIn(root, 'branch', '--show-current'),
  staged: gitIn(root, 'diff', '--cached', '--name-only'),
});

export const refusedAs = (pattern) => (error) =>
  error instanceof WriterError && error.kind === 'commit' && pattern.test(error.message);

export const refusedWith =
  (...parts) =>
  (error) =>
    error instanceof WriterError && error.kind === 'commit' && parts.every((part) => error.message.includes(part));

export const changedGit = (calls) =>
  calls.some((args) => ['checkout', 'add', 'commit', 'reset'].some((word) => args.includes(word)));

export const onBranch = ({ root }) => gitIn(root, 'checkout', '--quiet', '-b', BRANCH);

export const INVALID_REQUESTS = {
  'nothing to commit': { files: [] },
  'files that are not a list': { files: { path: 'a.md', text: 'x' } },
  'an entry that is not an object': { files: [null] },
  'an absolute path': { extra: { path: '/etc/hosts', text: 'x' } },
  'a path that leaves the repository': { extra: { path: '../outside.txt', text: 'x' } },
  'a path inside .git': { extra: { path: '.git/config', text: 'x' } },
  'a path that is not normalised': { extra: { path: 'site//content-facts.json', text: 'x' } },
  'a path with a backslash': { extra: { path: 'site\\content-facts.json', text: 'x' } },
  'a path that names a directory': { extra: { path: 'site/', text: 'x' } },
  'a path listed twice': { extra: { path: 'site/content-facts.json', text: 'x' } },
  'a file without text': { extra: { path: 'audits/autowriter/x.json' } },
  'a file whose text is not a string': { extra: { path: 'audits/autowriter/x.json', text: 12 } },
  'an empty message': { message: '   ' },
  'a branch that starts with a dash': { branch: '--force' },
  'a branch with a space': { branch: 'autowriter/a b' },
  'a branch with two dots': { branch: 'autowriter/a..b' },
  'an empty branch': { branch: '' },
  'no branch': { branch: undefined },
};
