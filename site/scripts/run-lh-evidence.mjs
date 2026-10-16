import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { evidenceFindings, fingerprint, staleReason } from './lh-evidence.mjs';

const run = promisify(execFile);
const [mode = 'check', phase] = process.argv.slice(2);
const RECORD = join('audits', 'lighthouse-green.json');

const refuse = (message) => {
  console.error(`LIGHTHOUSE ${message}`);
  process.exit(1);
};

async function readReports(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true }).catch(() => []);
  const reports = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith('lhr-') || !entry.name.endsWith('.json')) continue;
    reports.push(JSON.parse(await readFile(join(entry.parentPath, entry.name), 'utf8')));
  }
  return reports;
}

const { stdout } = await run('git', ['ls-tree', '-r', 'HEAD']);
const current = fingerprint(
  stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [meta, path] = line.split('\t');
      return [path, meta.split(' ')[2]];
    })
);

if (mode === 'record') {
  if (!phase) refuse('record needs the phase whose reports it should read: GATE_PHASE');
  const auditDir = join('audits', `phase-${phase.replace(/^phase-/, '')}`);
  const reportsByFactor = {
    mobile: await readReports(join(auditDir, 'lh-mobile')),
    desktop: await readReports(join(auditDir, 'lh-desktop')),
  };

  const findings = evidenceFindings(reportsByFactor);
  if (findings.length > 0) {
    for (const finding of findings) console.error(`LIGHTHOUSE ${finding}`);
    refuse(`${auditDir} does not hold a green run of both form factors; nothing recorded`);
  }

  await mkdir('audits', { recursive: true });
  const routes = new Set(reportsByFactor.mobile.map(({ finalUrl }) => new URL(finalUrl).pathname));
  await writeFile(
    RECORD,
    `${JSON.stringify(
      {
        fingerprint: current,
        recordedAt: new Date().toISOString(),
        phase,
        routes: routes.size,
        reports: reportsByFactor.mobile.length + reportsByFactor.desktop.length,
      },
      null,
      2
    )}\n`
  );
  console.log(`lighthouse: recorded ${routes.size} routes at 100/100/100/100 for ${current.slice(0, 12)}`);
} else {
  const record = await readFile(RECORD, 'utf8').then(JSON.parse, () => undefined);
  const reason = staleReason(record, current);
  if (reason) refuse(reason);
  console.log(`lighthouse evidence covers this tree (${current.slice(0, 12)})`);
}
