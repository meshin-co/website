import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { CATCH_UP_SUBJECT, SHARED_DERIVED, classifyPath } from './derived-files.mjs';
import { entryRoute } from './entry-files.mjs';
import { BOT_EMAIL, BOT_NAME } from './pr-classify.mjs';
import { familyOf } from './record-layout.mjs';
import { healRoute } from './route-assembly.mjs';
import { passageOf } from './route-derive.mjs';
import { SEMANTIC_CORE } from './route-steps.mjs';
import { spendReportFile } from './spend-report.mjs';
import { REPORT_PATH, stampedAt } from './spend-report-text.mjs';
import { WriterError } from './writer-error.mjs';

const COMMIT_FLAGS = [
  '-c',
  `user.name=${BOT_NAME}`,
  '-c',
  `user.email=${BOT_EMAIL}`,
  '-c',
  'commit.gpgsign=false',
  '-c',
  'core.hooksPath=/dev/null',
];
const ROW_FILES = {
  'audits/routes.json': (line) => /^ {2}"\//.test(line),
  'site/content-facts.json': (line) => /^ {4}"\//.test(line),
  [SEMANTIC_CORE]: (line) => line.startsWith('Passage:'),
};

const lines = (text) => text.split('\n').filter((line) => line !== '');
const withoutComma = (line) => line.replace(/,$/, '');

function gitIn(run, repoRoot) {
  const git = (...args) => run('git', args, { cwd: repoRoot });
  const read = (...args) => {
    const result = git(...args);
    if (result.status !== 0)
      throw new WriterError(
        'commit',
        `git ${args.join(' ')} exited with status ${result.status}: ${result.stderr.trim()}`
      );
    return result.stdout;
  };
  return { git, read, names: (...args) => lines(read(...args)) };
}

function lostRows({ repoRoot, shown, mergeBase, head }) {
  const lost = [];
  for (const [path, isRow] of Object.entries(ROW_FILES)) {
    const before = lines(shown(mergeBase, path));
    const added = lines(shown(head, path)).filter((line) => isRow(line) && !before.includes(line));
    const kept = new Set(lines(readFileSync(join(repoRoot, path), 'utf8')).map(withoutComma));
    for (const line of added) if (!kept.has(withoutComma(line))) lost.push(`${path}: ${line.trim().slice(0, 80)}`);
  }
  return lost;
}

function stampOf({ git }, revision) {
  const shown = git('show', `${revision}:${REPORT_PATH}`);
  return shown.status === 0 ? stampedAt(shown.stdout) : undefined;
}

function reportText({ repoRoot, revision, at }) {
  if (at === undefined) throw new WriterError('commit', `neither main nor the branch carries a ${REPORT_PATH} stamp`);
  return spendReportFile({ repoRoot, revision, at }).text;
}

const write = (repoRoot, files) => files.forEach(({ path, text }) => writeFileSync(join(repoRoot, path), text));

export async function catchUp({ repoRoot, head, base, run }) {
  const { git, read, names } = gitIn(run, repoRoot);
  const shown = (revision, path) => read('show', `${revision}:${path}`);
  if (read('rev-parse', 'HEAD').trim() !== head)
    throw new WriterError('commit', `the branch moved: HEAD is not ${head}`);
  if (read('status', '--porcelain').trim() !== '') throw new WriterError('commit', 'the working tree is not clean');
  if (git('merge-base', '--is-ancestor', base, head).status === 0) return { outcome: 'current' };

  const mergeBase = read('merge-base', base, head).trim();
  const claimPaths = names('diff', '--name-only', mergeBase, head).filter((path) => familyOf(path) === 'claim');
  if (claimPaths.length === 0)
    throw new WriterError('commit', 'the branch changes no claim record, so it is not a writer run');
  const claims = claimPaths.map((path) => JSON.parse(shown(head, path)));
  const slugs = claims.map(({ slug }) => slug);
  const stop = (outcome, paths) => {
    git('merge', '--abort');
    read('reset', '--hard', head);
    return { outcome, paths };
  };

  try {
    const merged = git('merge', '--no-commit', '--no-ff', base);
    const unmerged = names('diff', '--name-only', '--diff-filter=U');
    if (merged.status > 1 && unmerged.length === 0)
      throw new WriterError('commit', `git merge ${base}: ${merged.stderr.trim()}`);
    const blocked = unmerged.filter((path) => !['shared', 'restated'].includes(classifyPath(path, slugs)));
    if (blocked.length > 0) return stop('conflict', blocked);
    for (const path of new Set([...SHARED_DERIVED, ...unmerged])) read('checkout', base, '--', path);

    const headCore = shown(head, SEMANTIC_CORE);
    const entries = claims.map((claim) => ({
      claim,
      passage: claim.prompt
        ? passageOf(headCore, { promptNumber: claim.prompt.number, route: entryRoute(claim) })
        : null,
    }));
    const unread = entries.filter(({ claim, passage }) => claim.prompt && passage === null);
    if (unread.length > 0) return stop('lost-rows', [SEMANTIC_CORE]);

    const baseSha = read('rev-parse', base).trim();
    const at = [stampOf({ git }, base), stampOf({ git }, head)].filter(Boolean).sort().at(-1);
    const files = [...(await healRoute({ repoRoot, entries, run })).files];
    files.push({ path: REPORT_PATH, text: reportText({ repoRoot, revision: baseSha, at }) });
    write(repoRoot, files);

    const again = [...(await healRoute({ repoRoot, entries, run })).files];
    again.push({ path: REPORT_PATH, text: reportText({ repoRoot, revision: baseSha, at }) });
    const moved = again.filter(({ path, text }) => readFileSync(join(repoRoot, path), 'utf8') !== text);
    if (moved.length > 0)
      return stop(
        'unconverged',
        moved.map(({ path }) => path)
      );

    const lost = lostRows({ repoRoot, shown, mergeBase, head });
    if (lost.length > 0) return stop('lost-rows', lost);

    read('add', '--', ...files.map(({ path }) => path));
    const loose = names('diff', '--name-only');
    if (loose.length > 0) return stop('out-of-scope', loose);
    read(
      ...COMMIT_FLAGS,
      'commit',
      '--quiet',
      '-m',
      `${CATCH_UP_SUBJECT}${slugs.join(', ')} on ${baseSha.slice(0, 7)}`
    );

    const net = names('diff', '--name-only', base, 'HEAD');
    const outside = net.filter((path) => classifyPath(path, slugs) === 'foreign');
    if (git('merge-tree', '--write-tree', '--no-messages', base, 'HEAD').status !== 0 || outside.length > 0) {
      read('reset', '--hard', head);
      return { outcome: 'out-of-scope', paths: outside };
    }
    return { outcome: 'caught-up', commit: read('rev-parse', 'HEAD').trim(), base: baseSha, paths: net };
  } catch (error) {
    git('merge', '--abort');
    read('reset', '--hard', head);
    throw error;
  }
}
