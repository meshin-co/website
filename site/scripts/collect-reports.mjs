import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const formFactor = process.argv[2];
const phase = process.env.GATE_PHASE ?? '1';

if (!['mobile', 'desktop'].includes(formFactor)) {
  throw new Error(`collect-reports: expected mobile or desktop, got ${formFactor}`);
}

const target = join('..', 'audits', `phase-${phase}`, `lh-${formFactor}`);
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

const names = (await readdir('.lighthouseci')).filter((name) => name.startsWith('lhr-') && name.endsWith('.json'));
for (const name of names) await copyFile(join('.lighthouseci', name), join(target, name));

console.log(`${formFactor}: ${names.length} report(s) -> ${target}`);
