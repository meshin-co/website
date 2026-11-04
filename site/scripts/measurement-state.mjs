import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describeTree } from './lh-evidence.mjs';
import { recordFiles } from './record-layout.mjs';

export async function readMeasurementState(root) {
  const tree = await describeTree(root);
  if (tree.reason) return { reason: tree.reason };
  const recordPath = join(root, 'audits', 'lighthouse-green.json');
  return {
    current: tree.fingerprint,
    record: existsSync(recordPath) ? JSON.parse(readFileSync(recordPath, 'utf8')) : undefined,
    ledgers: recordFiles(root, 'ledger').map((path) => JSON.parse(readFileSync(join(root, path), 'utf8'))),
  };
}
