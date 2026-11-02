import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { spendReportFile } from '../spend-report.mjs';

export const REVISION = 'abc1234';

export const spendReportFiles = (root, written = []) => {
  const { path, text } = spendReportFile({ repoRoot: root, written, revision: REVISION });
  return { [path]: text };
};

export function plantSpendReport(root) {
  for (const [path, text] of Object.entries(spendReportFiles(root))) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
}
