import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { fingerprint, staleReason, uncommittedBuildFiles } from './lh-evidence.mjs';
import { phaseVerdict } from './report.mjs';

const run = promisify(execFile);
const [mode = 'check', phase] = process.argv.slice(2);
const RECORD = join('audits', 'lighthouse-green.json');

const refuse = (message) => {
  console.error(`LIGHTHOUSE ${message}`);
  process.exit(1);
};

const { stdout: tree } = await run('git', ['ls-tree', '-r', 'HEAD']);
const current = fingerprint(
  tree
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [meta, path] = line.split('\t');
      return [path, meta.split(' ')[2]];
    })
);

if (mode === 'record') {
  if (!phase) refuse('record needs the phase whose reports it should read: GATE_PHASE');

  const { stdout: porcelain } = await run('git', ['status', '--porcelain']);
  const dirty = uncommittedBuildFiles(porcelain);
  if (dirty.length > 0)
    refuse(
      `${dirty.join(', ')} ${dirty.length === 1 ? 'is' : 'are'} not committed, so a fingerprint of HEAD would name a tree the run never measured. Commit, rebuild, measure, then record.`
    );

  const auditDir = join('audits', `phase-${phase.replace(/^phase-/, '')}`);
  const { failures } = await phaseVerdict(phase, auditDir, join('site', 'dist'));
  if (failures.length > 0) {
    for (const failure of failures.slice(0, 10)) console.error(`LIGHTHOUSE ${failure}`);
    refuse(`${auditDir} is not a passing calibration run (${failures.length} failure(s)); nothing recorded`);
  }

  await mkdir('audits', { recursive: true });
  await writeFile(
    RECORD,
    `${JSON.stringify({ fingerprint: current, recordedAt: new Date().toISOString(), phase }, null, 2)}\n`
  );
  console.log(`lighthouse: recorded a passing calibration run for ${current.slice(0, 12)}`);
} else {
  const record = await readFile(RECORD, 'utf8').then(JSON.parse, () => undefined);
  const reason = staleReason(record, current);
  if (reason) refuse(reason);
  console.log(`lighthouse evidence covers this tree (${current.slice(0, 12)})`);
}
