import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { shardOf } from './lh-shards.cjs';

export function resolvePhase(phase) {
  if (!phase) throw new Error('collect-reports: GATE_PHASE must name the phase these audits belong to');
  return phase.replace(/^phase-/, '');
}

export function targetDir(formFactor, env) {
  const shard = shardOf(env);
  const phaseDir = join('..', 'audits', `phase-${resolvePhase(env.GATE_PHASE)}`, `lh-${formFactor}`);
  return shard.total === 1 ? phaseDir : join(phaseDir, `shard-${shard.index}`);
}

async function main(formFactor) {
  if (!['mobile', 'desktop'].includes(formFactor)) {
    throw new Error(`collect-reports: expected mobile or desktop, got ${formFactor}`);
  }

  const target = targetDir(formFactor, process.env);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });

  const names = (await readdir('.lighthouseci')).filter((name) => name.startsWith('lhr-') && name.endsWith('.json'));
  for (const name of names) await copyFile(join('.lighthouseci', name), join(target, name));

  console.log(`${formFactor}: ${names.length} report(s) -> ${target}`);
}

if (import.meta.filename === process.argv[1]) {
  process.env.GATE_PHASE ||= 'local';
  await main(process.argv[2]);
}
