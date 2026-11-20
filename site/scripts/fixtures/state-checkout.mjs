import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { STATE_DIRECTORY } from '../record-layout.mjs';

export function checkOutState(root) {
  mkdirSync(join(root, STATE_DIRECTORY), { recursive: true });
  return root;
}
