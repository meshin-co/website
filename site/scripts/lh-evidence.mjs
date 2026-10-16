import { createHash } from 'node:crypto';

import { affectsBuild } from './build-surface.mjs';

export function fingerprint(files) {
  const measured = files
    .filter(([path]) => affectsBuild(path))
    .map(([path, blob]) => `${path} ${blob}`)
    .sort();
  return createHash('sha256').update(measured.join('\n')).digest('hex');
}

export function staleReason(record, current) {
  if (!record)
    return 'no local lighthouse run has been recorded for this repository; run GATE_PHASE=<bucket> npm run gate:lh, then npm run lh:record';
  if (record.fingerprint === current) return undefined;
  return `the last recorded lighthouse run (${record.recordedAt}) measured a different tree; run GATE_PHASE=<bucket> npm run gate:lh, then npm run lh:record`;
}

export function uncommittedBuildFiles(porcelain) {
  return porcelain
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).split(' -> ').at(-1))
    .filter((path) => affectsBuild(path));
}
