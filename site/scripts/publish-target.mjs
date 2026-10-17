import { PROSE_DIRS } from './build-surface.mjs';

const isProse = (path) =>
  !path.startsWith('site/src/') && (path.endsWith('.md') || PROSE_DIRS.some((dir) => path.startsWith(dir)));

export function pickGatedRun(runs) {
  return runs.find((run) => run.head_branch === 'main' && run.conclusion === 'success' && run.hasDist);
}

export function blockingFiles(files) {
  return files.filter((path) => !isProse(path));
}
