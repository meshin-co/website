import { drawsFullGraph } from './build-surface.mjs';

export function pickGatedRun(runs) {
  return runs.find((run) => run.head_branch === 'main' && run.conclusion === 'success' && run.hasDist);
}

export function blockingFiles(files) {
  return files.filter((path) => drawsFullGraph(path));
}
