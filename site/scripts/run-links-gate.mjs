import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { linkArgs, siteOrigin } from './links-gate.mjs';

const binary = join('node_modules', '.bin', 'linkinator');
const hermetic = process.env.LINKS_SKIP_EXTERNAL === '1';
const result = spawnSync(binary, linkArgs({ skipExternal: hermetic, origin: siteOrigin(join('src', 'config.yaml')) }), {
  stdio: 'inherit',
});

if (hermetic) console.log('links: hermetic run, every host outside the build was skipped');

process.exit(result.status ?? 1);
