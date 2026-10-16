import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { shardOf } from './lh-shards.cjs';
import { invokedDirectly } from './invoked-directly.mjs';

export function resolvePhase(phase) {
  if (!phase) throw new Error('collect-reports: GATE_PHASE must name the phase these audits belong to');
  return phase.replace(/^phase-/, '');
}

export function targetDir(formFactor, env) {
  const shard = shardOf(env);
  const phaseDir = join(auditRoot(env), 'audits', `phase-${resolvePhase(env.GATE_PHASE)}`, `lh-${formFactor}`);
  return shard.total === 1 ? phaseDir : join(phaseDir, `shard-${shard.index}`);
}

export const sourceDir = (env) => env.LH_OUTPUT_DIR ?? '.lighthouseci';

export const auditRoot = (env) => env.AUDIT_ROOT ?? '..';

async function listReports(dir) {
  try {
    return (await readdir(dir)).filter((name) => name.startsWith('lhr-') && name.endsWith('.json'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function collectReports(formFactor, env) {
  if (!['mobile', 'desktop'].includes(formFactor)) {
    throw new Error(`collect-reports: expected mobile or desktop, got ${formFactor}`);
  }

  const target = targetDir(formFactor, env);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });

  const source = sourceDir(env);
  const names = await listReports(source);
  for (const name of names) await copyFile(join(source, name), join(target, name));
  return { target, count: names.length };
}

async function main(formFactor) {
  const { target, count } = await collectReports(formFactor, process.env);
  console.log(`${formFactor}: ${count} report(s) -> ${target}`);
}

if (invokedDirectly(import.meta.filename, process.argv[1])) {
  await main(process.argv[2]);
}
