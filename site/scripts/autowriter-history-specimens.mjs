import { existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { repositoryGit } from './autowriter-refusal-rules.mjs';
import { DISPOSITION_DIRECTORY, isDispositionFile, sealSignature } from './autowriter-refusals.mjs';
import { generationFile } from './generation-record.mjs';
import { BOT_EMAIL, BOT_NAME } from './pr-classify.mjs';

const GATE = 'gate:autowriter';
const RECORD = generationFile('zz-specimen');
const MESSAGE = `feat(autowriter): write zz-specimen\n\nProvenance: ${RECORD}`;
const TEMPORARY_INDEX = 'zz-specimen-index';
const PLAIN_COMMITS = ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null'];
const BOT_IDENTITY = {
  GIT_AUTHOR_NAME: BOT_NAME,
  GIT_AUTHOR_EMAIL: BOT_EMAIL,
  GIT_COMMITTER_NAME: BOT_NAME,
  GIT_COMMITTER_EMAIL: BOT_EMAIL,
};
const MOVED_DIGEST = '0'.repeat(12);
const OTHER_DIGEST = '1'.repeat(12);

const markerOn = (original) => `${JSON.stringify({ zzSpecimen: original })}\n`;

function movedFirstDigest(text) {
  let entries;
  try {
    entries = JSON.parse(text);
  } catch {
    return null;
  }
  const [first] = Array.isArray(entries) ? entries : [];
  if (typeof first?.digest !== 'string') return null;
  first.digest = first.digest === MOVED_DIGEST ? OTHER_DIGEST : MOVED_DIGEST;
  return `${JSON.stringify(entries, null, 2)}\n`;
}

function sealedDisposition({ git, original }) {
  const listed = git(['ls-tree', '-r', '--name-only', '-z', original, '--', `${DISPOSITION_DIRECTORY}/`]);
  for (const path of listed.split('\0').filter(isDispositionFile).sort()) {
    const before = git(['show', `${original}:${path}`]);
    const after = movedFirstDigest(before);
    if (after !== null && sealSignature({ path, before, after })?.id === 'disposition-seal') return { [path]: after };
  }
  throw new Error(
    `${DISPOSITION_DIRECTORY} holds no disposition file at HEAD whose first entry can change its digest alone, ` +
      'so there is nothing to seal'
  );
}

function commitOver({ repo, original, files }) {
  const index = join(repositoryGit(repo)(['rev-parse', '--absolute-git-dir']).trim(), TEMPORARY_INDEX);
  const staged = repositoryGit(repo, { GIT_INDEX_FILE: index });
  try {
    staged(['read-tree', original]);
    for (const [path, text] of Object.entries(files)) {
      const blob = staged(['hash-object', '-w', '--stdin'], text).trim();
      staged(['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`]);
    }
    const tree = staged(['write-tree']).trim();
    const asBot = repositoryGit(repo, BOT_IDENTITY);
    return asBot([...PLAIN_COMMITS, 'commit-tree', tree, '-p', original, '-m', MESSAGE]).trim();
  } finally {
    rmSync(index, { force: true });
  }
}

const planCommit = (filesOn) => async (copySite) => {
  const repo = resolve(copySite, '..');
  if (!existsSync(join(repo, '.git')))
    throw new Error(`${repo} is not a git repository, so it has no history to plant in`);
  const git = repositoryGit(repo);
  if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true')
    throw new Error(`${repo} is a shallow clone, and the history rules judge nothing there`);
  const original = git(['rev-parse', 'HEAD']).trim();
  const files = { [RECORD]: markerOn(original), ...filesOn({ git, original }) };
  const commit = commitOver({ repo, original, files });
  const asBot = repositoryGit(repo, BOT_IDENTITY);
  asBot([...PLAIN_COMMITS, 'update-ref', 'HEAD', commit, original]);
  return async () => {
    asBot([...PLAIN_COMMITS, 'update-ref', 'HEAD', original, commit]);
  };
};

const refusedFile = (path, id) => ({
  gate: GATE,
  token: `refused-path-committed ${RECORD}: touched ${path} (${id}:`,
  plant: planCommit(({ original }) => ({ [path]: markerOn(original) })),
});

export const historySpecimens = () => ({
  autowriterCommitMovesTheBand: refusedFile('audits/sentence-band.json', 'sentence-band'),
  autowriterCommitMovesTheEntryLength: refusedFile('audits/entry-length.json', 'entry-length'),
  autowriterCommitWritesLighthouseRecord: refusedFile('audits/lighthouse-green.json', 'lighthouse-record'),
  autowriterCommitWritesLighthouseStamp: refusedFile('audits/phase-zz/lh-measured.json', 'lighthouse-stamp'),
  autowriterCommitWritesLighthouseReport: refusedFile('audits/phase-zz/lh-mobile/lhr-0.json', 'lighthouse-report'),
  autowriterCommitSealsDispositions: {
    gate: GATE,
    token: `disposition-seal-committed ${RECORD}: sealed`,
    plant: planCommit(sealedDisposition),
  },
});
