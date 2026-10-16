import { createHash } from 'node:crypto';

import { affectsBuild } from './build-surface.mjs';
import { categoryScore } from './report.mjs';

export function fingerprint(files) {
  const measured = files
    .filter(([path]) => affectsBuild(path))
    .map(([path, blob]) => `${path} ${blob}`)
    .sort();
  return createHash('sha256').update(measured.join('\n')).digest('hex');
}

export function staleReason(record, current) {
  if (!record) return 'no local lighthouse run has been recorded for this repository; run npm run gate:lh';
  if (record.fingerprint === current) return undefined;
  return `the last recorded lighthouse run (${record.recordedAt}) measured a different tree; run npm run gate:lh`;
}

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

const routeOf = (report) => new URL(report.finalUrl).pathname.replace(/index\.html$/, '').replace(/\.html$/, '') || '/';

export function evidenceFindings(reportsByFactor) {
  const findings = [];
  for (const [factor, reports] of Object.entries(reportsByFactor)) {
    if (reports.length === 0) {
      findings.push(`${factor}: no lighthouse reports on disk, so nothing measured this tree`);
      continue;
    }
    for (const report of reports) {
      const route = routeOf(report);
      for (const category of CATEGORIES) {
        if (!report.categories?.[category]) {
          findings.push(`${factor} ${route} ${category} absent, not 100`);
          continue;
        }
        const score = categoryScore(report, category, route);
        if (score !== 100) findings.push(`${factor} ${route} ${category} ${score}, not 100`);
      }
    }
  }
  return findings;
}
