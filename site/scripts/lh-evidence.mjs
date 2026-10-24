import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { affectsBuild } from './build-surface.mjs';

const git = promisify(execFile);

const MEASURED_FILE = 'lh-measured.json';
const FINGERPRINT = /^[0-9a-f]{64}$/;

export function fingerprint(files) {
  const measured = files
    .filter(([path]) => affectsBuild(path))
    .map(([path, blob]) => `${path} ${blob}`)
    .sort();
  return createHash('sha256').update(measured.join('\n')).digest('hex');
}

export async function headFingerprint(cwd) {
  const { stdout } = await git('git', ['ls-tree', '-r', 'HEAD'], { cwd });
  return fingerprint(
    stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [meta, path] = line.split('\t');
        return [path, meta.split(' ')[2]];
      })
  );
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

export async function uncommittedBuildFilesAt(cwd) {
  const { stdout } = await git('git', ['status', '--porcelain'], { cwd });
  return uncommittedBuildFiles(stdout);
}

const remeasure = (bucket) => `Rebuild, remeasure with GATE_PHASE=${bucket} npm run gate:lh, then record.`;

export function unmeasuredReason(stamp, current, { auditDir, bucket }) {
  if (!FINGERPRINT.test(stamp?.fingerprint))
    return `${auditDir} has no stamp naming the tree its reports measured, so they could come from any tree; nothing recorded. ${remeasure(bucket)}`;
  if (stamp.fingerprint === current) return undefined;
  const began = typeof stamp.startedAt === 'string' ? ` (run started ${stamp.startedAt})` : '';
  return `${auditDir} was measured from tree ${stamp.fingerprint.slice(0, 12)}${began}, not the tree being recorded, ${current.slice(0, 12)}; nothing recorded. ${remeasure(bucket)}`;
}

export async function readMeasuredStamp(auditDir) {
  return readFile(join(auditDir, MEASURED_FILE), 'utf8')
    .then(JSON.parse)
    .catch(() => undefined);
}

export async function describeTree(repo) {
  try {
    const uncommitted = await uncommittedBuildFilesAt(repo);
    if (uncommitted.length > 0)
      return {
        reason: `${uncommitted.join(', ')} ${uncommitted.length === 1 ? 'is' : 'are'} not committed, so no commit names the tree this run measures; commit, rebuild and measure again`,
      };
    return { fingerprint: await headFingerprint(repo) };
  } catch (error) {
    return { reason: `git cannot describe the tree in ${repo}: ${(error.stderr || error.message).trim()}` };
  }
}

export async function stampMeasuredTree({ repo, auditDir }) {
  await clearMeasuredStamp(auditDir);

  const tree = await describeTree(repo);
  if (tree.reason) return { stamped: false, reason: tree.reason };

  await writeMeasuredStamp({ auditDir, fingerprint: tree.fingerprint });
  return { stamped: true, fingerprint: tree.fingerprint };
}

export async function clearMeasuredStamp(auditDir) {
  await rm(join(auditDir, MEASURED_FILE), { force: true });
}

export async function writeMeasuredStamp({ auditDir, fingerprint, startedAt = new Date().toISOString() }) {
  await mkdir(auditDir, { recursive: true });
  await writeFile(join(auditDir, MEASURED_FILE), `${JSON.stringify({ fingerprint, startedAt }, null, 2)}\n`);
}
